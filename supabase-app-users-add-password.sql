-- Добавить колонку для хеша пароля (логин по username+password).
-- Выполни в Supabase: SQL Editor → New query → вставь и Run.

alter table public.app_users
  add column if not exists password_hash text;

comment on column public.app_users.password_hash is 'scrypt hash: base64(salt):base64(hash)';
