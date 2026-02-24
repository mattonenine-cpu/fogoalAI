-- Таблица пользователей приложения Fogoal (аккаунты из регистрации и Telegram).
-- Выполни в Supabase: Dashboard → SQL Editor → New query → вставь этот код → Run.

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  telegram_id bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(username)
);

-- Индекс для быстрого подсчёта и поиска по telegram_id
create index if not exists idx_app_users_telegram_id on public.app_users(telegram_id);
create index if not exists idx_app_users_created_at on public.app_users(created_at);

-- Обновление updated_at при изменении строки
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists app_users_updated_at on public.app_users;
create trigger app_users_updated_at
  before update on public.app_users
  for each row execute function public.set_updated_at();

-- RLS: доступ только через API на Vercel (service_role ключ). service_role обходит RLS.
alter table public.app_users enable row level security;

-- Нет политик для anon — клиент не обращается к таблице напрямую. Счётчик отдаёт API.
