/**
 * API для сохранения аккаунтов в Supabase и получения количества пользователей.
 * GET — возвращает { totalCount }. GET ?debug=1 — диагностика (hasUrl, hasKey, error если есть).
 * POST — body { username: string, telegramId?: number }, upsert в app_users.
 * Env: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY или с префиксом supabase_ (Vercel интеграция).
 */
import { createClient } from '@supabase/supabase-js';

declare const process: { env: { [key: string]: string | undefined } };

function getEnv(name: string): string | undefined {
  const env = process.env;
  return env[name] ?? env[name.toUpperCase()] ?? env[name.toLowerCase()];
}

function getSupabase(): ReturnType<typeof createClient> | null {
  const url =
    getEnv('supabase_SUPABASE_URL') ||
    getEnv('SUPABASE_SUPABASE_URL') ||
    getEnv('SUPABASE_URL');
  const key =
    getEnv('supabase_SUPABASE_SERVICE_ROLE_KEY') ||
    getEnv('SUPABASE_SUPABASE_SERVICE_ROLE_KEY') ||
    getEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return null;
  return createClient(url, key);
}

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET' && req.method !== 'POST')
    return res.status(405).json({ error: 'Method Not Allowed' });

  const supabase = getSupabase();

  // GET ?debug=1 — диагностика без выдачи секретов
  if (req.method === 'GET' && req.query?.debug === '1') {
    const hasUrl = !!(getEnv('supabase_SUPABASE_URL') || getEnv('SUPABASE_SUPABASE_URL') || getEnv('SUPABASE_URL'));
    const hasKey = !!(getEnv('supabase_SUPABASE_SERVICE_ROLE_KEY') || getEnv('SUPABASE_SUPABASE_SERVICE_ROLE_KEY') || getEnv('SUPABASE_SERVICE_ROLE_KEY'));
    return res.status(200).json({
      ok: !!supabase,
      hasUrl,
      hasKey,
      message: supabase ? 'Supabase client OK' : 'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel',
    });
  }

  if (!supabase) {
    return res.status(200).json({
      ok: false,
      totalCount: 0,
      error: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set. Add in Vercel → Settings → Environment Variables.',
    });
  }

  try {
    if (req.method === 'GET') {
      const { count, error } = await supabase
        .from('app_users')
        .select('*', { count: 'exact', head: true });
      if (error) {
        console.error('[supabase-users] GET error:', error.message);
        return res.status(500).json({ totalCount: 0, error: error.message });
      }
      return res.status(200).json({ totalCount: count ?? 0 });
    }

    // POST: upsert user
    const body = typeof req.body === 'string' ? (() => { try { return JSON.parse(req.body); } catch { return {}; } })() : (req.body || {});
    const username = typeof body.username === 'string' ? body.username.trim() : '';
    if (!username) {
      return res.status(400).json({ ok: false, error: 'username required' });
    }
    const telegramId =
      body.telegramId != null && Number.isFinite(Number(body.telegramId))
        ? Number(body.telegramId)
        : null;

    const row = {
      username,
      telegram_id: telegramId,
      updated_at: new Date().toISOString(),
    };

    const { error: upsertError } = await supabase
      .from('app_users')
      .upsert(row, { onConflict: 'username' });

    if (upsertError) {
      console.error('[supabase-users] POST upsert error:', upsertError.message, 'payload:', username);
      return res.status(500).json({ ok: false, error: upsertError.message });
    }

    const { count, error: countError } = await supabase
      .from('app_users')
      .select('*', { count: 'exact', head: true });
    if (countError) {
      return res.status(200).json({ ok: true, totalCount: 0, saved: true });
    }
    return res.status(200).json({ ok: true, totalCount: count ?? 0, saved: true });
  } catch (e: any) {
    console.error('[supabase-users] error:', e?.message || e);
    return res.status(500).json({
      ok: false,
      totalCount: 0,
      error: e?.message || 'Internal error',
    });
  }
}
