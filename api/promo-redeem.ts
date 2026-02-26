/**
 * Активация промокода. Один код — одно использование одним пользователем.
 * POST body: { code: string, username: string }
 * Ответ: { ok, subscriptionType?, subscriptionExpiresAt?, error? }
 * Коды: 10 безлимит, 10 на месяц, 10 на неделю. Хранение активаций: Vercel Blob (promo-redemptions.json).
 */
import { list, put } from '@vercel/blob';
declare const process: { env: { [key: string]: string | undefined } };

const PROMO_CODES: { code: string; type: 'unlimited' | 'month' | 'week' }[] = [
  // 10 безлимит
  { code: 'FOG8XK7M2N', type: 'unlimited' },
  { code: 'FOG9R4T6VWY', type: 'unlimited' },
  { code: 'FOG1I9J0KL2', type: 'unlimited' },
  { code: 'FOG3M4O5P6Q', type: 'unlimited' },
  { code: 'FOG7R8S9T0U', type: 'unlimited' },
  { code: 'FOG2V3W4X5Y', type: 'unlimited' },
  { code: 'FOG6Z7A8B9C', type: 'unlimited' },
  { code: 'FOG0D1E2F3G', type: 'unlimited' },
  { code: 'FOG4H5I6J7K', type: 'unlimited' },
  { code: 'FOG8L9M0N1O', type: 'unlimited' },
  // 10 на месяц
  { code: 'FOGP2Q3R4S5', type: 'month' },
  { code: 'FOGT6U7V8W9', type: 'month' },
  { code: 'FOGX0Y1Z2A3', type: 'month' },
  { code: 'FOGB4C5D6E7', type: 'month' },
  { code: 'FOGF8G9H0I1', type: 'month' },
  { code: 'FOGJ2K3L4M5', type: 'month' },
  { code: 'FOGN6O7P8Q9', type: 'month' },
  { code: 'FOGR0S1T2U3', type: 'month' },
  { code: 'FOGV4W5X6Y7', type: 'month' },
  { code: 'FOGZ8A9B0C1', type: 'month' },
  // 10 на неделю
  { code: 'FOGD2E3F4G5', type: 'week' },
  { code: 'FOGH6I7J8K9', type: 'week' },
  { code: 'FOGL0M1N2O3', type: 'week' },
  { code: 'FOGP4Q5R6S7', type: 'week' },
  { code: 'FOGT8U9V0W1', type: 'week' },
  { code: 'FOGX2Y3Z4A5', type: 'week' },
  { code: 'FOGB6C7D8E9', type: 'week' },
  { code: 'FOGF0G1H2I3', type: 'week' },
  { code: 'FOGJ4K5L6M7', type: 'week' },
  { code: 'FOGN8O9P0Q1', type: 'week' },
];

const CODE_MAP = new Map(PROMO_CODES.map((p) => [p.code.toUpperCase().trim(), p.type]));

interface RedemptionsStore {
  [code: string]: { usedBy: string; usedAt: string };
}

function getExpiresAt(type: 'month' | 'week'): string {
  const d = new Date();
  if (type === 'month') d.setMonth(d.getMonth() + 1);
  else d.setDate(d.getDate() + 7);
  return d.toISOString();
}

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const body = req.body as { code?: string; username?: string };
    const code = typeof body?.code === 'string' ? body.code.trim().toUpperCase() : '';
    const username = typeof body?.username === 'string' ? body.username.trim() : '';

    if (!code || !username) {
      return res.status(400).json({ ok: false, error: 'code and username required' });
    }

    const subscriptionType = CODE_MAP.get(code);
    if (!subscriptionType) {
      return res.status(200).json({ ok: false, error: 'invalid_code' });
    }

    const token = process.env.REMINDERS_READ_WRITE_TOKEN;
    if (!token) {
      return res.status(500).json({ ok: false, error: 'Blob not configured' });
    }

    const blobPath = 'promo-redemptions.json';
    let redemptions: RedemptionsStore = {};

    try {
      const { blobs } = await list({ prefix: 'promo-redemptions', limit: 10, token });
      const existing = blobs?.find((b) => b.pathname === blobPath);
      if (existing?.url) {
        const r = await fetch(existing.url);
        if (r.ok) redemptions = await r.json();
      }
    } catch {
      // no file yet
    }

    if (redemptions[code]) {
      return res.status(200).json({
        ok: false,
        error: 'code_already_used',
        message: 'Этот промокод уже был использован.',
      });
    }

    redemptions[code] = { usedBy: username, usedAt: new Date().toISOString() };

    await put(blobPath, JSON.stringify(redemptions), { access: 'public', token });

    const subscriptionExpiresAt =
      subscriptionType === 'unlimited' ? undefined : getExpiresAt(subscriptionType);

    return res.status(200).json({
      ok: true,
      subscriptionType,
      subscriptionExpiresAt,
    });
  } catch (e: any) {
    console.error('promo-redeem error:', e);
    return res.status(500).json({ ok: false, error: e.message || 'Internal error' });
  }
}
