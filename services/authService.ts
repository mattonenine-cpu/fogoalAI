
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
const SYNC_HASH_KEY = 'focu_sync_hash'; // sessionStorage: хеш пароля для сохранения данных в Supabase (только на время сессии)

function getSyncHash(): string | null {
    try {
        return typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(SYNC_HASH_KEY) : null;
    } catch { return null; }
}

function setSyncHash(hash: string): void {
    try {
        if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(SYNC_HASH_KEY, hash);
    } catch { /* ignore */ }
}

function clearSyncHash(): void {
    try {
        if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(SYNC_HASH_KEY);
    } catch { /* ignore */ }
}

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
const TELEGRAM_PASSWORD_SEED = 'tg_auto';

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

/** Детеминированный хеш для Telegram-аккаунтов (чтобы между устройствами использовался один и тот же ключ сохранения данных). */
async function hashTelegramPassword(username: string, telegramId: number): Promise<string> {
    const rawPassword = `${TELEGRAM_PASSWORD_SEED}:${telegramId}`;
    return hashPasswordClient(rawPassword, username);
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

let saveDataTimeoutId: ReturnType<typeof setTimeout> | null = null;
const SAVE_DATA_DEBOUNCE_MS = 2000;

/** Отправить данные аккаунта в Supabase (цели, задачи, здоровье, настроение, экзамены и т.д.). Вызывается с задержкой после изменений. */
function pushUserDataToSupabase(data: UserDataPayload): void {
    const currentUser = typeof localStorage !== 'undefined' ? localStorage.getItem('session_user') : null;
    const syncHash = getSyncHash();
    if (!currentUser || !syncHash) return;

    const url = getSupabaseUsersApiUrl();
    fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'saveData', username: currentUser, passwordHash: syncHash, payload: data }),
    })
        .then((res) => parseJsonResponse(res))
        .then((json) => {
            if (json && json.ok !== true && typeof console !== 'undefined' && console.warn)
                console.warn('[Supabase] save data:', json.error);
        })
        .catch((err) => {
            if (typeof console !== 'undefined' && console.warn)
                console.warn('[Supabase] save data request failed:', err?.message ?? err);
        });
}

/** Запланировать сохранение данных в Supabase через SAVE_DATA_DEBOUNCE_MS (дебаунс). */
function debouncedSaveDataToSupabase(data: UserDataPayload): void {
    if (saveDataTimeoutId != null) clearTimeout(saveDataTimeoutId);
    saveDataTimeoutId = setTimeout(() => {
        saveDataTimeoutId = null;
        pushUserDataToSupabase(data);
    }, SAVE_DATA_DEBOUNCE_MS);
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

        const passwordHash = await hashPasswordClient(password, username);
        const sync = await syncUserToSupabaseAndWait(username, undefined, passwordHash);
        if (!sync.ok) {
            return { success: false, message: sync.error || 'Не удалось сохранить пароль в облаке' };
        }

        setSyncHash(passwordHash);
        users[username] = { password, telegramId: undefined as number | undefined };
        safeSave('cloud_users', JSON.stringify(users));

        const userDataKey = `cloud_data_${username}`;
        safeSave(userDataKey, JSON.stringify(initialData));

        safeSave('session_user', username);
        authService.syncToActiveState(initialData);

        pushUserDataToSupabase(initialData);

        return { success: true };
    },

    /**
     * Вход только по Supabase: проверка логина и пароля в БД, подгрузка всех данных (профиль, задачи, заметки, здоровье, настроение, экзамены) из Supabase в приложение.
     */
    login: async (username: string, password: string): Promise<{ success: boolean, message?: string }> => {
        const u = (username ?? '').trim();
        const p = (password ?? '').trim();
        if (!u || !p) return { success: false, message: 'invalid' };

        const apiUrl = getSupabaseUsersApiUrl();
        let loginResponse: Record<string, unknown> | null = null;

        let usedHash = '';
        try {
            usedHash = await hashPasswordClient(p, u);
            const res = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'login', username: u, passwordHash: usedHash }),
            });
            loginResponse = await parseJsonResponse(res);
        } catch {
            return { success: false, message: 'invalid' };
        }

        if (loginResponse?.ok !== true) return { success: false, message: 'invalid' };

        safeSave('session_user', u);
        const usersRaw = localStorage.getItem('cloud_users');
        const users = usersRaw ? JSON.parse(usersRaw) : {};
        const telegramId = (users[u] as { telegramId?: number } | undefined)?.telegramId;
        syncUserToSupabase(u, telegramId);
        if (!users[u]) {
            users[u] = { password: '', telegramId: undefined };
            safeSave('cloud_users', JSON.stringify(users));
        }
        if (usedHash) setSyncHash(usedHash);

        const userDataKey = `cloud_data_${u}`;
        const serverData = loginResponse?.userData;
        if (serverData != null && typeof serverData === 'object' && !Array.isArray(serverData)) {
            const raw = serverData as Record<string, unknown>;
            if (raw.profile != null && typeof raw.profile === 'object' && Array.isArray(raw.tasks)) {
                const payload: UserDataPayload = {
                    profile: raw.profile as UserDataPayload['profile'],
                    tasks: raw.tasks as Task[],
                    notes: Array.isArray(raw.notes) ? (raw.notes as UserDataPayload['notes']) : [],
                    folders: Array.isArray(raw.folders) ? (raw.folders as UserDataPayload['folders']) : [],
                    stats: (raw.stats != null && typeof raw.stats === 'object') ? (raw.stats as DailyStats) : {
                        focusScore: 0, tasksCompleted: 0, streakDays: 0, mood: 'Neutral', sleepHours: 7.5,
                        activityHistory: [], apiRequestsCount: 0, lastRequestDate: new Date().toISOString().split('T')[0]
                    },
                };
                authService.syncToActiveState(payload);
                safeSave(userDataKey, JSON.stringify(payload));
                return { success: true };
            }
        }

        try {
            localStorage.removeItem('focu_profile');
            localStorage.removeItem('focu_tasks');
            localStorage.removeItem('focu_notes');
            localStorage.removeItem('focu_folders');
            localStorage.removeItem('focu_stats');
            localStorage.removeItem(userDataKey);
        } catch { /* ignore */ }
        return { success: true };
    },

    /**
     * Logs out the user.
     * Clears session and active state (security).
     */
    logout: async () => {
        await delay(300);
        clearSyncHash();
        localStorage.removeItem('session_user');
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
     * Сохраняет текущее состояние в localStorage и ставит в очередь отправку в Supabase (цели, задачи, здоровье, настроение, экзамены и т.д.).
     */
    syncToCloud: (data: UserDataPayload) => {
        const currentUser = authService.getCurrentUser();
        if (!currentUser) return;

        const userDataKey = `cloud_data_${currentUser}`;
        safeSave(userDataKey, JSON.stringify(data));
        debouncedSaveDataToSupabase(data);
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

        // Настроим хеш для синхронизации данных через Supabase для Telegram-аккаунта
        let usedHash = '';
        try {
            usedHash = await hashTelegramPassword(username, payload.id);
            if (usedHash) {
                setSyncHash(usedHash);
                // Обновим/создадим запись пользователя в Supabase с telegram_id и password_hash
                syncUserToSupabase(username, payload.id, usedHash);
            }
        } catch {
            // если что-то пошло не так, просто продолжим с локальными данными
        }

        const userDataKey = `cloud_data_${username}`;

        // Попробуем сначала загрузить все данные аккаунта из Supabase (user_data)
        let payloadFromServer: UserDataPayload | null = null;
        if (usedHash) {
            const apiUrl = getSupabaseUsersApiUrl();
            try {
                const res = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'login', username, passwordHash: usedHash }),
                });
                const loginResponse = await parseJsonResponse(res);
                if (loginResponse?.ok === true && loginResponse.userData && typeof loginResponse.userData === 'object') {
                    const raw = loginResponse.userData as Record<string, unknown>;
                    if (raw.profile != null && typeof raw.profile === 'object' && Array.isArray(raw.tasks)) {
                        payloadFromServer = {
                            profile: raw.profile as UserDataPayload['profile'],
                            tasks: raw.tasks as Task[],
                            notes: Array.isArray(raw.notes) ? (raw.notes as UserDataPayload['notes']) : [],
                            folders: Array.isArray(raw.folders) ? (raw.folders as UserDataPayload['folders']) : [],
                            stats: (raw.stats != null && typeof raw.stats === 'object')
                                ? (raw.stats as DailyStats)
                                : {
                                    focusScore: 0,
                                    tasksCompleted: 0,
                                    streakDays: 0,
                                    mood: 'Neutral',
                                    sleepHours: 7.5,
                                    activityHistory: [],
                                    apiRequestsCount: 0,
                                    lastRequestDate: new Date().toISOString().split('T')[0],
                                },
                        };
                    }
                }
            } catch {
                // игнорируем ошибки Supabase, продолжим с локальными данными
            }
        }

        if (payloadFromServer) {
            authService.syncToActiveState(payloadFromServer);
            safeSave(userDataKey, JSON.stringify(payloadFromServer));
            return { success: true };
        }

        // Fallback: если данных в Supabase нет — используем локальный cloud_data или создаём пустой профиль
        const savedDataRaw = localStorage.getItem(userDataKey);
        if (savedDataRaw) {
            const data: UserDataPayload = JSON.parse(savedDataRaw);
            authService.syncToActiveState(data);
            return { success: true };
        }

        // Новое устройство и пустой Supabase: подставляем минимальный профиль
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
            stats: {
                focusScore: 0,
                tasksCompleted: 0,
                streakDays: 0,
                mood: 'Neutral',
                sleepHours: 7.5,
                activityHistory: [],
                apiRequestsCount: 0,
                lastRequestDate: today
            }
        };
        authService.syncToActiveState(emptyPayload);
        safeSave(userDataKey, JSON.stringify(emptyPayload));
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

        // Создаём/обновляем запись пользователя в Supabase и сохраняем детерминированный хеш для дальнейшей синхронизации данных
        try {
            const passwordHash = await hashTelegramPassword(username, payload.id);
            const sync = await syncUserToSupabaseAndWait(username, payload.id, passwordHash);
            if (!sync.ok) {
                return { success: false, message: sync.error || 'Не удалось сохранить аккаунт в облаке' };
            }
            setSyncHash(passwordHash);
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            return { success: false, message: msg };
        }

        users[username] = { password: '', telegramId: payload.id };
        telegramIndex[String(payload.id)] = username;
        safeSave('cloud_users', JSON.stringify(users));
        setTelegramIndex(telegramIndex);

        const userDataKey = `cloud_data_${username}`;
        safeSave(userDataKey, JSON.stringify(dataToSave));
        safeSave('session_user', username);
        authService.syncToActiveState(dataToSave);

        // Отправим стартовое состояние аккаунта в Supabase, чтобы оно было доступно на других устройствах
        pushUserDataToSupabase(dataToSave);

        return { success: true };
    }
};
