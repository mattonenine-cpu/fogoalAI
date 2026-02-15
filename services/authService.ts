
import { UserProfile, Task, Note, NoteFolder, DailyStats } from '../types';
import supabase from './supabaseClient';

interface UserDataPayload {
    profile: UserProfile;
    tasks: Task[];
    notes: Note[];
    folders: NoteFolder[];
    stats: DailyStats;
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

const API_BASE = (import.meta as any).env?.VITE_API_BASE || 'http://localhost:3000';

const authFetch = async (url: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('session_token');
    const headers = options.headers ? new Headers(options.headers as any) : new Headers();
    headers.set('Content-Type', 'application/json');
    if (token) headers.set('Authorization', `Bearer ${token}`);
    const res = await fetch(`${API_BASE}${url}`, { ...options, headers });
    return res;
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
        // If Supabase is configured, use it directly
        if (supabase) {
            try {
                // Supabase expects an email; use username as email.
                const { data, error } = await supabase.auth.signUp({ email: username, password });
                if (error) return { success: false, message: error.message };
                const user = (data as any)?.user;
                if (user) {
                    // store initial data in table `user_data` (create this table in Supabase: user_id uuid PK, json text)
                    await supabase.from('user_data').insert([{ user_id: user.id, json: JSON.stringify(initialData) }]);
                    localStorage.setItem('session_user', username);
                    return { success: true };
                }
                return { success: true };
            } catch (e: any) {
                return { success: false, message: e.message || 'error' };
            }
        }

        // Fallback to existing API
        try {
            const res = await fetch(`${API_BASE}/api/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, initialData })
            });
            const json = await res.json();
            if (!res.ok) return { success: false, message: json.message || 'error' };
            if (json.token) {
                localStorage.setItem('session_token', json.token);
                localStorage.setItem('session_user', username);
            }
            if (json.data) authService.syncToActiveState(json.data);
            else authService.syncToActiveState(initialData);
            return { success: true };
        } catch (e) {
            return { success: false, message: 'network' };
        }
    },

    /**
     * Logs in a user.
     * Verifies credentials and loads their data into the active application state.
     */
    login: async (username: string, password: string): Promise<{ success: boolean, message?: string }> => {
        if (supabase) {
            try {
                const { data, error } = await supabase.auth.signInWithPassword({ email: username, password });
                if (error) return { success: false, message: error.message };
                const user = (data as any)?.user;
                if (user) {
                    // fetch user data
                    const { data: rows } = await supabase.from('user_data').select('json').eq('user_id', user.id).single();
                    if (rows && (rows as any).json) {
                        const parsed = JSON.parse((rows as any).json);
                        authService.syncToActiveState(parsed);
                    }
                    localStorage.setItem('session_user', username);
                    return { success: true };
                }
                return { success: false, message: 'no_user' };
            } catch (e: any) {
                return { success: false, message: e.message || 'error' };
            }
        }

        try {
            const res = await fetch(`${API_BASE}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const json = await res.json();
            if (!res.ok) return { success: false, message: json.message || 'invalid' };
            if (json.token) {
                localStorage.setItem('session_token', json.token);
                localStorage.setItem('session_user', username);
            }
            if (json.data) authService.syncToActiveState(json.data);
            return { success: true };
        } catch (e) {
            return { success: false, message: 'network' };
        }
    },

    /**
     * Logs out the user.
     * Clears session and active state (security).
     */
    logout: async () => {
        await delay(300);
        localStorage.removeItem('session_user');
        localStorage.removeItem('session_token');
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
    syncToCloud: async (data: UserDataPayload) => {
        if (supabase) {
            try {
                const user = (await supabase.auth.getUser()).data.user;
                if (!user) return;
                // upsert user_data table
                await supabase.from('user_data').upsert({ user_id: user.id, json: JSON.stringify(data) }, { onConflict: 'user_id' });
            } catch (e) {
                console.warn('Supabase sync failed', e);
            }
            return;
        }

        const token = localStorage.getItem('session_token');
        if (!token) return;
        try {
            await authFetch('/api/sync', { method: 'POST', body: JSON.stringify(data) });
        } catch (e) {
            console.warn('Failed to sync to server', e);
        }
    }
};

