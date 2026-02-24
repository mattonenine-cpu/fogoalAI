
import { UserProfile, Task, Note, NoteFolder, DailyStats } from '../types';

export interface UserDataPayload {
    profile: UserProfile;
    tasks: Task[];
    notes: Note[];
    folders: NoteFolder[];
    stats: DailyStats;
}

/** Данные пользователя из Telegram (Login Widget callback или WebApp initData) */
export interface TelegramAuthPayload {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    photo_url?: string;
    auth_date?: number;
    hash?: string;
}

const TELEGRAM_INDEX_KEY = 'focu_telegram_index'; // telegramId -> app username

// SIMULATED DATABASE DELAY
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

const safeSave = (key: string, data: string) => {
    try {
        localStorage.setItem(key, data);
    } catch (e) {
        console.warn("Storage quota exceeded in authService");
    }
};

const getTelegramIndex = (): Record<string, string> => {
    try {
        const raw = localStorage.getItem(TELEGRAM_INDEX_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
};

const setTelegramIndex = (index: Record<string, string>) => {
    safeSave(TELEGRAM_INDEX_KEY, JSON.stringify(index));
};

/** URL API для Supabase (тот же хост, чтобы в проде запрос шёл на Vercel). */
function getSupabaseUsersApiUrl(): string {
    if (typeof window !== 'undefined' && window.location?.origin)
        return `${window.location.origin}/api/supabase-users`;
    return '/api/supabase-users';
}

/** Парсит ответ как JSON; при ошибке (например HTML от 500) не бросает. */
function parseJsonResponse(res: Response): Promise<Record<string, unknown> | null> {
    return res.text().then((text) => {
        try {
            return text ? (JSON.parse(text) as Record<string, unknown>) : null;
        } catch {
            return null;
        }
    });
}

const PBKDF2_ITERATIONS = 100000;
const PBKDF2_LENGTH = 32;

/** Хеш пароля на клиенте (Web Crypto), чтобы API не использовал Node — тогда билд на Vercel проходит. */
async function hashPasswordClient(password: string, username: string): Promise<string> {
    const enc = new TextEncoder();
    const salt = enc.encode(username + ':fogoal');
    const key = await crypto.subtle.importKey('raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
        key,
        PBKDF2_LENGTH * 8
    );
    return btoa(String.fromCharCode(...new Uint8Array(bits)));
}

/** Тело запроса: username, опционально telegramId и passwordHash (хеш пароля с клиента). */
function buildSupabaseSyncBody(username: string, telegramId?: number, passwordHash?: string): string {
    const body: Record<string, unknown> = { username };
    if (telegramId != null) body.telegramId = telegramId;
    if (passwordHash != null && passwordHash !== '') body.passwordHash = passwordHash;
    return JSON.stringify(body);
}

/** Отправляет аккаунт в Supabase (учёт + хеш пароля при регистрации). Не блокирует авторизацию. */
function syncUserToSupabase(username: string, telegramId?: number, passwordHash?: string): void {
    const url = getSupabaseUsersApiUrl();
    fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: buildSupabaseSyncBody(username, telegramId, passwordHash),
    })
        .then(async (res) => {
            if (!res.ok && typeof console !== 'undefined' && console.warn)
                console.warn('[Supabase] sync user failed:', res.status, url);
            return parseJsonResponse(res);
        })
        .then((data) => {
            if (data && !data.ok && typeof console !== 'undefined' && console.warn)
                console.warn('[Supabase] sync user error:', data.error);
        })
        .catch((err) => {
            if (typeof console !== 'undefined' && console.warn)
                console.warn('[Supabase] sync user request failed:', err?.message || err);
        });
}

/** То же, но с ожиданием ответа (для регистрации: чтобы убедиться, что пароль сохранён). */
async function syncUserToSupabaseAndWait(username: string, telegramId?: number, passwordHash?: string): Promise<{ ok: boolean; error?: string }> {
    const url = getSupabaseUsersApiUrl();
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: buildSupabaseSyncBody(username, telegramId, passwordHash),
        });
        const data = await parseJsonResponse(res);
        if (!res.ok) return { ok: false, error: (data?.error as string) || res.statusText };
        if (data && data.ok === false) return { ok: false, error: (data.error as string) || 'Unknown error' };
        return { ok: true };
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return { ok: false, error: msg };
    }
}

export const authService = {
    /**
     * Checks if a user is currently logged in.
     */
    getCurrentUser: (): string | null => {
        return localStorage.getItem('session_user');
    },

    /**
     * Registers a new user.
     * Checks if username exists. If not, creates entry in `cloud_users` and saves initial data.
     */
    register: async (username: string, password: string, initialData: UserDataPayload): Promise<{ success: boolean, message?: string }> => {
        await delay(400);

        const usersRaw = localStorage.getItem('cloud_users');
        const users = usersRaw ? JSON.parse(usersRaw) : {};

        if (users[username]) {
            return { success: false, message: 'exists' };
        }

        // Сначала сохраняем пользователя и хеш пароля в Supabase (хеш считаем на клиенте)
        const passwordHash = await hashPasswordClient(password, username);
        const sync = await syncUserToSupabaseAndWait(username, undefined, passwordHash);
        if (!sync.ok) {
            return { success: false, message: sync.error || 'Не удалось сохранить пароль в облаке' };
        }

        // Save User Creds (локально)
        users[username] = { password, telegramId: undefined as number | undefined };
        safeSave('cloud_users', JSON.stringify(users));

        const userDataKey = `cloud_data_${username}`;
        safeSave(userDataKey, JSON.stringify(initialData));

        safeSave('session_user', username);
        authService.syncToActiveState(initialData);

        return { success: true };
    },

    /**
     * Logs in a user.
     * Verifies credentials and loads their data into the active application state.
     */
    login: async (username: string, password: string): Promise<{ success: boolean, message?: string }> => {
        const apiUrl = getSupabaseUsersApiUrl();
        let verified = false;
        try {
            const passwordHash = await hashPasswordClient(password, username);
            const res = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'login', username, passwordHash }),
            });
            const data = await parseJsonResponse(res);
            verified = data?.ok === true;
        } catch {
            // Fallback: проверка по localStorage (офлайн или API недоступен)
            const usersRaw = localStorage.getItem('cloud_users');
            const users = usersRaw ? JSON.parse(usersRaw) : {};
            verified = !!(users[username] && (users[username] as { password?: string }).password === password);
        }

        if (!verified) {
            return { success: false, message: 'invalid' };
        }

        // Set Session
        safeSave('session_user', username);
        const usersRaw = localStorage.getItem('cloud_users');
        const users = usersRaw ? JSON.parse(usersRaw) : {};
        const telegramId = (users[username] as { telegramId?: number } | undefined)?.telegramId;
        syncUserToSupabase(username, telegramId);

        // Локальный индекс для существующих аккаунтов (чтобы не ломать текущее устройство)
        if (!users[username]) {
            users[username] = { password: '', telegramId: undefined };
            safeSave('cloud_users', JSON.stringify(users));
        }

        // Load Data from "Cloud" (localStorage; на новом устройстве будет пусто)
        const userDataKey = `cloud_data_${username}`;
        const savedDataRaw = localStorage.getItem(userDataKey);
        if (savedDataRaw) {
            try {
                const data: UserDataPayload = JSON.parse(savedDataRaw);
                authService.syncToActiveState(data);
            } catch {
                // ignore
            }
        }

        return { success: true };
    },

    /**
     * Logs out the user.
     * Clears session and active state (security).
     */
    logout: async () => {
        await delay(300);
        localStorage.removeItem('session_user');
        // Clear active state to prevent data leaking to next user
        localStorage.removeItem('focu_profile');
        localStorage.removeItem('focu_tasks');
        localStorage.removeItem('focu_notes');
        localStorage.removeItem('focu_folders');
        localStorage.removeItem('focu_stats');
        localStorage.removeItem('focu_chat_history');
    },

    /**
     * Helper: Takes a full data payload and writes it to the standard localStorage keys
     * that the App components read from.
     */
    syncToActiveState: (data: UserDataPayload) => {
        safeSave('focu_profile', JSON.stringify(data.profile));
        safeSave('focu_tasks', JSON.stringify(data.tasks));
        safeSave('focu_notes', JSON.stringify(data.notes));
        safeSave('focu_folders', JSON.stringify(data.folders));
        safeSave('focu_stats', JSON.stringify(data.stats));
    },

    /**
     * Helper: Takes current active state and saves it to the "Cloud" (namespaced key).
     * Call this whenever data changes in the app.
     */
    syncToCloud: (data: UserDataPayload) => {
        const currentUser = authService.getCurrentUser();
        if (!currentUser) return; // Don't save if no user logged in (guest mode?)

        const userDataKey = `cloud_data_${currentUser}`;
        safeSave(userDataKey, JSON.stringify(data));
    },

    /**
     * Привязать Telegram к текущему аккаунту. Сохраняет telegramId в профиле и в индексе для входа с других устройств.
     */
    linkTelegram: (payload: TelegramAuthPayload): { success: boolean; updatedProfile?: UserProfile } => {
        const currentUser = authService.getCurrentUser();
        if (!currentUser) return { success: false };

        const usersRaw = localStorage.getItem('cloud_users');
        const users = usersRaw ? JSON.parse(usersRaw) : {};
        const telegramIndex = getTelegramIndex();

        // Если этот Telegram уже привязан к другому аккаунту — отвязываем от того
        const existingUser = telegramIndex[String(payload.id)];
        if (existingUser && existingUser !== currentUser) {
            if (users[existingUser]) users[existingUser].telegramId = undefined;
            delete telegramIndex[String(payload.id)];
        }

        users[currentUser] = users[currentUser] || {};
        users[currentUser].telegramId = payload.id;
        telegramIndex[String(payload.id)] = currentUser;
        safeSave('cloud_users', JSON.stringify(users));
        setTelegramIndex(telegramIndex);
        syncUserToSupabase(currentUser, payload.id);

        const userDataKey = `cloud_data_${currentUser}`;
        const savedRaw = localStorage.getItem(userDataKey);
        if (!savedRaw) return { success: true };
        const data: UserDataPayload = JSON.parse(savedRaw);
        const updatedProfile: UserProfile = {
            ...data.profile,
            telegramId: payload.id,
            telegramUsername: payload.username,
            telegramPhotoUrl: payload.photo_url
        };
        data.profile = updatedProfile;
        safeSave(userDataKey, JSON.stringify(data));
        safeSave('focu_profile', JSON.stringify(updatedProfile));
        return { success: true, updatedProfile };
    },

    /**
     * Отвязать Telegram от текущего аккаунта.
     */
    unlinkTelegram: (): { success: boolean; updatedProfile?: UserProfile } => {
        const currentUser = authService.getCurrentUser();
        if (!currentUser) return { success: false };

        const usersRaw = localStorage.getItem('cloud_users');
        const users = usersRaw ? JSON.parse(usersRaw) : {};
        const telegramIndex = getTelegramIndex();
        const oldId = users[currentUser]?.telegramId;
        if (oldId != null) {
            delete telegramIndex[String(oldId)];
            users[currentUser].telegramId = undefined;
            safeSave('cloud_users', JSON.stringify(users));
            setTelegramIndex(telegramIndex);
        }

        const userDataKey = `cloud_data_${currentUser}`;
        const savedRaw = localStorage.getItem(userDataKey);
        if (!savedRaw) return { success: true };
        const data: UserDataPayload = JSON.parse(savedRaw);
        const { telegramId, telegramUsername, telegramPhotoUrl, ...rest } = data.profile;
        const updatedProfile = { ...rest } as UserProfile;
        data.profile = updatedProfile;
        safeSave(userDataKey, JSON.stringify(data));
        safeSave('focu_profile', JSON.stringify(updatedProfile));
        return { success: true, updatedProfile };
    },

    /**
     * Войти по Telegram. Если аккаунт привязан — загружаем данные; иначе needRegister для регистрации через Telegram.
     */
    loginWithTelegram: async (payload: TelegramAuthPayload): Promise<{ success: boolean; needRegister?: boolean; message?: string }> => {
        await delay(500);
        const telegramIndex = getTelegramIndex();
        const username = telegramIndex[String(payload.id)];
        if (!username) {
            return { success: false, needRegister: true };
        }

        const usersRaw = localStorage.getItem('cloud_users');
        const users = usersRaw ? JSON.parse(usersRaw) : {};
        if (!users[username]) return { success: false, needRegister: true };

        safeSave('session_user', username);
        syncUserToSupabase(username, payload.id);
        const userDataKey = `cloud_data_${username}`;
        const savedDataRaw = localStorage.getItem(userDataKey);
        if (savedDataRaw) {
            const data: UserDataPayload = JSON.parse(savedDataRaw);
            authService.syncToActiveState(data);
        } else {
            // Новое устройство: локальных данных нет, подставляем минимальный профиль (при добавлении бэкенда — подгружать с сервера по telegramId)
            const today = new Date().toISOString().split('T')[0];
            const emptyPayload: UserDataPayload = {
                profile: {
                    name: payload.first_name || payload.username || String(payload.id),
                    occupation: '',
                    level: 1,
                    totalExperience: 0,
                    goals: [],
                    bedtime: '23:00',
                    wakeTime: '07:00',
                    activityHistory: [today],
                    energyProfile: { energyPeaks: [], energyDips: [], recoverySpeed: 'average', resistanceTriggers: [] },
                    isOnboarded: false,
                    enabledEcosystems: [
                        { type: 'sport', label: 'Sport', icon: '⚽', enabled: true, justification: 'Fitness and physical activities' },
                        { type: 'study', label: 'Study', icon: '📚', enabled: true, justification: 'Learning and education' },
                        { type: 'health', label: 'Health', icon: '❤️', enabled: true, justification: 'Health monitoring and wellness' },
                    ],
                    statsHistory: [],
                    telegramId: payload.id,
                    telegramUsername: payload.username,
                    telegramPhotoUrl: payload.photo_url,
                    settings: {
                        aiPersona: 'balanced',
                        aiDetailLevel: 'medium',
                        visibleViews: ['dashboard', 'scheduler', 'smart_planner', 'chat', 'notes', 'sport', 'study', 'health'],
                        fontSize: 'normal'
                    }
                },
                tasks: [],
                notes: [],
                folders: [],
                stats: { focusScore: 0, tasksCompleted: 0, streakDays: 0, mood: 'Neutral', sleepHours: 7.5, activityHistory: [], apiRequestsCount: 0, lastRequestDate: today }
            };
            authService.syncToActiveState(emptyPayload);
            safeSave(userDataKey, JSON.stringify(emptyPayload));
        }
        return { success: true };
    },

    /**
     * Регистрация по Telegram: создаёт аккаунт с ключом tg_<id>, без пароля. Прогресс сохраняется под этим аккаунтом.
     */
    registerWithTelegram: async (payload: TelegramAuthPayload, initialData: UserDataPayload): Promise<{ success: boolean; message?: string }> => {
        await delay(500);
        const username = `tg_${payload.id}`;
        const usersRaw = localStorage.getItem('cloud_users');
        const users = usersRaw ? JSON.parse(usersRaw) : {};
        if (users[username]) {
            return { success: false, message: 'exists' };
        }

        const telegramIndex = getTelegramIndex();
        if (telegramIndex[String(payload.id)]) {
            return { success: false, message: 'telegram_linked' }; // уже привязан к другому
        }

        const profileWithTelegram: UserProfile = {
            ...initialData.profile,
            telegramId: payload.id,
            telegramUsername: payload.username,
            telegramPhotoUrl: payload.photo_url,
            name: initialData.profile.name || payload.first_name || payload.username || username
        };
        const dataToSave: UserDataPayload = { ...initialData, profile: profileWithTelegram };

        users[username] = { password: '', telegramId: payload.id };
        telegramIndex[String(payload.id)] = username;
        safeSave('cloud_users', JSON.stringify(users));
        setTelegramIndex(telegramIndex);

        const userDataKey = `cloud_data_${username}`;
        safeSave(userDataKey, JSON.stringify(dataToSave));
        safeSave('session_user', username);
        syncUserToSupabase(username, payload.id);
        authService.syncToActiveState(dataToSave);
        return { success: true };
    }
};
