/**
 * Активация промокода. Один код — одно использование одним пользователем.
 * POST body: { code: string, username: string }
 * Ответ: { ok, subscriptionType?, subscriptionExpiresAt?, error? }
 * Коды: 10 безлимит, 10 на месяц, 10 на неделю. Хранение активаций: Supabase (app_users.promo_code_used, subscription_type, subscription_expires_at).
 */
declare const process: { env: Record<string, string | undefined } };

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

function getEnv(name: string): string | undefined {
  try {
    const env = process.env;
    return env[name] ?? env[name.toUpperCase()] ?? env[name.toLowerCase()];
  } catch {
    return undefined;
  }
}

function getSupabaseConfig(): { url: string; key: string } | { url: null; key: null; error: string } {
  const url =
    getEnv('supabase_SUPABASE_URL') ||
    getEnv('SUPABASE_SUPABASE_URL') ||
    getEnv('SUPABASE_URL');
  const key =
    getEnv('supabase_SUPABASE_SERVICE_ROLE_KEY') ||
    getEnv('SUPABASE_SUPABASE_SERVICE_ROLE_KEY') ||
    getEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) {
    return { url: null, key: null, error: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set' };
  }
  return { url, key };
}

const restHeaders = (key: string) => ({
  apikey: key,
  Authorization: `Bearer ${key}`,
  'Content-Type': 'application/json',
});

/** Проверка: использован ли уже этот промокод кем-либо (в т.ч. этим пользователем). */
async function isCodeAlreadyUsed(
  url: string,
  key: string,
  code: string
): Promise<{ used: boolean; error?: string }> {
  try {
    const enc = encodeURIComponent(code);
    const res = await fetch(
      `${url}/rest/v1/app_users?promo_code_used=eq.${enc}&select=username`,
      { method: 'GET', headers: { ...restHeaders(key) } }
    );
    if (!res.ok) {
      const text = await res.text();
      return { used: false, error: text || res.statusText };
    }
    const data = await res.json();
    const rows = Array.isArray(data) ? data : [];
    return { used: rows.length > 0 };
  } catch (e: any) {
    return { used: false, error: e?.message || String(e) };
  }
}

/** Записать промокод и подписку пользователю по username. */
async function setUserPromo(
  url: string,
  key: string,
  username: string,
  payload: { promo_code_used: string; subscription_type: string; subscription_expires_at: string | null }
): Promise<{ error?: string }> {
  try {
    const enc = encodeURIComponent(username);
    const res = await fetch(`${url}/rest/v1/app_users?username=eq.${enc}`, {
      method: 'PATCH',
      headers: { ...restHeaders(key) },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text();
      return { error: text || res.statusText };
    }
    return {};
  } catch (e: any) {
    return { error: e?.message || String(e) };
  }
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

    const config = getSupabaseConfig();
    if ('error' in config) {
      return res.status(500).json({ ok: false, error: config.error });
    }

    const { url, key } = config;

    const { used, error: checkErr } = await isCodeAlreadyUsed(url, key, code);
    if (checkErr) {
      console.error('promo-redeem check error:', checkErr);
      return res.status(500).json({ ok: false, error: 'Database error' });
    }
    if (used) {
      return res.status(200).json({
        ok: false,
        error: 'code_already_used',
        message: 'Этот промокод уже был использован.',
      });
    }

    const subscriptionExpiresAt =
      subscriptionType === 'unlimited' ? null : getExpiresAt(subscriptionType);

    const { error: patchErr } = await setUserPromo(url, key, username, {
      promo_code_used: code,
      subscription_type: subscriptionType,
      subscription_expires_at: subscriptionExpiresAt,
    });

    if (patchErr) {
      // Уникальный индекс: если код уже занят другим пользователем между check и patch
      if (patchErr.includes('duplicate') || patchErr.includes('unique')) {
        return res.status(200).json({
          ok: false,
          error: 'code_already_used',
          message: 'Этот промокод уже был использован.',
        });
      }
      console.error('promo-redeem patch error:', patchErr);
      return res.status(500).json({ ok: false, error: 'Failed to save promo' });
    }

    return res.status(200).json({
      ok: true,
      subscriptionType,
      subscriptionExpiresAt: subscriptionExpiresAt ?? undefined,
    });
  } catch (e: any) {
    console.error('promo-redeem error:', e);
    return res.status(500).json({ ok: false, error: e.message || 'Internal error' });
  }
}
