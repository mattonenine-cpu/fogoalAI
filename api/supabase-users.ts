/**
 * API для сохранения аккаунтов в Supabase и получения количества пользователей.
 * GET — { totalCount }. GET ?debug=1 — диагностика. POST — upsert в app_users.
 * Динамический импорт Supabase, чтобы при ошибке загрузки модуля функция не падала.
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

/** Динамически загружает Supabase и создаёт клиент. При любой ошибке возвращает null. */
async function getSupabase(): Promise<any> {
  try {
    const url =
      getEnv('supabase_SUPABASE_URL') ||
      getEnv('SUPABASE_SUPABASE_URL') ||
      getEnv('SUPABASE_URL');
    const key =
      getEnv('supabase_SUPABASE_SERVICE_ROLE_KEY') ||
      getEnv('SUPABASE_SUPABASE_SERVICE_ROLE_KEY') ||
      getEnv('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) return null;
    const { createClient } = await import('@supabase/supabase-js');
    return createClient(url, key);
  } catch (e) {
    console.error('[supabase-users] getSupabase failed:', e);
    return null;
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

    const supabase = await getSupabase();

    if (req.method === 'GET' && req.query?.debug === '1') {
      const hasUrl = !!(getEnv('supabase_SUPABASE_URL') || getEnv('SUPABASE_SUPABASE_URL') || getEnv('SUPABASE_URL'));
      const hasKey = !!(getEnv('supabase_SUPABASE_SERVICE_ROLE_KEY') || getEnv('SUPABASE_SUPABASE_SERVICE_ROLE_KEY') || getEnv('SUPABASE_SERVICE_ROLE_KEY'));
      sendJson(res, 200, { ok: !!supabase, hasUrl, hasKey, message: supabase ? 'OK' : 'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel' });
      return;
    }

    if (!supabase) {
      sendJson(res, 200, { ok: false, totalCount: 0, error: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set or Supabase module failed to load.' });
      return;
    }

    if (req.method === 'GET') {
      const { count, error } = await supabase.from('app_users').select('*', { count: 'exact', head: true });
      if (error) {
        console.error('[supabase-users] GET error:', error.message);
        sendJson(res, 500, { totalCount: 0, error: error.message });
        return;
      }
      sendJson(res, 200, { totalCount: count ?? 0 });
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

    const { error: upsertError } = await supabase
      .from('app_users')
      .upsert({ username, telegram_id: telegramId, updated_at: new Date().toISOString() }, { onConflict: 'username' });

    if (upsertError) {
      console.error('[supabase-users] upsert error:', upsertError.message, 'code:', (upsertError as any).code);
      sendJson(res, 500, { ok: false, error: upsertError.message });
      return;
    }

    const { count, error: countError } = await supabase.from('app_users').select('*', { count: 'exact', head: true });
    sendJson(res, 200, { ok: true, totalCount: countError ? 0 : (count ?? 0), saved: true });
  } catch (e: any) {
    console.error('[supabase-users] handler error:', e?.message || e);
    sendJson(res, 500, { ok: false, totalCount: 0, error: String(e?.message || 'Internal error') });
  }
}
