-- Хранение данных аккаунта в облаке: одна таблица app_users, без дублирования пользователей.
-- user_data (jsonb) = полный снапшот приложения: profile (в т.ч. usageStats), tasks, notes, folders, stats.
-- Выполни в Supabase: SQL Editor → New query → вставь → Run.

alter table public.app_users
  add column if not exists user_data jsonb;

comment on column public.app_users.user_data is 'JSON: { profile, tasks, notes, folders, stats }. profile включает usageStats (полная статистика использования: открытия разделов, экосистемы, действия). Пользователи не дублируются — только эта таблица.';
