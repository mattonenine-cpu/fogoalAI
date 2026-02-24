-- Хранение данных аккаунта в облаке: цели, задачи на дни, здоровье, настроение, экзамены и т.д.
-- Выполни в Supabase: SQL Editor → New query → вставь → Run.

alter table public.app_users
  add column if not exists user_data jsonb;

comment on column public.app_users.user_data is 'Profile, tasks, notes, folders, stats (goals, exams, health, mood, etc.)';
