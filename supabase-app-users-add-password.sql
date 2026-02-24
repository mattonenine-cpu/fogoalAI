-- ОБЯЗАТЕЛЬНО для сохранения паролей и входа с другого устройства.
-- Добавляет колонку для хеша пароля. Без неё регистрация вернёт ошибку.
-- Выполни в Supabase: SQL Editor → New query → вставь этот код → Run.

alter table public.app_users
  add column if not exists password_hash text;

comment on column public.app_users.password_hash is 'scrypt hash: base64(salt):base64(hash)';
