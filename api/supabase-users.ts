/**
 * API для сохранения аккаунтов в Supabase и получения количества пользователей.
 * GET — возвращает { totalCount }.
 * POST — body { username: string, telegramId?: number }, upsert в app_users, возвращает { ok, totalCount }.
 * Env: SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY, либо с префиксом (например supabase_SUPABASE_URL, supabase_SUPABASE_SERVICE_ROLE_KEY от интеграции Vercel).
 */
import { createClient } from '@supabase/supabase-js';

declare const process: { env: { [key: string]: string | undefined } };

function getSupabase() {
  const url =
    process.env.supabase_SUPABASE_URL ||
    process.env.SUPABASE_SUPABASE_URL ||
    process.env.SUPABASE_URL;
  const key =
    process.env.supabase_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET' && req.method !== 'POST')
    return res.status(405).json({ error: 'Method Not Allowed' });

  const supabase = getSupabase();
  if (!supabase) {
    return res.status(200).json({
      ok: false,
      totalCount: 0,
      error: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set',
    });
  }

  try {
    if (req.method === 'GET') {
      const { count, error } = await supabase
        .from('app_users')
        .select('*', { count: 'exact', head: true });
      if (error) {
        console.error('supabase-users GET error:', error);
        return res.status(500).json({ totalCount: 0, error: error.message });
      }
      return res.status(200).json({ totalCount: count ?? 0 });
    }

    // POST: upsert user
    const body = req.body || {};
    const username = typeof body.username === 'string' ? body.username.trim() : '';
    if (!username) {
      return res.status(400).json({ ok: false, error: 'username required' });
    }
    const telegramId =
      body.telegramId != null && Number.isFinite(Number(body.telegramId))
        ? Number(body.telegramId)
        : null;

    const { error: upsertError } = await supabase.from('app_users').upsert(
      {
        username,
        telegram_id: telegramId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'username' }
    );

    if (upsertError) {
      console.error('supabase-users POST upsert error:', upsertError);
      return res.status(500).json({ ok: false, error: upsertError.message });
    }

    const { count, error: countError } = await supabase
      .from('app_users')
      .select('*', { count: 'exact', head: true });
    if (countError) {
      return res.status(200).json({ ok: true, totalCount: 0 });
    }
    return res.status(200).json({ ok: true, totalCount: count ?? 0 });
  } catch (e: any) {
    console.error('supabase-users error:', e);
    return res.status(500).json({
      ok: false,
      totalCount: 0,
      error: e.message || 'Internal error',
    });
  }
}
