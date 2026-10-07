-- ============================================================
--  Segurança contra spam/invasão + métricas do admin
--  (já aplicado no projeto; rode no SQL Editor para recriar)
-- ============================================================

-- Moderador = e-mail na lista E e-mail confirmado no login
create or replace function public.is_moderador()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.moderadores m join auth.users u on lower(u.email) = lower(m.email)
    where u.id = auth.uid() and u.email_confirmed_at is not null
  );
$$;

alter table public.historias add column if not exists moderado_em timestamptz;

-- Registro mínimo de envios para o limite: só um hash da origem (nunca o IP)
create table if not exists public.envios_log (
  origem text not null,
  com_midia boolean not null default false,
  criado_em timestamptz not null default now()
);
create index if not exists envios_log_origem_idx on public.envios_log (origem, criado_em);
alter table public.envios_log enable row level security;
revoke all on table public.envios_log from anon, authenticated;

create or replace function public.origem_da_requisicao()
returns text language sql stable as $$
  select md5(coalesce(
    nullif(current_setting('request.headers', true), '')::json ->> 'cf-connecting-ip',
    split_part(nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for', ',', 1),
    'desconhecida') || '|arvore-marista');
$$;

-- Antes de cada envio: limpa o texto, valida, força "pendente" e aplica limites
create or replace function public.limitar_envios()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_origem text := public.origem_da_requisicao();
  v_10min int; v_hora int; v_pendentes int; v_midias int;
begin
  new.mensagem := nullif(btrim(regexp_replace(regexp_replace(regexp_replace(coalesce(new.mensagem, ''),
                    '[\u0001-\u0008\u000B-\u001F\u007F​-‏‪-‮⁠-⁤﻿]', '', 'g'),
                    '[̀-ͯ]{3,}', '', 'g'),
                    '\n{3,}', E'\n\n', 'g')), '');
  new.nome  := nullif(btrim(regexp_replace(coalesce(new.nome, ''),  '[^[:alpha:][:space:]''.-]', '', 'g')), '');
  new.turma := nullif(btrim(regexp_replace(coalesce(new.turma, ''), '[^[:alnum:][:space:]ºª°.-]', '', 'g')), '');
  if new.mensagem is null and new.midia_caminho is null then raise exception 'SEM_CONTEUDO'; end if;
  if new.midia_caminho is not null and new.midia_caminho !~ '^envios/[0-9a-f-]{36}\.[a-z0-9]{1,5}$' then
    raise exception 'CAMINHO_INVALIDO';
  end if;
  new.status := 'pendente';
  new.criado_em := now();
  new.moderado_em := null;
  if public.is_moderador() then return new; end if;

  -- generoso: a escola inteira pode sair pelo mesmo IP do Wi-Fi
  select count(*) filter (where criado_em > now() - interval '10 minutes'),
         count(*) filter (where criado_em > now() - interval '1 hour')
    into v_10min, v_hora from public.envios_log
   where origem = v_origem and criado_em > now() - interval '1 hour';
  if v_10min >= 15 or v_hora >= 60 then raise exception 'LIMITE_ENVIOS'; end if;

  select count(*), count(*) filter (where midia_caminho is not null)
    into v_pendentes, v_midias from public.historias where status = 'pendente';
  if v_pendentes >= 300 then raise exception 'FILA_CHEIA'; end if;
  if new.midia_caminho is not null and v_midias >= 40 then raise exception 'FILA_MIDIA_CHEIA'; end if;

  insert into public.envios_log (origem, com_midia) values (v_origem, new.midia_caminho is not null);
  return new;
end $$;
create or replace trigger limitar_envios before insert on public.historias
  for each row execute function public.limitar_envios();

-- Moderação só muda o status (e registra quando); conteúdo e autoria ficam como enviados
create or replace function public.ao_moderar()
returns trigger language plpgsql as $$
begin
  if new.status is distinct from old.status then new.moderado_em := now(); end if;
  new.id := old.id; new.criado_em := old.criado_em; new.mensagem := old.mensagem; new.nome := old.nome;
  new.grupo := old.grupo; new.turma := old.turma; new.midia_caminho := old.midia_caminho; new.midia_tipo := old.midia_tipo;
  return new;
end $$;
create or replace trigger ao_moderar before update on public.historias
  for each row execute function public.ao_moderar();

-- Arquivo só sobe se a história pendente que aponta para ele já existe (até 30 min)
create or replace function public.pode_subir_midia(p_nome text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.historias h
                 where h.midia_caminho = p_nome and h.status = 'pendente'
                   and h.criado_em > now() - interval '30 minutes');
$$;
revoke all on function public.pode_subir_midia(text) from public;
grant execute on function public.pode_subir_midia(text) to anon, authenticated;

alter policy "qualquer um sobe mídia" on storage.objects
  with check (bucket_id = 'midias' and (storage.foldername(name))[1] = 'envios' and public.pode_subir_midia(name));

-- Só formatos comuns de foto/vídeo de celular (sem SVG, HTML etc.)
update storage.buckets
   set file_size_limit = 52428800,
       allowed_mime_types = array['image/jpeg','image/png','image/webp','image/heic','image/heif','image/gif',
                                  'video/mp4','video/quicktime','video/webm','video/3gpp']
 where id = 'midias';

-- ---------------- Métricas anônimas ----------------
create table if not exists public.eventos (
  tipo text not null check (tipo in ('abriu_arvore','abriu_tv','abriu_formulario','etapa2','enviou','abriu_historia')),
  aparelho uuid,          -- código aleatório gerado no aparelho (não identifica a pessoa)
  origem text,            -- hash, só para conter abuso
  criado_em timestamptz not null default now()
);
create index if not exists eventos_tempo_idx on public.eventos (criado_em);
create index if not exists eventos_origem_idx on public.eventos (origem, criado_em);
alter table public.eventos enable row level security;
revoke all on table public.eventos from anon, authenticated;

create or replace function public.registrar_evento(p_tipo text, p_aparelho uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_origem text := public.origem_da_requisicao();
begin
  if p_tipo not in ('abriu_arvore','abriu_tv','abriu_formulario','etapa2','enviou','abriu_historia') then return; end if;
  if (select count(*) from public.eventos where origem = v_origem and criado_em > now() - interval '10 minutes') >= 300 then return; end if;
  if p_aparelho is not null and (select count(*) from public.eventos
        where aparelho = p_aparelho and tipo = p_tipo and criado_em > now() - interval '1 minute') >= 3 then return; end if;
  insert into public.eventos (tipo, aparelho, origem) values (p_tipo, p_aparelho, v_origem);
end $$;
revoke all on function public.registrar_evento(text, uuid) from public;
grant execute on function public.registrar_evento(text, uuid) to anon, authenticated;

-- O painel do admin chama esta função (só moderadores)
create or replace function public.metricas_admin(p_dias int default 30)
returns json language plpgsql stable security definer set search_path = public as $$
declare
  d int := least(greatest(coalesce(p_dias, 30), 1), 365);
  inicio timestamptz := date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo' - make_interval(days => d - 1);
  r json;
begin
  if not public.is_moderador() then raise exception 'SEM_PERMISSAO'; end if;
  select json_build_object(
    'periodo_dias', d,
    'totais', (select json_build_object(
        'total', count(*),
        'pendente', count(*) filter (where status='pendente'),
        'aprovado', count(*) filter (where status='aprovado'),
        'recusado', count(*) filter (where status='recusado'),
        'com_nome', count(*) filter (where nome is not null),
        'com_foto', count(*) filter (where midia_tipo='imagem'),
        'com_video', count(*) filter (where midia_tipo='video'),
        'no_periodo', count(*) filter (where criado_em >= inicio),
        'horas_ate_moderar', round((extract(epoch from avg(moderado_em - criado_em)) / 3600)::numeric, 1),
        'mais_antiga_pendente_horas', round((extract(epoch from now() - min(criado_em) filter (where status='pendente')) / 3600)::numeric, 1)
      ) from public.historias),
    'por_dia', (select coalesce(json_agg(json_build_object('dia', dia, 'envios', envios, 'aprovadas', aprovadas) order by dia), '[]')
       from (select g::date as dia,
                    (select count(*) from public.historias h where (h.criado_em at time zone 'America/Sao_Paulo')::date = g::date) as envios,
                    (select count(*) from public.historias h where (h.criado_em at time zone 'America/Sao_Paulo')::date = g::date and h.status='aprovado') as aprovadas
               from generate_series((inicio at time zone 'America/Sao_Paulo')::date, (now() at time zone 'America/Sao_Paulo')::date, interval '1 day') g) x),
    'por_hora', (select coalesce(json_agg(json_build_object('hora', hora, 'envios', n) order by hora), '[]')
       from (select extract(hour from criado_em at time zone 'America/Sao_Paulo')::int hora, count(*) n
               from public.historias where criado_em >= inicio group by 1) x),
    'por_grupo', (select coalesce(json_agg(json_build_object('grupo', grupo, 'n', n) order by n desc), '[]')
       from (select coalesce(grupo,'—') grupo, count(*) n from public.historias where criado_em >= inicio group by 1) x),
    'por_turma', (select coalesce(json_agg(json_build_object('turma', turma, 'n', n) order by n desc), '[]')
       from (select upper(turma) turma, count(*) n from public.historias where criado_em >= inicio and turma is not null
              group by 1 order by 2 desc limit 10) x),
    'funil', (select json_build_object(
        'abriu_formulario', count(distinct coalesce(aparelho::text, origem)) filter (where tipo='abriu_formulario'),
        'etapa2',           count(distinct coalesce(aparelho::text, origem)) filter (where tipo='etapa2'),
        'enviou',           count(distinct coalesce(aparelho::text, origem)) filter (where tipo='enviou'),
        'visitas_arvore',   count(*) filter (where tipo='abriu_arvore'),
        'aparelhos_arvore', count(distinct aparelho) filter (where tipo='abriu_arvore'),
        'historias_lidas',  count(*) filter (where tipo='abriu_historia')
      ) from public.eventos where criado_em >= inicio),
    'armazenamento_mb', (select round(coalesce(sum((metadata->>'size')::bigint), 0) / 1048576.0, 1)
       from storage.objects where bucket_id = 'midias'),
    'bloqueios_hora', 60
  ) into r;
  return r;
end $$;
revoke all on function public.metricas_admin(int) from public;
grant execute on function public.metricas_admin(int) to authenticated;
