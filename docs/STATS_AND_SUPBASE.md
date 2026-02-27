# Статистика использования и Supabase

## Где хранятся данные

**Одна таблица пользователей** — `public.app_users`. Пользователи нигде не дублируются.

- `id` — uuid
- `username` — уникальный логин (или `tg_<telegram_id>` для Telegram)
- `telegram_id` — опционально
- `password_hash` — хеш пароля (или детерминированный для Telegram)
- `user_data` — **один JSONB** со всеми данными приложения

## Структура `user_data`

```json
{
  "profile": { ... },
  "tasks": [ ... ],
  "notes": [ ... ],
  "folders": [ ... ],
  "stats": { ... }
}
```

Всё, что меняется в приложении (профиль, задачи, заметки, папки, дневная статистика), сохраняется в этом объекте и при каждом изменении отправляется в Supabase через API `action=saveData`. Отдельной второй таблицы пользователей нет.

## Полная статистика использования (`profile.usageStats`)

Внутри `profile` хранится объект **`usageStats`** — подробная статистика того, чем и как часто пользуется человек. Она пишется в тот же `user_data` и синхронизируется в Supabase вместе с профилем.

### Поля

| Поле | Описание |
|------|----------|
| **opens** | Счётчики открытий разделов: `dashboard`, `scheduler`, `smart_planner`, `chat`, `notes`, `sport`, `study`, `health` |
| **lastOpenedAt** | Время последнего открытия каждого раздела (ISO-строка) |
| **ecosystem.sport** | `workoutsCompleted` — завершённые тренировки, `coachMessages` — сообщения тренеру |
| **ecosystem.study** | `examsCreated` — созданные экзамены, `quizzesCompleted` — пройденные квизы, `ticketsParsed` — распознанные билеты |
| **ecosystem.health** | `logsSaved` — сохранённые дневники здоровья |
| **ecosystem.work** | `progressLogs` — логи прогресса в Work, `expertChatMessages` — сообщения эксперту |
| **totalChatMessages** | Всего сообщений в общем чате с ИИ |
| **totalTasksCompleted** | Всего завершённых задач (если трекается) |
| **totalGoalsCompleted** | Всего достигнутых целей |

### Когда обновляется

- **Открытие раздела** — при переходе по нижней навигации (Dashboard, Scheduler, Sport, Study, Health, Chat, Notes) увеличивается соответствующий счётчик в `opens` и обновляется `lastOpenedAt`.
- **Спорт** — завершение тренировки → `ecosystem.sport.workoutsCompleted`; отправка сообщения тренеру → `ecosystem.sport.coachMessages`.
- **Учёба** — создание экзамена (финализация после парсинга) → `examsCreated`, `ticketsParsed`; завершение квиза по билету → `quizzesCompleted`.
- **Здоровье** — сохранение дневника дня → `ecosystem.health.logsSaved`.
- **Work** — лог прогресса в экосистеме Work → `ecosystem.work.progressLogs`; сообщение эксперту → `ecosystem.work.expertChatMessages`.
- **Чат** — отправка сообщения в общий чат → `totalChatMessages`.
- **Цели** — обновление прогресса цели до 100% → `totalGoalsCompleted`.

Все эти обновления делаются через `onUpdateProfile` (обновление `profile`), после чего срабатывает сохранение в localStorage и вызов `authService.syncToCloud`, который отправляет полный payload в API и далее в Supabase. Таким образом, полная статистика всегда лежит в `app_users.user_data.profile.usageStats` и не требует отдельных таблиц или дублирования пользователей.

## Как посмотреть статистику в Supabase

1. Открой **Table Editor** → таблица **app_users**.
2. Выбери пользователя, колонка **user_data**.
3. Разверни `user_data` → `profile` → **usageStats**: там все счётчики и даты последних открытий.

Для аналитики можно использовать SQL, например:

```sql
select 
  username,
  user_data->'profile'->'usageStats'->'opens' as opens,
  user_data->'profile'->'usageStats'->'ecosystem' as ecosystem,
  user_data->'profile'->'usageStats'->'totalChatMessages' as total_chat_messages,
  user_data->'profile'->'usageStats'->'totalGoalsCompleted' as total_goals_completed
from public.app_users
where user_data->'profile'->'usageStats' is not null;
```

## Миграция старых пользователей

Если у существующего пользователя нет `usageStats`, при первом открытии профиля приложение инициализирует его через `getDefaultUsageStats()` и сохраняет в профиле. После следующей синхронизации в Supabase в `user_data.profile.usageStats` появится полная структура с нулями.

---

## Скрытый экран статистики в приложении (для разработчиков)

В приложении есть скрытый блок с полной статистикой. Как открыть:

1. **Пять раз подряд нажать по логотипу FoGoal** в шапке (в течение 2 секунд).
2. Ввести промокод разработчика в появившемся окне.
3. После верного кода откроется экран со всей статистикой (открытия разделов, экосистемы, общие счётчики). Доступ сохраняется в рамках сессии (до закрытия вкладки).

**Промокод разработчика:** `FOGOAL_DEV_2025`
