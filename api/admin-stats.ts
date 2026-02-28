/**
 * API: агрегированная статистика по всем пользователям из Supabase.
 * Доступ только по промокоду разработчика (FOGOAL_DEV_2025).
 * POST body: { promoCode: string } → { ok, totalUsers, aggregated, users }.
 */
declare const process: { env: Record<string, string | undefined> };

const DEV_PROMO = 'FOGOAL_DEV_2025';

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
  const url = getEnv('SUPABASE_URL') || getEnv('SUPABASE_SUPABASE_URL') || getEnv('supabase_SUPABASE_URL');
  const key = getEnv('SUPABASE_SERVICE_ROLE_KEY') || getEnv('SUPABASE_SUPABASE_SERVICE_ROLE_KEY') || getEnv('supabase_SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return { url: null, key: null, error: 'Supabase config missing' };
  return { url, key };
}

const restHeaders = (key: string) => ({
  apikey: key,
  Authorization: `Bearer ${key}`,
  'Content-Type': 'application/json',
});

interface UsageStatsRow {
  opens: Record<string, number>;
  lastOpenedAt: Record<string, string>;
  ecosystem: {
    sport: { workoutsCompleted: number; coachMessages: number };
    study: { examsCreated: number; quizzesCompleted: number; ticketsParsed: number };
    health: { logsSaved: number };
    work: { progressLogs: number; expertChatMessages: number };
  };
  totalChatMessages: number;
  totalTasksCompleted: number;
  totalGoalsCompleted: number;
}

function emptyAggregate(): UsageStatsRow {
  return {
    opens: { dashboard: 0, scheduler: 0, smart_planner: 0, chat: 0, notes: 0, sport: 0, study: 0, health: 0 },
    lastOpenedAt: {},
    ecosystem: {
      sport: { workoutsCompleted: 0, coachMessages: 0 },
      study: { examsCreated: 0, quizzesCompleted: 0, ticketsParsed: 0 },
      health: { logsSaved: 0 },
      work: { progressLogs: 0, expertChatMessages: 0 },
    },
    totalChatMessages: 0,
    totalTasksCompleted: 0,
    totalGoalsCompleted: 0,
  };
}

function addToAggregate(acc: UsageStatsRow, u: UsageStatsRow) {
  const keys = ['dashboard', 'scheduler', 'smart_planner', 'chat', 'notes', 'sport', 'study', 'health'] as const;
  keys.forEach((k) => { acc.opens[k] = (acc.opens[k] || 0) + (u.opens[k] ?? 0); });
  acc.ecosystem.sport.workoutsCompleted += u.ecosystem?.sport?.workoutsCompleted ?? 0;
  acc.ecosystem.sport.coachMessages += u.ecosystem?.sport?.coachMessages ?? 0;
  acc.ecosystem.study.examsCreated += u.ecosystem?.study?.examsCreated ?? 0;
  acc.ecosystem.study.quizzesCompleted += u.ecosystem?.study?.quizzesCompleted ?? 0;
  acc.ecosystem.study.ticketsParsed += u.ecosystem?.study?.ticketsParsed ?? 0;
  acc.ecosystem.health.logsSaved += u.ecosystem?.health?.logsSaved ?? 0;
  acc.ecosystem.work.progressLogs += u.ecosystem?.work?.progressLogs ?? 0;
  acc.ecosystem.work.expertChatMessages += u.ecosystem?.work?.expertChatMessages ?? 0;
  acc.totalChatMessages += u.totalChatMessages ?? 0;
  acc.totalTasksCompleted += u.totalTasksCompleted ?? 0;
  acc.totalGoalsCompleted += u.totalGoalsCompleted ?? 0;
}

function normalizeUsageStats(raw: any): UsageStatsRow {
  const def = emptyAggregate();
  if (!raw || typeof raw !== 'object') return def;
  const opens = { ...def.opens, ...(raw.opens && typeof raw.opens === 'object' ? raw.opens : {}) };
  const ecosystem = {
    sport: { ...def.ecosystem.sport, ...(raw.ecosystem?.sport && typeof raw.ecosystem.sport === 'object' ? raw.ecosystem.sport : {}) },
    study: { ...def.ecosystem.study, ...(raw.ecosystem?.study && typeof raw.ecosystem.study === 'object' ? raw.ecosystem.study : {}) },
    health: { ...def.ecosystem.health, ...(raw.ecosystem?.health && typeof raw.ecosystem.health === 'object' ? raw.ecosystem.health : {}) },
    work: { ...def.ecosystem.work, ...(raw.ecosystem?.work && typeof raw.ecosystem.work === 'object' ? raw.ecosystem.work : {}) },
  };
  return {
    opens,
    lastOpenedAt: raw.lastOpenedAt && typeof raw.lastOpenedAt === 'object' ? raw.lastOpenedAt : {},
    ecosystem,
    totalChatMessages: typeof raw.totalChatMessages === 'number' ? raw.totalChatMessages : 0,
    totalTasksCompleted: typeof raw.totalTasksCompleted === 'number' ? raw.totalTasksCompleted : 0,
    totalGoalsCompleted: typeof raw.totalGoalsCompleted === 'number' ? raw.totalGoalsCompleted : 0,
  };
}

export default async function handler(req: any, res: any) {
  try {
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      return res.status(200).end();
    }
    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'Method Not Allowed' });
      return;
    }

    let body: { promoCode?: string } = {};
    try {
      body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    } catch {
      sendJson(res, 400, { ok: false, error: 'Invalid JSON' });
      return;
    }
    const promoCode = typeof body.promoCode === 'string' ? body.promoCode.trim() : '';
    if (promoCode !== DEV_PROMO) {
      sendJson(res, 403, { ok: false, error: 'Forbidden' });
      return;
    }

    const config = getSupabaseConfig();
    if ('error' in config) {
      sendJson(res, 500, { ok: false, error: config.error });
      return;
    }
    const { url, key } = config;

    const resFetch = await fetch(`${url}/rest/v1/app_users?select=username,user_data`, {
      method: 'GET',
      headers: { ...restHeaders(key), Range: '0-1999' },
    });
    if (!resFetch.ok) {
      sendJson(res, 500, { ok: false, error: resFetch.statusText || 'Supabase error' });
      return;
    }
    const rows: { username: string; user_data: any }[] = await resFetch.json();
    const aggregated = emptyAggregate();
    const users: { username: string; displayName: string; usageStats: UsageStatsRow }[] = [];

    for (const row of rows || []) {
      const username = row?.username;
      if (!username) continue;
      const ud = row.user_data;
      const profile = ud && typeof ud === 'object' ? ud.profile : null;
      const usageStats = normalizeUsageStats(profile?.usageStats);
      const telegramUsername = profile?.telegramUsername && typeof profile.telegramUsername === 'string' ? profile.telegramUsername.trim() : null;
      const name = profile?.name && typeof profile.name === 'string' ? profile.name.trim() : null;
      const displayName = telegramUsername ? (telegramUsername.startsWith('@') ? telegramUsername : `@${telegramUsername}`) : (name || String(username));
      users.push({ username: String(username), displayName, usageStats });
      addToAggregate(aggregated, usageStats);
    }

    sendJson(res, 200, {
      ok: true,
      totalUsers: users.length,
      aggregated,
      users,
    });
  } catch (e: any) {
    console.error('[admin-stats]', e?.message || e);
    sendJson(res, 500, { ok: false, error: String(e?.message || 'Internal error') });
  }
}

