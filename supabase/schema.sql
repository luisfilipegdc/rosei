-- ============================================================
--  Árvore de Histórias — estrutura do banco (Supabase)
--  Cole tudo no SQL Editor do Supabase e clique em "Run".
-- ============================================================

-- 1) Quem pode moderar (aprovar/recusar). Adicione os e-mails da equipe.
create table if not exists public.moderadores (
  email text primary key
);
-- insert into public.moderadores (email) values ('pastoral@exemplo.com');

create or replace function public.is_moderador()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.moderadores where email = auth.jwt() ->> 'email');
$$;

alter table public.moderadores enable row level security;
create policy "moderador vê lista" on public.moderadores
  for select to authenticated using (public.is_moderador());
create policy "moderador adiciona" on public.moderadores
  for insert to authenticated with check (public.is_moderador());
create policy "moderador remove" on public.moderadores
  for delete to authenticated using (public.is_moderador() and email <> auth.jwt() ->> 'email');

-- 2) As histórias (folhas da árvore)
create table if not exists public.historias (
  id          uuid primary key default gen_random_uuid(),
  criado_em   timestamptz not null default now(),
  nome        text check (char_length(nome) <= 60),
  grupo       text check (grupo in ('Aluno','Professor','Colaborador','Família')),
  turma       text check (char_length(turma) <= 30),
  mensagem    text check (char_length(mensagem) <= 1000),
  midia_caminho text,
  midia_tipo  text check (midia_tipo in ('imagem','video')),
  status      text not null default 'pendente' check (status in ('pendente','aprovado','recusado')),
  constraint tem_conteudo check (coalesce(char_length(trim(mensagem)),0) > 0 or midia_caminho is not null)
);

alter table public.historias enable row level security;

-- Qualquer pessoa (sem login) pode ENVIAR, mas sempre como "pendente"
create policy "qualquer um envia" on public.historias
  for insert to anon, authenticated with check (status = 'pendente');

-- Qualquer pessoa vê apenas as APROVADAS
create policy "todos veem aprovadas" on public.historias
  for select to anon, authenticated using (status = 'aprovado' or public.is_moderador());

-- Só moderadores alteram e apagam
create policy "moderador altera" on public.historias
  for update to authenticated using (public.is_moderador()) with check (public.is_moderador());
create policy "moderador apaga" on public.historias
  for delete to authenticated using (public.is_moderador());

-- 3) Armazenamento de fotos e vídeos — bucket PRIVADO
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('midias', 'midias', false, 52428800, array['image/*','video/*'])
on conflict (id) do nothing;

create policy "qualquer um sobe mídia" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'midias' and (storage.foldername(name))[1] = 'envios');

create policy "moderador apaga mídia" on storage.objects
  for delete to authenticated
  using (bucket_id = 'midias' and public.is_moderador());

-- Arquivos só podem ser vistos se a história foi APROVADA (ou por moderadores)
create policy "ver mídia aprovada ou moderador" on storage.objects
  for select to anon, authenticated
  using (
    bucket_id = 'midias'
    and (
      public.is_moderador()
      or exists (select 1 from public.historias h
                 where h.midia_caminho = storage.objects.name and h.status = 'aprovado')
    )
  );
