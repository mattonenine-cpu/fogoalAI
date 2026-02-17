
import { UserProfile, Task, Note, NoteFolder, DailyStats } from '../types';

interface UserDataPayload {
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
        await delay(800); // Simulate network request

        const usersRaw = localStorage.getItem('cloud_users');
        const users = usersRaw ? JSON.parse(usersRaw) : {};

        if (users[username]) {
            return { success: false, message: 'exists' };
        }

        // Save User Creds
        users[username] = { password, telegramId: undefined as number | undefined }; // In real app: Hash password!
        safeSave('cloud_users', JSON.stringify(users));

        // Save Initial Data
        const userDataKey = `cloud_data_${username}`;
        safeSave(userDataKey, JSON.stringify(initialData));

        // Set Session
        safeSave('session_user', username);
        
        // Populate "Active" LocalStorage keys for the App to use seamlessly
        authService.syncToActiveState(initialData);

        return { success: true };
    },

    /**
     * Logs in a user.
     * Verifies credentials and loads their data into the active application state.
     */
    login: async (username: string, password: string): Promise<{ success: boolean, message?: string }> => {
        await delay(800); // Simulate network request

        const usersRaw = localStorage.getItem('cloud_users');
        const users = usersRaw ? JSON.parse(usersRaw) : {};

        if (!users[username] || users[username].password !== password) {
            return { success: false, message: 'invalid' };
        }

        // Set Session
        safeSave('session_user', username);

        // Load Data from "Cloud"
        const userDataKey = `cloud_data_${username}`;
        const savedDataRaw = localStorage.getItem(userDataKey);
        
        if (savedDataRaw) {
            const data: UserDataPayload = JSON.parse(savedDataRaw);
            authService.syncToActiveState(data);
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
                    enabledEcosystems: [],
                    statsHistory: [],
                    telegramId: payload.id,
                    telegramUsername: payload.username,
                    telegramPhotoUrl: payload.photo_url
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
        authService.syncToActiveState(dataToSave);
        return { success: true };
    }
};
