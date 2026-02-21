/**
 * Крон: раз в день проверяет сохранённые напоминания и отправляет в Telegram.
 * Vercel Cron: schedule "0 9 * * *" (ежедневно в 9:00 UTC, Hobby).
 * Env: TELEGRAM_BOT_TOKEN, BLOB_READ_WRITE_TOKEN (опционально), CRON_SECRET для авторизации вызова.
 */
import { list, put } from '@vercel/blob';
declare const process: { env: { [key: string]: string | undefined } };

interface StoredReminder {
  telegramId: number;
  reminderFrequency: 'daily' | 'per_task';
  reminderLeadMinutes: number;
  tasks: { id: string; title: string; date?: string; scheduledTime?: string; completed: boolean }[];
  goals: { id: string; title: string; progress: number; target: number; completed: boolean }[];
  lang: 'ru' | 'en';
  timezoneOffset: number;
  updatedAt: string;
  lastDailySentDate: string | null;
  lastTaskReminderSent: Record<string, string>;
}

function getLocalISODate(offsetMinutes: number): string {
  const d = new Date();
  const local = new Date(d.getTime() + offsetMinutes * 60 * 1000);
  const y = local.getFullYear();
  const m = String(local.getMonth() + 1).padStart(2, '0');
  const day = String(local.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseTimeToMinutes(s?: string): number | null {
  if (!s || typeof s !== 'string') return null;
  const [h, m] = s.trim().split(':').map(Number);
  if (!Number.isFinite(h)) return null;
  return (h || 0) * 60 + (Number.isFinite(m) ? m : 0);
}

function buildDailySummary(data: StoredReminder): string {
  const ru = data.lang === 'ru';
  const today = getLocalISODate(data.timezoneOffset);
  const lines: string[] = [];
  lines.push(ru ? '📋 Цели и задачи на день' : '📋 Goals & tasks for today');
  lines.push('');

  const activeGoals = (data.goals || []).filter((g) => !g.completed);
  if (activeGoals.length > 0) {
    lines.push(ru ? '🎯 Цели:' : '🎯 Goals:');
    activeGoals.slice(0, 5).forEach((g) => {
      const pct = Math.min(100, Math.round((g.progress / (g.target || 100)) * 100));
      lines.push(`• ${g.title} — ${g.progress}/${g.target} (${pct}%)`);
    });
    lines.push('');
  }

  const todayTasks = data.tasks.filter((t) => t.date === today && !t.completed);
  const upcoming = data.tasks.filter((t) => t.date && t.date >= today && !t.completed && t.date !== today);
  upcoming.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  if (todayTasks.length > 0) {
    lines.push(ru ? '📌 На сегодня:' : '📌 Today:');
    todayTasks.slice(0, 10).forEach((t) => {
      const time = t.scheduledTime ? ` ${t.scheduledTime}` : '';
      lines.push(`• ${t.title}${time}`);
    });
    lines.push('');
  }
  if (upcoming.length > 0) {
    lines.push(ru ? '⏰ Ближайшие:' : '⏰ Upcoming:');
    upcoming.slice(0, 5).forEach((t) => {
      lines.push(`• ${t.title} (${t.date})`);
    });
  }
  return lines.join('\n').trim() || (ru ? 'Нет целей и задач на сегодня.' : 'No goals or tasks for today.');
}

function buildTaskReminderText(
  tasks: { title: string; scheduledTime?: string; date?: string }[],
  lang: 'ru' | 'en'
): string {
  const ru = lang === 'ru';
  const lines = ru ? ['⏰ Напоминание о задачах:', ''] : ['⏰ Task reminders:', ''];
  tasks.slice(0, 10).forEach((t) => {
    const time = t.scheduledTime ? ` ${t.scheduledTime}` : '';
    const date = t.date ? ` (${t.date})` : '';
    lines.push(`• ${t.title}${time}${date}`);
  });
  return lines.join('\n');
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const auth = req.headers?.authorization || req.query?.secret;
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && auth !== `Bearer ${cronSecret}` && auth !== cronSecret && req.query?.secret !== cronSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return res.status(200).json({ ok: true, message: 'TELEGRAM_BOT_TOKEN not set' });
  }
  if (!blobToken) {
    return res.status(200).json({ ok: true, message: 'BLOB_READ_WRITE_TOKEN not set; no reminders stored' });
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
      const userNow = new Date(now.getTime() + tzOffset * 60 * 1000);
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
        continue;
      }

      if (data.reminderFrequency === 'per_task') {
        const leadMin = data.reminderLeadMinutes ?? 15;
        const currentMinutes = userNow.getHours() * 60 + userNow.getMinutes();
        const windowStart = currentMinutes;
        const windowEnd = currentMinutes + 15;

        const toRemind: { id: string; title: string; scheduledTime?: string; date?: string }[] = [];
        for (const t of data.tasks) {
          if (t.completed || !t.date) continue;
          if (t.date !== todayLocal) continue;
          const taskMin = parseTimeToMinutes(t.scheduledTime);
          if (taskMin == null) continue;
          const reminderAt = taskMin - leadMin;
          if (reminderAt >= windowStart && reminderAt < windowEnd) {
            const sentKey = `${t.id}-${t.date}-${t.scheduledTime || ''}`;
            if (!data.lastTaskReminderSent[sentKey]) {
              toRemind.push({ id: t.id, title: t.title, scheduledTime: t.scheduledTime, date: t.date });
            }
          }
        }

        if (toRemind.length > 0) {
          const text = buildTaskReminderText(toRemind, data.lang);
          const sendRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: telegramId, text: text.slice(0, 4096), disable_web_page_preview: true }),
          });
          if (sendRes.ok) {
            for (const t of toRemind) {
              const sentKey = `${t.id}-${t.date || ''}-${t.scheduledTime || ''}`;
              data.lastTaskReminderSent[sentKey] = new Date().toISOString();
            }
            results.push({ telegramId, task: toRemind.length });
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
