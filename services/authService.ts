
import { UserProfile, Task, Note, NoteFolder, DailyStats } from '../types';

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
        users[username] = { password }; // In real app: Hash this password!
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
    }
};
