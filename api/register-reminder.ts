/**
 * POST: register reminder preferences. Body: { telegramId, time "HH:mm", frequency, enabled }.
 * Saves to Upstash Redis if KV_REST_API_URL + KV_REST_API_TOKEN are set; else just returns success.
 * App profile (localStorage) is already updated by the frontend.
 */
declare const process: { env: { [key: string]: string | undefined } };

const KEY = 'fogoal_reminder_subs';

interface Sub {
  telegramId: number;
  time: string;
  frequency: 'daily' | 'weekdays' | 'weekends';
  enabled: boolean;
}

async function getStore(): Promise<Sub[]> {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return [];
  try {
    const res = await fetch(`${url}/get/${KEY}`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    const raw = data?.result;
    if (!raw) return [];
    const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

async function setStore(subs: Sub[]): Promise<void> {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return;
  await fetch(`${url}/set/${KEY}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(subs),
  });
}

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { telegramId, time, frequency, enabled } = req.body || {};
    if (telegramId == null || !time || !frequency) {
      return res.status(400).json({ error: 'telegramId, time, frequency required.' });
    }
    const sub: Sub = {
      telegramId: Number(telegramId),
      time: String(time).slice(0, 5),
      frequency: ['daily', 'weekdays', 'weekends'].includes(frequency) ? frequency : 'daily',
      enabled: !!enabled,
    };
    const subs = await getStore();
    const next = subs.filter((s) => s.telegramId !== sub.telegramId);
    if (sub.enabled) next.push(sub);
    await setStore(next);
    return res.status(200).json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Internal Server Error' });
  }
}
