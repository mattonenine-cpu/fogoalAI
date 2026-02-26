/**
 * Сохраняет настройки напоминаний и снимок задач/целей для крон-напоминаний.
 * POST body: { telegramId, reminderFrequency, reminderHour, tasks, goals, lang, timezoneOffset }
 * Хранилище: Vercel Blob (reminders/<telegramId>.json). Если REMINDERS_READ_WRITE_TOKEN не задан — возвращаем ok, но данные не сохраняются.
 */
import { put, del } from '@vercel/blob';
declare const process: { env: { [key: string]: string | undefined } };

interface SyncPayload {
  telegramId: number;
  reminderFrequency: 'off' | 'daily';
  reminderHour: number;
  tasks: { id: string; title: string; date?: string; scheduledTime?: string; completed: boolean }[];
  goals: { id: string; title: string; progress: number; target: number; completed: boolean }[];
  lang: 'ru' | 'en';
  timezoneOffset: number;
}

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const body = req.body as SyncPayload;
    const { telegramId, reminderFrequency, reminderHour, tasks, goals, lang, timezoneOffset } = body || {};
    if (telegramId == null || !Number.isFinite(Number(telegramId))) {
      return res.status(400).json({ ok: false, error: 'telegramId required' });
    }
    const id = Number(telegramId);

    if (reminderFrequency === 'off') {
      try {
        await del(`reminders/${id}.json`, { token: process.env.REMINDERS_READ_WRITE_TOKEN });
      } catch {
        // ignore
      }
      return res.status(200).json({ ok: true });
    }

    const hour = typeof reminderHour === 'number' && reminderHour >= 0 && reminderHour <= 23 ? reminderHour : 12;
    const payload = {
      telegramId: id,
      reminderFrequency,
      reminderHour: hour,
      tasks: Array.isArray(tasks) ? tasks : [],
      goals: Array.isArray(goals) ? goals : [],
      lang: lang || 'ru',
      timezoneOffset: typeof timezoneOffset === 'number' ? timezoneOffset : 0,
      updatedAt: new Date().toISOString(),
      lastDailySentDate: null as string | null,
    };

    const token = process.env.REMINDERS_READ_WRITE_TOKEN;
    if (!token) {
      return res.status(200).json({ ok: true, hint: 'REMINDERS_READ_WRITE_TOKEN not set; reminders will not run until Blob is configured.' });
    }

    await put(`reminders/${id}.json`, JSON.stringify(payload), { access: 'public', token: process.env.REMINDERS_READ_WRITE_TOKEN });
    return res.status(200).json({ ok: true });
  } catch (e: any) {
    console.error('telegram-reminders-sync error:', e);
    return res.status(500).json({ ok: false, error: e.message || 'Internal error' });
  }
}
