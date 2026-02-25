/**
 * Крон: раз в сутки отправляет напоминания в Telegram всем, у кого включены ежедневные напоминания.
 * Подходит для бесплатного плана Vercel (1 запуск в день).
 * Vercel Cron: "0 9 * * *" (ежедневно в 09:00 UTC).
 * Env: TELEGRAM_BOT_TOKEN, REMINDERS_READ_WRITE_TOKEN, CRON_SECRET (опционально).
 */
import { list, put } from '@vercel/blob';
declare const process: { env: { [key: string]: string | undefined } };

interface StoredReminder {
  telegramId: number;
  reminderFrequency: 'daily';
  reminderHour: number;
  tasks: { id: string; title: string; date?: string; scheduledTime?: string; completed: boolean }[];
  goals: { id: string; title: string; progress: number; target: number; completed: boolean }[];
  lang: 'ru' | 'en';
  timezoneOffset: number;
  updatedAt: string;
  lastDailySentDate: string | null;
}

function getLocalISODate(offsetMinutes: number): string {
  const d = new Date();
  const local = new Date(d.getTime() + offsetMinutes * 60 * 1000);
  const y = local.getFullYear();
  const m = String(local.getMonth() + 1).padStart(2, '0');
  const day = String(local.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getLocalDayOfWeek(offsetMinutes: number): number {
  const d = new Date();
  const local = new Date(d.getTime() + offsetMinutes * 60 * 1000);
  return local.getDay(); // 0 = Sunday .. 6 = Saturday
}

/** Агрессивные заголовки в стиле Duolingo — разные по дням недели (RU) */
const OPENERS_RU: string[] = [
  'Воскресенье — не повод забыть цели. 🔥',
  'Понедельник. Твои цели уже скучают. Пора. 💪',
  'Вторник: фокус включён? Проверь список. ⚡',
  'Среда — середина недели. Не сбавляй. 🎯',
  'Четверг. Ещё пара дней — покажи результат. 📈',
  'Пятница. Закрой задачи до вечера. 🦉',
  'Суббота. Даже в выходной — один шаг к цели. 🌱',
];

/** То же, EN */
const OPENERS_EN: string[] = [
  'Sunday — no excuse to forget your goals. 🔥',
  'Monday. Your goals miss you. Time to show up. 💪',
  'Tuesday: focus on? Check the list. ⚡',
  'Wednesday — midweek. Don’t slow down. 🎯',
  'Thursday. A few days left — show progress. 📈',
  'Friday. Close the list before evening. 🦉',
  'Saturday. Even on weekend — one step toward the goal. 🌱',
];

/** Короткие мотивационные концовки (RU) */
const CLOSERS_RU: string[] = [
  'Каждый день без шага — день без прогресса. Действуй.',
  'Маленький шаг сегодня > ноль шагов завтра.',
  'Ты ближе к цели, чем вчера. Продолжай.',
  'Фокус решает. Выбери одну задачу и сделай.',
  'Цели не достигаются сами. Твой ход.',
];

/** Короткие мотивационные концовки (EN) */
const CLOSERS_EN: string[] = [
  'No step today = no progress. Move.',
  'One small step today > zero tomorrow.',
  'You’re closer than yesterday. Keep going.',
  'Focus wins. Pick one task and do it.',
  'Goals don’t hit themselves. Your turn.',
];

function buildDailySummary(data: StoredReminder): string {
  const ru = data.lang === 'ru';
  const today = getLocalISODate(data.timezoneOffset);
  const dayOfWeek = getLocalDayOfWeek(data.timezoneOffset);
  const openers = ru ? OPENERS_RU : OPENERS_EN;
  const closers = ru ? CLOSERS_RU : CLOSERS_EN;
  const opener = openers[dayOfWeek] ?? openers[1];
  const closer = closers[dayOfWeek % closers.length];

  const lines: string[] = [opener, ''];

  const activeGoals = (data.goals || []).filter((g) => !g.completed);
  const todayTasks = data.tasks.filter((t) => t.date === today && !t.completed);
  const upcoming = data.tasks.filter((t) => t.date && t.date >= today && !t.completed && t.date !== today);
  upcoming.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  if (activeGoals.length > 0) {
    lines.push(ru ? '🎯 Цели (не сбрасывай):' : '🎯 Goals (don’t drop):');
    activeGoals.slice(0, 5).forEach((g) => {
      const pct = Math.min(100, Math.round((g.progress / (g.target || 100)) * 100));
      lines.push(`• ${g.title} — ${g.progress}/${g.target} (${pct}%)`);
    });
    lines.push('');
  }

  if (todayTasks.length > 0) {
    lines.push(ru ? '📌 Сегодня в приоритете:' : '📌 Today’s priority:');
    todayTasks.slice(0, 10).forEach((t) => {
      const time = t.scheduledTime ? ` ${t.scheduledTime}` : '';
      lines.push(`• ${t.title}${time}`);
    });
    lines.push('');
  }

  if (upcoming.length > 0) {
    lines.push(ru ? '⏰ Ближайшие дедлайны:' : '⏰ Upcoming:');
    upcoming.slice(0, 5).forEach((t) => {
      lines.push(`• ${t.title} (${t.date})`);
    });
    lines.push('');
  }

  if (todayTasks.length === 0 && activeGoals.length === 0) {
    lines.push(ru ? 'Задач на сегодня нет — добавь в приложении и не откладывай.' : 'No tasks today — add some in the app and don’t put it off.');
    lines.push('');
  }

  lines.push('—');
  lines.push(closer);

  return lines.join('\n').trim();
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const auth = req.headers?.authorization || req.query?.secret;
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && auth !== `Bearer ${cronSecret}` && auth !== cronSecret && req.query?.secret !== cronSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const blobToken = process.env.REMINDERS_READ_WRITE_TOKEN;
  if (!token) {
    return res.status(200).json({ ok: true, message: 'TELEGRAM_BOT_TOKEN not set' });
  }
  if (!blobToken) {
    return res.status(200).json({ ok: true, message: 'REMINDERS_READ_WRITE_TOKEN not set; no reminders stored' });
  }

  try {
    const { blobs } = await list({ prefix: 'reminders/', limit: 500 });
    const now = new Date();
    const results: { telegramId: number; daily?: boolean; task?: number }[] = [];

    for (const blob of blobs) {
      const match = blob.pathname?.match(/^reminders\/(\d+)\.json$/);
      if (!match || !blob.url) continue;
      const telegramId = Number(match[1]);
      if (!Number.isFinite(telegramId)) continue;

      let data: StoredReminder;
      try {
        const r = await fetch(blob.url);
        if (!r.ok) continue;
        data = await r.json();
      } catch {
        continue;
      }

      if (!data.telegramId) continue;
      if ((data as { reminderFrequency?: string }).reminderFrequency === 'off') continue;

      const tzOffset = data.timezoneOffset ?? 0;
      const todayLocal = getLocalISODate(tzOffset);

      if (data.reminderFrequency === 'daily') {
        if (data.lastDailySentDate !== todayLocal) {
          const text = buildDailySummary(data);
          const sendRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: telegramId, text: text.slice(0, 4096), disable_web_page_preview: true }),
          });
          if (sendRes.ok) {
            data.lastDailySentDate = todayLocal;
            results.push({ telegramId, daily: true });
            await put(blob.pathname!, JSON.stringify(data), { access: 'public' });
          }
        }
      }
    }

    return res.status(200).json({ ok: true, processed: blobs.length, results });
  } catch (e: any) {
    console.error('reminder-cron error:', e);
    return res.status(500).json({ error: e.message || 'Cron failed' });
  }
}
