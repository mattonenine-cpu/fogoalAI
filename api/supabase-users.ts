/**
 * API для сохранения аккаунтов в Supabase и получения количества пользователей.
 * GET — { totalCount }. GET ?debug=1 — диагностика. POST — upsert в app_users.
 * Использует только fetch() к Supabase REST API — без пакета @supabase/supabase-js (чтобы работало на Vercel).
 */
declare const process: { env: { [key: string]: string | undefined } };

const sendJson = (res: any, status: number, data: object) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(status).end(JSON.stringify(data));
};

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
  if (!url || !key) return { url: null, key: null, error: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set in Vercel' };
  return { url, key };
}

const restHeaders = (key: string) => ({
  apikey: key,
  Authorization: `Bearer ${key}`,
  'Content-Type': 'application/json',
});

/** GET count через Supabase REST API (Prefer: count=exact → Content-Range). */
async function fetchCount(url: string, key: string): Promise<{ count: number; error?: string }> {
  try {
    const res = await fetch(`${url}/rest/v1/app_users?select=id`, {
      method: 'GET',
      headers: { ...restHeaders(key), Prefer: 'count=exact' },
    });
    if (!res.ok) {
      const text = await res.text();
      return { count: 0, error: text || res.statusText };
    }
    const range = res.headers.get('content-range');
    if (range) {
      const m = range.match(/\/(\d+)$/);
      if (m) return { count: parseInt(m[1], 10) };
    }
    return { count: 0 };
  } catch (e: any) {
    return { count: 0, error: e?.message || String(e) };
  }
}

/** POST upsert через Supabase REST API (Prefer: resolution=merge-duplicates, on_conflict=username). */
async function upsertUser(
  url: string,
  key: string,
  row: { username: string; telegram_id: number | null; updated_at: string }
): Promise<{ error?: string }> {
  try {
    const res = await fetch(`${url}/rest/v1/app_users?on_conflict=username`, {
      method: 'POST',
      headers: { ...restHeaders(key), Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(row),
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

export default async function handler(req: any, res: any) {
  try {
    if (req.method === 'OPTIONS') {
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).end();
    }
    if (req.method !== 'GET' && req.method !== 'POST') {
      sendJson(res, 405, { error: 'Method Not Allowed' });
      return;
    }

    const config = getSupabaseConfig();

    if (req.method === 'GET' && req.query?.debug === '1') {
      const hasUrl = !!(getEnv('supabase_SUPABASE_URL') || getEnv('SUPABASE_SUPABASE_URL') || getEnv('SUPABASE_URL'));
      const hasKey = !!(getEnv('supabase_SUPABASE_SERVICE_ROLE_KEY') || getEnv('SUPABASE_SUPABASE_SERVICE_ROLE_KEY') || getEnv('SUPABASE_SERVICE_ROLE_KEY'));
      const ok = !('error' in config);
      sendJson(res, 200, {
        ok,
        hasUrl,
        hasKey,
        message: ok ? 'OK' : (config.error || 'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel'),
        error: 'error' in config ? config.error : undefined,
      });
      return;
    }

    if ('error' in config) {
      sendJson(res, 200, { ok: false, totalCount: 0, error: config.error });
      return;
    }

    const { url, key } = config;

    if (req.method === 'GET') {
      const { count, error } = await fetchCount(url, key);
      if (error) {
        console.error('[supabase-users] GET error:', error);
        sendJson(res, 500, { totalCount: 0, error });
        return;
      }
      sendJson(res, 200, { totalCount: count });
      return;
    }

    // POST
    let body: { username?: string; telegramId?: number } = {};
    try {
      body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    } catch {
      body = {};
    }
    const username = typeof body.username === 'string' ? body.username.trim() : '';
    if (!username) {
      sendJson(res, 400, { ok: false, error: 'username required' });
      return;
    }
    const telegramId = body.telegramId != null && Number.isFinite(Number(body.telegramId)) ? Number(body.telegramId) : null;

    const row = { username, telegram_id: telegramId, updated_at: new Date().toISOString() };
    const { error: upsertErr } = await upsertUser(url, key, row);

    if (upsertErr) {
      console.error('[supabase-users] upsert error:', upsertErr);
      sendJson(res, 500, { ok: false, error: upsertErr });
      return;
    }

    const { count } = await fetchCount(url, key);
    sendJson(res, 200, { ok: true, totalCount: count, saved: true });
  } catch (e: any) {
    console.error('[supabase-users] handler error:', e?.message || e);
    sendJson(res, 500, { ok: false, totalCount: 0, error: String(e?.message || 'Internal error') });
  }
}
