# Подробный туториал: как подключить общую базу на Supabase (для чайников)

Этот документ шаг за шагом объясняет, как настроить Supabase для совместной работы пользователей (регистрация, логин, хранение пользовательских данных) и как подключить его к этому проекту.

Коротко: вы создаёте проект в Supabase, добавляете таблицу `user_data`, настраиваете переменные окружения в Vite (`VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY`), затем запускаете фронтенд — приложение начнёт работать с общей базой.

---

## 1) Создание проекта в Supabase

1. Зайдите на https://app.supabase.com и зарегистрируйтесь / войдите.
2. Нажмите **New project** → заполните название, пароль базы (DB password) и регион → Create new project.
3. После создания перейдите в **Settings → API**: там находятся два важных значения:
   - `URL` — это ваш Supabase URL
   - `anon key` — это публичный анонимный ключ

Скопируйте их — они понадобятся в `.env`.

---

## 2) Создание таблицы `user_data`

Перейдите в **Table Editor** → **New Table** или выполните SQL в SQL-редакторе. Ниже готовый SQL, который можно вставить в SQL Editor:

```sql
create table public.user_data (
  user_id uuid primary key references auth.users(id),
  json text
);

-- Включим RLS (Row Level Security)
alter table public.user_data enable row level security;

-- Политики: разрешаем авторизованным пользователям читать/писать свою строку
create policy "users_select_own" on public.user_data
  for select using ( auth.uid() = user_id );

create policy "users_insert_own" on public.user_data
  for insert with check ( auth.uid() = user_id );

create policy "users_update_own" on public.user_data
  for update using ( auth.uid() = user_id ) with check ( auth.uid() = user_id );

create policy "users_delete_own" on public.user_data
  for delete using ( auth.uid() = user_id );
```

Пояснения:
- `auth.users` — встроенная таблица, где Supabase хранит пользователей (при использовании встроенной auth-системы).
- `auth.uid()` возвращает текущего пользователя (uuid) в контексте запроса.
- Политики RLS (Row Level Security) защищают строки: пользователь может читать/писать только свою.

Если вы хотите упростить тесты на начальном этапе, можно временно отключить RLS (не рекомендуется в проде):

```sql
alter table public.user_data disable row level security;
```

---

## 3) Настройка проекта (Vite / env)

В корне проекта создайте файл `.env.local` (или добавьте в существующий `.env`) и добавьте:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...your_anon_key...
VITE_API_BASE=http://localhost:3000
```

Пояснение:
- `VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY` нужны для клиента Supabase — `services/supabaseClient.ts` читает их автоматически.
- `VITE_API_BASE` — адрес локального API, который мы добавили как fallback (оставьте `http://localhost:3000` если запускаете локально).

После внесения env-переменных перезапустите Vite (`npm run dev`). Vite подхватит новые переменные только после перезапуска.

---

## 4) Установка зависимостей

Откройте терминал в корне проекта и выполните:

```bash
npm install @supabase/supabase-js
```

Если вы ещё не устанавливали зависимости сервера (fallback API), выполните:

```bash
npm install express better-sqlite3 bcrypt jsonwebtoken cors body-parser concurrently
```

---

## 5) Как это работает в проекте (кратко)

- `services/supabaseClient.ts` — экспортирует `supabase` клиент или `null`, если env-переменные не заданы.
- `services/authService.ts` — при наличии `supabase` использует его `auth.signUp` / `auth.signInWithPassword` и хранит/чтение данных в таблице `user_data`. Если `supabase` не настроен, используется локальный Express+SQLite API.

Файлы, которые вы уже изменяли/добавляли:
- `server.js` — локальный Express API (fallback)
- `server/db.js` — локальный SQLite helper (fallback)
- `services/supabaseClient.ts` — клиент Supabase
- `services/authService.ts` — интеграция и переключение между Supabase и fallback

---

## 6) Тестирование: регистрация и логин (примеры)

1) Тест в браузере (консоль) — используя `authService` (если фронтенд запущен):

```js
// Вызов регистрации
authService.register('user@example.com', 'Password123!', {/* initialData объект */}).then(console.log);

// Вызов логина
authService.login('user@example.com', 'Password123!').then(console.log);
```

2) curl (если используете локальный fallback API вместо Supabase):

```bash
curl -X POST http://localhost:3000/api/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test@example.com","password":"Password123!","initialData":{}}'

curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test@example.com","password":"Password123!"}'
```

3) Прямые вызовы Supabase (в терминале с Node.js или в отдельном скрипте), пример на Node:

```js
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

// Регистрация
const { data, error } = await supabase.auth.signUp({ email: 'test@example.com', password: 'Password123!' });

// Вход
const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({ email: 'test@example.com', password: 'Password123!' });
```

---

## 7) (Опционально) Миграция данных из локального `data.sqlite` в Supabase

Если у вас уже есть пользователи/данные в локальной базе (`data.sqlite`), можно экспортировать и загрузить их в Supabase. Приведён простой Node-скрипт миграции — сохраните как `migrate_to_supabase.js` в корне, установите зависимости и запустите.

```js
// migrate_to_supabase.js
import Database from 'better-sqlite3';
import { createClient } from '@supabase/supabase-js';

const db = new Database('./data.sqlite');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

const users = db.prepare('SELECT id, username, password_hash FROM users').all();
for (const u of users) {
  console.log('Skipping password migration — создайте пользователей вручную или используйте reset password. Username:', u.username);
  // Чаще всего: нельзя импортировать хэши прямо в auth.users без специальных шагов.
  // Вместо этого можно: создать в user_data только json-данные и попросить пользователей сбросить пароль.
  const dataRow = db.prepare('SELECT json FROM user_data WHERE user_id = ?').get(u.id);
  if (dataRow && dataRow.json) {
    // Вам нужен user_id (uuid) в Supabase; если вы не храните uuid, придется сопоставлять по email/username.
    // Этот пример предполагает, что username = email и вы уже создали пользователей в Supabase.
    const email = u.username;
    const { data: supUser } = await supabase.auth.admin.listUsers();
    // ... далее — сопоставить и upsert в user_data
  }
}

console.log('Миграция — базовый шаблон завершен. Смотрите комментарии в скрипте.');
```

Примечание: импорт паролей в Supabase auth требует использования Admin API и осторожности. Проще попросить пользователей повторно зарегистрироваться или использовать механизм сброса пароля.

---

## 8) Развертывание в продакшен (коротко)

- На проде храните `SUPABASE_SERVICE_ROLE_KEY` и другие секреты в безопасном месте (CI/CD / хостинг). Никогда не публикуйте `service_role` на клиенте.
- Убедитесь, что `JWT_SECRET` и другие секреты для локального сервера установлены если вы его используете.
- Для серверной логики предпочтительнее запускать backend через serverless функции (Vercel, Netlify) или отдельный VPS, а Supabase использовать как основной источник правды.

---

## 9) Частые вопросы и советы

- Нужно ли отключать локальный `server.js`? Не обязательно — мы оставили его как fallback. Если вы полностью переходите на Supabase, можно удалить `server.js` и `server/db.js`.
- Как заставить фронтенд использовать Supabase? Добавьте переменные в `.env.local` и перезапустите `npm run dev`.
- Как проверить, что RLS работает? Попробуйте выполнить SELECT через SQL Editor от имени другого пользователя или без авторизации — строки не должны быть доступны.

---

Если хотите, могу сделать одно из следующего прямо сейчас:
- сгенерировать готовый SQL-скрипт с созданием таблицы и политиками (уже есть выше),
- добавить в репозиторий скрипт для автоматического создания таблицы через Supabase CLI (если дадите доступные ключи),
- помочь прогнать тест регистрации/логина (вам нужно дать разрешение или прислать `VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY` в безопасном месте).

Файл добавлен: `README_SUPABASE.md` — откройте его в проекте для чтения.
