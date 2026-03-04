declare const process: { env: { [key: string]: string | undefined } };

const BONUS_AMOUNT = 500;

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

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const inviter = typeof body.inviter === 'string' ? body.inviter.trim() : '';
    const invitee = typeof body.invitee === 'string' ? body.invitee.trim() : '';

    if (!inviter || !invitee) {
      return res.status(400).json({ ok: false, error: 'inviter and invitee required' });
    }
    if (inviter.toLowerCase() === invitee.toLowerCase()) {
      return res.status(200).json({ ok: false, error: 'self_referral_not_allowed' });
    }

    const config = getSupabaseConfig();
    if ('error' in config) {
      return res.status(500).json({ ok: false, error: config.error });
    }
    const { url, key } = config;

    const encInviter = encodeURIComponent(inviter);
    const getRes = await fetch(
      `${url}/rest/v1/app_users?username=eq.${encInviter}&select=user_data`,
      { method: 'GET', headers: { ...restHeaders(key) } }
    );
    if (!getRes.ok) {
      const text = await getRes.text();
      return res.status(500).json({ ok: false, error: text || getRes.statusText });
    }
    const rows = await getRes.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(200).json({ ok: false, error: 'inviter_not_found' });
    }

    const currentUserData = rows[0]?.user_data ?? null;
    if (currentUserData == null || typeof currentUserData !== 'object' || Array.isArray(currentUserData)) {
      return res.status(200).json({ ok: false, error: 'no_user_data' });
    }

    const userData: any = { ...(currentUserData as any) };
    const profile = (userData.profile && typeof userData.profile === 'object')
      ? { ...(userData.profile as any) }
      : {};

    const referralInvitees: string[] = Array.isArray(profile.referralInvitees)
      ? [...profile.referralInvitees]
      : [];

    const alreadyGotBonus = referralInvitees.some(
      (u) => String(u).toLowerCase() === invitee.toLowerCase()
    );
    if (alreadyGotBonus) {
      return res.status(200).json({ ok: false, error: 'bonus_already_applied' });
    }

    const creditsRaw = profile.credits && typeof profile.credits === 'object'
      ? { ...(profile.credits as any) }
      : null;

    const credits = creditsRaw ?? {
      totalCredits: 1000,
      availableCredits: 1000,
      usedCredits: 0,
      lastResetDate: new Date().toISOString(),
      hasUnlimitedAccess: false,
    };

    credits.totalCredits = (credits.totalCredits || 0) + BONUS_AMOUNT;
    credits.availableCredits = (credits.availableCredits || 0) + BONUS_AMOUNT;

    profile.credits = credits;
    referralInvitees.push(invitee);
    profile.referralInvitees = referralInvitees;
    userData.profile = profile;

    const patchRes = await fetch(
      `${url}/rest/v1/app_users?username=eq.${encInviter}`,
      {
        method: 'PATCH',
        headers: { ...restHeaders(key) },
        body: JSON.stringify({ user_data: userData, updated_at: new Date().toISOString() }),
      }
    );
    if (!patchRes.ok) {
      const text = await patchRes.text();
      return res.status(500).json({ ok: false, error: text || patchRes.statusText });
    }

    return res.status(200).json({ ok: true, inviterBonus: BONUS_AMOUNT });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || 'Internal error' });
  }
}

