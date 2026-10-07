-- ============================================================
--  Mídias privadas: fotos/vídeos só podem ser vistos depois de
--  APROVADOS (ou por moderadores). Rode no SQL Editor se o seu
--  projeto foi criado com a versão anterior do schema.sql.
-- ============================================================
update storage.buckets set public = false where id = 'midias';

drop policy if exists "ver mídia aprovada ou moderador" on storage.objects;
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

-- Moderadores podem adicionar/remover colegas pelo painel Admin
drop policy if exists "moderador adiciona" on public.moderadores;
create policy "moderador adiciona" on public.moderadores
  for insert to authenticated with check (public.is_moderador());
drop policy if exists "moderador remove" on public.moderadores;
create policy "moderador remove" on public.moderadores
  for delete to authenticated using (public.is_moderador() and email <> auth.jwt() ->> 'email');
