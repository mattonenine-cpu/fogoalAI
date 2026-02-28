
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { UserProfile, AppView, Task, DailyStats, Language, TRANSLATIONS, EcosystemType, Note, NoteFolder, AppTheme, HelpContext, EcosystemConfig } from '../types';
import { getDefaultUsageStats } from '../types';
import { Onboarding } from './Onboarding';
import { Dashboard } from './Dashboard';
import { Scheduler } from './Scheduler';
import SmartPlanner from './SmartPlanner';
import { ChatInterface } from './ChatInterface';
import { EcosystemView } from './EcosystemView';
import { NotesView } from './NotesView';
import { LanguageSelector } from './LanguageSelector';
import { Logo } from './Logo';
import { ThemeSelector } from './ThemeSelector';
import { SettingsModal } from './SettingsModal';
import { ContextHelpOverlay } from './ContextHelpOverlay';
import { SlidersHorizontal, Globe, Box, Activity, Library, HeartPulse, Shapes, UserRound, User, Loader2 } from 'lucide-react';
import { getLocalISODate } from '../services/geminiService';
import { authService } from '../services/authService';
import { CreditsService } from '../services/creditsService';
import { parseTelegramCallbackFromUrl, getTelegramUserFromWebApp } from '../services/telegramAuth';
import { TelegramAuthWidget } from './TelegramAuthWidget';
import { EcosystemSelectionModal } from './EcosystemSelectionModal';
import { CreditsDisplay } from './CreditsDisplay';
import { DevStatsModal } from './DevStatsModal';
import type { UserDataPayload } from '../services/authService';

// Safe storage helper to prevent QuotaExceededError from crashing the app
const safeSave = (key: string, data: any) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn(`Storage quota exceeded or restricted for key: ${key}`);
  }
};

const getLogoMood = (dailyMood: 'Happy' | 'Neutral' | 'Sad'): 'Great' | 'Good' | 'Okay' | 'Tired' | 'Stress' => {
  switch (dailyMood) {
    case 'Happy': return 'Good';
    case 'Sad': return 'Tired';
    default: return 'Okay';
  }
};

export default function App() {
  const [profile, setProfile] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('focu_profile');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed) {
          if (parsed.level === undefined) parsed.level = 1;
          if (parsed.totalExperience === undefined) parsed.totalExperience = 0;
          if (!Array.isArray(parsed.statsHistory)) parsed.statsHistory = [];
          if (!Array.isArray(parsed.goals)) parsed.goals = [];
          
          if (!parsed.settings) {
              parsed.settings = {
                  aiPersona: 'balanced',
                  aiDetailLevel: 'medium',
                  visibleViews: ['dashboard', 'scheduler', 'smart_planner', 'chat', 'notes', 'sport', 'study', 'health'],
                  fontSize: 'normal'
              };
          } else {
              // Ensure smart_planner is enabled for existing users
              if (parsed.settings.visibleViews && !parsed.settings.visibleViews.includes('smart_planner')) {
                  parsed.settings.visibleViews.push('smart_planner');
              }
          }

          // Initialize credits system if not exists
          if (!parsed.credits) {
              parsed.credits = CreditsService.initializeCredits();
          } else {
              // Check if monthly reset is needed
              if (CreditsService.needsMonthlyReset(parsed.credits)) {
                  parsed.credits = CreditsService.resetCredits(parsed.credits);
              }
          }
          // Полная статистика использования — в Supabase в user_data.profile.usageStats
          if (!parsed.usageStats || typeof parsed.usageStats.opens !== 'object') {
              parsed.usageStats = getDefaultUsageStats();
          } else {
              const def = getDefaultUsageStats();
              parsed.usageStats = {
                  opens: { ...def.opens, ...(parsed.usageStats.opens || {}) },
                  lastOpenedAt: parsed.usageStats.lastOpenedAt || {},
                  ecosystem: {
                      sport: { ...def.ecosystem.sport, ...(parsed.usageStats.ecosystem?.sport || {}) },
                      study: { ...def.ecosystem.study, ...(parsed.usageStats.ecosystem?.study || {}) },
                      health: { ...def.ecosystem.health, ...(parsed.usageStats.ecosystem?.health || {}) },
                      work: { ...def.ecosystem.work, ...(parsed.usageStats.ecosystem?.work || {}) },
                  },
                  totalChatMessages: parsed.usageStats.totalChatMessages ?? 0,
                  totalTasksCompleted: parsed.usageStats.totalTasksCompleted ?? 0,
                  totalGoalsCompleted: parsed.usageStats.totalGoalsCompleted ?? 0,
              };
          }
          return parsed;
        }
      }
    } catch (e) { console.error(e); }
    return null;
  });

  const [language, setLanguage] = useState<Language | null>(() => {
    const saved = localStorage.getItem('focu_language');
    if (!saved) return null;
    try {
        const parsed = JSON.parse(saved);
        if (parsed === 'en' || parsed === 'ru') return parsed;
        return null; 
    } catch {
        if (saved === 'en' || saved === 'ru') return saved as Language;
        return null;
    }
  });

  const [theme, setTheme] = useState<AppTheme>(() => {
      const saved = localStorage.getItem('focu_theme');
      if (!saved) return 'dark';
      try {
          const parsed = JSON.parse(saved);
          return (['dark', 'white', 'ice'].includes(parsed)) ? parsed : 'dark';
      } catch {
          return (['dark', 'white', 'ice'].includes(saved)) ? saved as AppTheme : 'dark';
      }
  });

  const [currentView, setCurrentView] = useState<AppView>(AppView.DASHBOARD);
  const [activeEcosystem, setActiveEcosystem] = useState<EcosystemType | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showDevStatsModal, setShowDevStatsModal] = useState(false);
  const [helpContext, setHelpContext] = useState<HelpContext | null>(null);
  
  const [tasks, setTasks] = useState<Task[]>(() => {
    try {
      const saved = localStorage.getItem('focu_tasks');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [notes, setNotes] = useState<Note[]>(() => {
    try {
      const saved = localStorage.getItem('focu_notes');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [folders, setFolders] = useState<NoteFolder[]>(() => {
    try {
      const saved = localStorage.getItem('focu_folders');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [dailyStats, setDailyStats] = useState<DailyStats>(() => {
    const today = getLocalISODate();
    try {
      const saved = localStorage.getItem('focu_stats');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.lastRequestDate === today) return parsed;
      }
    } catch { }
    return { focusScore: 0, tasksCompleted: 0, streakDays: 0, mood: 'Neutral', sleepHours: 7.5, activityHistory: [], apiRequestsCount: 0, lastRequestDate: today };
  });

  const [isSyncingOnOpen, setIsSyncingOnOpen] = useState(false);

  useEffect(() => {
      const user = authService.getCurrentUser();
      if (!user && profile) setProfile(null);
  }, []);

  // При открытии приложения подтягиваем данные из облака и показываем загрузку не менее 1 секунды.
  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    setIsSyncingOnOpen(true);
    const start = Date.now();
    (async () => {
      try {
        const updated = await authService.refreshFromCloud?.();
        if (!cancelled && updated) {
          const mergedProfile = { ...updated.profile };
          if (!mergedProfile.credits || typeof mergedProfile.credits.availableCredits !== 'number') {
            const current = typeof profile !== 'undefined' ? profile : null;
            if (current?.credits && typeof current.credits.availableCredits === 'number') {
              mergedProfile.credits = current.credits;
            } else {
              mergedProfile.credits = CreditsService.initializeCredits();
            }
          } else if (CreditsService.needsMonthlyReset(mergedProfile.credits)) {
            mergedProfile.credits = CreditsService.resetCredits(mergedProfile.credits);
          }
          setProfile(mergedProfile);
          setTasks(updated.tasks);
          setNotes(updated.notes);
          setFolders(updated.folders);
          setDailyStats(updated.stats);
        }
      } catch {
        // тихо игнорируем ошибки сети/сервера
      }
      const elapsed = Date.now() - start;
      const remain = Math.max(0, 1000 - elapsed);
      await new Promise(r => setTimeout(r, remain));
      if (!cancelled) setIsSyncingOnOpen(false);
    })();
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Обработка callback от Telegram Login Widget (привязка или вход)
  const [handlingTelegram, setHandlingTelegram] = useState(false);
  useEffect(() => {
    const payload = parseTelegramCallbackFromUrl();
    if (!payload || handlingTelegram) return;

    const run = async () => {
      setHandlingTelegram(true);
      try {
        if (payload.link) {
          const res = authService.linkTelegram(payload);
          if (res.success && res.updatedProfile) setProfile(res.updatedProfile);
          window.history.replaceState({}, '', window.location.pathname || '/');
          return;
        }
        const res = await authService.loginWithTelegram(payload);
        if (res.success) {
          window.history.replaceState({}, '', window.location.pathname || '/');
          window.location.reload();
          return;
        }
        if (res.needRegister) {
          sessionStorage.setItem('telegram_register_payload', JSON.stringify(payload));
          window.history.replaceState({}, '', window.location.pathname || '/');
          window.location.reload();
        }
      } finally {
        setHandlingTelegram(false);
      }
    };
    run();
  }, [handlingTelegram]);

  // Регистрация по Telegram (после редиректа с needRegister)
  const [completingTelegramRegister, setCompletingTelegramRegister] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState<any | null>(null);
  const [showEcosystemSelection, setShowEcosystemSelection] = useState(false);
  useEffect(() => {
    const raw = sessionStorage.getItem('telegram_register_payload');
    if (!raw || completingTelegramRegister) return;
    const payload = (() => { try { return JSON.parse(raw); } catch { return null; } })();
    if (!payload?.id) return;

    const run = async () => {
      setCompletingTelegramRegister(true);
      sessionStorage.removeItem('telegram_register_payload');
      const today = new Date().toISOString().split('T')[0];
      const initialData: UserDataPayload = {
        profile: {
          name: payload.first_name || payload.username || String(payload.id),
          occupation: '',
          level: 1,
          totalExperience: 0,
          goals: [],
          bedtime: '23:00',
          wakeTime: '07:00',
          activityHistory: [today],
          energyProfile: { energyPeaks: [], energyDips: [], recoverySpeed: 'average' as const, resistanceTriggers: [] },
          isOnboarded: false,
          enabledEcosystems: [
            { type: 'sport' as const, label: 'Sport', icon: '⚽', enabled: true, justification: 'Fitness and physical activities' },
            { type: 'study' as const, label: 'Study', icon: '📚', enabled: true, justification: 'Learning and education' },
            { type: 'health' as const, label: 'Health', icon: '❤️', enabled: true, justification: 'Health monitoring and wellness' },
          ],
          statsHistory: [],
          telegramId: payload.id,
          telegramUsername: payload.username,
          telegramPhotoUrl: payload.photo_url,
          settings: { aiPersona: 'balanced', aiDetailLevel: 'medium', visibleViews: ['dashboard', 'scheduler', 'smart_planner', 'chat', 'notes', 'sport', 'study', 'health'], fontSize: 'normal' }
        },
        tasks: [],
        notes: [],
        folders: [],
        stats: { focusScore: 0, tasksCompleted: 0, streakDays: 0, mood: 'Neutral' as const, sleepHours: 7.5, activityHistory: [], apiRequestsCount: 0, lastRequestDate: today }
      };
      const res = await authService.registerWithTelegram(payload, initialData);
      setCompletingTelegramRegister(false);
      if (res.success) {
        setRegistrationSuccess({ id: payload.id, name: payload.first_name || payload.username || String(payload.id), photo: payload.photo_url });
      }
    };
    run();
  }, [completingTelegramRegister]);

  useEffect(() => {
    if (profile) {
        safeSave('focu_profile', profile);
        authService.syncToCloud({ profile, tasks, notes, folders, stats: dailyStats });
    }
  }, [profile, tasks, notes, folders, dailyStats]);

  useEffect(() => {
    safeSave('focu_tasks', tasks);
  }, [tasks]);

  useEffect(() => {
    safeSave('focu_notes', notes);
  }, [notes]);
  
  useEffect(() => {
    safeSave('focu_folders', folders);
  }, [folders]);

  useEffect(() => {
    safeSave('focu_stats', dailyStats);
  }, [dailyStats]);

  useEffect(() => {
    if (language) safeSave('focu_language', language);
  }, [language]);

  useEffect(() => {
      safeSave('focu_theme', theme);
      const root = document.documentElement;
      const themeConfigs: Record<string, any> = {
          dark: { bgMain: '#09090b', bgCard: 'rgba(255, 255, 255, 0.05)', bgActive: '#FFFFFF', bgActiveText: '#000000', accent: '#6366f1', border: 'rgba(255, 255, 255, 0.08)', textPrimary: '#FAFAFA', textSecondary: 'rgba(255, 255, 255, 0.4)' },
          white: { bgMain: '#F8F9FA', bgCard: '#FFFFFF', bgActive: '#18181b', bgActiveText: '#FFFFFF', accent: '#18181b', border: 'rgba(0, 0, 0, 0.06)', textPrimary: '#18181b', textSecondary: 'rgba(24, 24, 27, 0.4)' },
          ice: { bgMain: '#D6E6F3', bgCard: 'rgba(255, 255, 255, 0.4)', bgActive: '#0F52BA', bgActiveText: '#FFFFFF', accent: '#0F52BA', border: 'rgba(0, 9, 38, 0.06)', textPrimary: '#000926', textSecondary: 'rgba(0, 9, 38, 0.4)' }
      };
      const c = themeConfigs[theme] || themeConfigs.dark;
      root.style.setProperty('--bg-main', c.bgMain);
      root.style.setProperty('--bg-card', c.bgCard);
      root.style.setProperty('--bg-active', c.bgActive);
      root.style.setProperty('--bg-active-text', c.bgActiveText);
      root.style.setProperty('--theme-accent', c.accent);
      root.style.setProperty('--text-primary', c.textPrimary);
      root.style.setProperty('--text-secondary', c.textSecondary);
      root.style.setProperty('--border-glass', c.border);
      document.body.style.background = c.bgMain;

      const fontScales: Record<string, string> = {
          small: '0.85',
          normal: '1.0',
          medium: '1.15',
          large: '1.3',
          xlarge: '1.5'
      };
      const currentFontSize = profile?.settings?.fontSize || 'normal';
      const scale = fontScales[currentFontSize] || '1.0';
      root.style.setProperty('--font-scale', scale);

  }, [theme, profile?.settings?.fontSize]);

  const handleUpdateProfile = (newProfile: UserProfile) => {
      if (!authService.getCurrentUser() && localStorage.getItem('session_user') === null) {
          setProfile(null);
      } else {
          setProfile(newProfile);
      }
  };

  const handleDeductCredits = (cost: number) => {
    if (profile && profile.credits && !CreditsService.isSubscriptionActive(profile.credits)) {
      const updatedCredits = CreditsService.deductCredits(profile.credits, cost);
      const updatedProfile = CreditsService.updateProfileCredits(profile, updatedCredits);
      setProfile(updatedProfile);
    }
  };

  const handleEcosystemUpdate = (updatedEcosystems: EcosystemConfig[]) => {
    if (profile) {
      const currentSettings = profile.settings || {
        aiPersona: 'balanced' as const,
        aiDetailLevel: 'medium' as const,
        visibleViews: ['dashboard', 'scheduler', 'smart_planner', 'chat', 'notes'],
        fontSize: 'normal' as const
      };
      
      const updatedProfile: UserProfile = {
        ...profile,
        enabledEcosystems: updatedEcosystems,
        settings: {
          ...currentSettings,
          visibleViews: ['dashboard', 'scheduler', 'smart_planner', 'chat', 'notes', ...updatedEcosystems.filter(e => e.enabled).map(e => e.type)]
        }
      };
      setProfile(updatedProfile);
      setShowEcosystemSelection(false);
    }
  };

  const handleLanguageCycle = () => {
      const languages: Language[] = ['en', 'ru'];
      const currentIndex = languages.indexOf(language || 'en');
      const nextIndex = (currentIndex + 1) % languages.length;
      setLanguage(languages[nextIndex]);
  };

  const handleTrackRequest = (taskId: string) => {
      const task = tasks.find((t: Task) => t.id === taskId);
      if (task) {
          setHelpContext({
              blockName: 'Scheduler Task',
              taskText: task.title
          });
      }
  };

  /** Навигация с записью статистики открытий в profile.usageStats (синхронизируется в Supabase) */
  const handleNavigate = (view: AppView, ecosystem: EcosystemType | null = null) => {
    setCurrentView(view);
    setActiveEcosystem(ecosystem);
    if (!profile) return;
    const now = new Date().toISOString();
    const u = profile.usageStats || getDefaultUsageStats();
    const opens = { ...u.opens };
    const lastOpenedAt = { ...u.lastOpenedAt };
    if (view === AppView.DASHBOARD) { opens.dashboard = (opens.dashboard || 0) + 1; lastOpenedAt.dashboard = now; }
    else if (view === AppView.SCHEDULER) { opens.scheduler = (opens.scheduler || 0) + 1; lastOpenedAt.scheduler = now; }
    else if (view === AppView.SMART_PLANNER) { opens.smart_planner = (opens.smart_planner || 0) + 1; lastOpenedAt.smart_planner = now; }
    else if (view === AppView.CHAT) { opens.chat = (opens.chat || 0) + 1; lastOpenedAt.chat = now; }
    else if (view === AppView.NOTES) { opens.notes = (opens.notes || 0) + 1; lastOpenedAt.notes = now; }
    else if (view === AppView.ECOSYSTEM && ecosystem) {
      if (ecosystem === 'sport' || ecosystem === 'study' || ecosystem === 'health') {
        opens[ecosystem] = (opens[ecosystem] ?? 0) + 1;
        lastOpenedAt[ecosystem] = now;
      }
    }
    setProfile({
      ...profile,
      usageStats: { ...u, opens, lastOpenedAt },
    });
  };

  const visibleNavItems = useMemo(() => {
    if (!profile?.settings?.visibleViews) return ['dashboard', 'scheduler', 'smart_planner', 'chat', 'notes'];
    return profile.settings.visibleViews;
  }, [profile?.settings?.visibleViews]);

  const devStatsTapRef = useRef({ count: 0, lastAt: 0 });
  const handleLogoTap = () => {
    const now = Date.now();
    const { count, lastAt } = devStatsTapRef.current;
    if (now - lastAt > 2000) {
      devStatsTapRef.current = { count: 1, lastAt: now };
      return;
    }
    devStatsTapRef.current = { count: count + 1, lastAt: now };
    if (count + 1 >= 5) {
      setShowDevStatsModal(true);
      devStatsTapRef.current = { count: 0, lastAt: 0 };
    }
  };

  const renderView = () => {
    if (!profile) return null;
    switch (currentView) {
      case AppView.DASHBOARD:
        return <Dashboard 
          user={profile} stats={dailyStats} lang={language!} tasks={tasks} 
          onUpdateProfile={handleUpdateProfile} onUpdateStats={setDailyStats} onNavigate={handleNavigate}
          onAddTasks={(newTasks: Task[]) => setTasks((prev: Task[]) => [...prev, ...newTasks])}
        />;
      case AppView.SCHEDULER:
        return <Scheduler 
          tasks={tasks} setTasks={setTasks} userProfile={profile} setUserProfile={handleUpdateProfile} 
          lang={language!} onTrackRequest={handleTrackRequest} notes={notes} onUpdateNotes={setNotes}
          currentStats={dailyStats}
          onOpenSmartPlanner={() => handleNavigate(AppView.SMART_PLANNER)}
        />;
      case AppView.SMART_PLANNER:
        return <SmartPlanner tasks={tasks} setTasks={setTasks} lang={language!} onOpenScheduler={() => handleNavigate(AppView.SCHEDULER)} onDeductCredits={handleDeductCredits} />;
      case AppView.CHAT:
        return <ChatInterface userProfile={profile} lang={language!} tasks={tasks} onSetTasks={setTasks} onDeductCredits={handleDeductCredits} onUpdateProfile={handleUpdateProfile} />;
      case AppView.ECOSYSTEM:
        return activeEcosystem ? <EcosystemView 
            type={activeEcosystem} user={profile} tasks={tasks} lang={language!} 
            onUpdateTasks={setTasks} onUpdateProfile={handleUpdateProfile} onNavigate={handleNavigate} theme={theme}
            onDeductCredits={handleDeductCredits}
        /> : null;
      case AppView.NOTES:
        return <NotesView notes={notes} folders={folders} onUpdateNotes={setNotes} onUpdateFolders={setFolders} lang={language!} />;
      default: return null;
    }
  };

  // Handler: Try to read Telegram profile from Web App and perform login/register automatically.
  const handleTelegramAuto = async () => {
    try {
      const payload = getTelegramUserFromWebApp();
      if (!payload) {
        // Fallback: open the widget flow
        window.location.href = `${window.location.origin + (window.location.pathname || '')}?show_telegram_widget=login`;
        return;
      }

      // Try login first
      setHandlingTelegram(true);
      const res = await authService.loginWithTelegram(payload);
      if (res.success) {
        // Load profile from storage and show ecosystem selection
        const saved = localStorage.getItem('focu_profile');
        if (saved) {
          const loadedProfile = JSON.parse(saved);
          // Set isOnboarded to true to skip onboarding for existing users
          loadedProfile.isOnboarded = true;
          setProfile(loadedProfile);
          setShowEcosystemSelection(true);
        }
        return;
      }

      if (res.needRegister) {
        // Create initial data similar to existing flow
        const today = new Date().toISOString().split('T')[0];
        const initialData: UserDataPayload = {
          profile: {
            name: payload.first_name || payload.username || String(payload.id),
            occupation: '',
            level: 1,
            totalExperience: 0,
            goals: [],
            bedtime: '23:00',
            wakeTime: '07:00',
            activityHistory: [today],
            energyProfile: { energyPeaks: [], energyDips: [], recoverySpeed: 'average' as const, resistanceTriggers: [] },
            isOnboarded: false,
            enabledEcosystems: [
            { type: 'sport' as const, label: 'Sport', icon: '⚽', enabled: true, justification: 'Fitness and physical activities' },
            { type: 'study' as const, label: 'Study', icon: '📚', enabled: true, justification: 'Learning and education' },
            { type: 'health' as const, label: 'Health', icon: '❤️', enabled: true, justification: 'Health monitoring and wellness' },
          ],
            statsHistory: [],
            usageStats: getDefaultUsageStats(),
            telegramId: payload.id,
            telegramUsername: payload.username,
            telegramPhotoUrl: payload.photo_url,
            settings: { aiPersona: 'balanced', aiDetailLevel: 'medium', visibleViews: ['dashboard', 'scheduler', 'smart_planner', 'chat', 'notes', 'sport', 'study', 'health'], fontSize: 'normal' }
          },
          tasks: [],
          notes: [],
          folders: [],
          stats: { focusScore: 0, tasksCompleted: 0, streakDays: 0, mood: 'Neutral' as const, sleepHours: 7.5, activityHistory: [], apiRequestsCount: 0, lastRequestDate: today }
        };

        setCompletingTelegramRegister(true);
        const r = await authService.registerWithTelegram(payload, initialData);
        setCompletingTelegramRegister(false);
        if (r.success) {
          setRegistrationSuccess({ id: payload.id, name: payload.first_name || payload.username || String(payload.id), photo: payload.photo_url });
        }
      }
    } finally {
      setHandlingTelegram(false);
    }
  };

  const showTelegramWidget = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('show_telegram_widget');
  if (showTelegramWidget === 'link' || showTelegramWidget === 'login') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--bg-main)] text-[var(--text-primary)] p-4">
        <TelegramAuthWidget
          mode={showTelegramWidget as 'link' | 'login'}
          onCancel={() => window.history.back()}
          lang={language || 'ru'}
        />
      </div>
    );
  }

  if (completingTelegramRegister || handlingTelegram) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-main)] text-[var(--text-secondary)]">
        <span className="text-sm">Загрузка...</span>
      </div>
    );
  }

  // If we just registered via Telegram, show a confirmation screen first
  if (registrationSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-main)] text-[var(--text-primary)] p-4">
        <div className="w-full max-w-md glass-liquid rounded-xl p-6 flex flex-col items-center gap-4">
          {registrationSuccess.photo ? (
            <img src={registrationSuccess.photo} className="w-20 h-20 rounded-full object-cover ring-2 ring-[var(--theme-accent)]/30" />
          ) : (
            <div className="w-20 h-20 rounded-full glass-liquid flex items-center justify-center text-[var(--text-secondary)]">
              <User size={28} />
            </div>
          )}
          <div className="text-lg font-bold">Регистрация успешна</div>
          <div className="text-sm text-[var(--text-secondary)]">Добро пожаловать, {registrationSuccess.name}</div>
          <div className="w-full flex gap-3 mt-4">
            <button onClick={() => {
              // Load profile from storage and ensure isOnboarded is false for onboarding flow
              const saved = localStorage.getItem('focu_profile');
              if (saved) {
                const loadedProfile = JSON.parse(saved);
                // Force isOnboarded to false to show onboarding screens
                loadedProfile.isOnboarded = false;
                setProfile(loadedProfile);
              }
              setRegistrationSuccess(null);
            }} className="flex-1 py-2 rounded-md bg-[var(--theme-accent)] text-white">Далее</button>
          </div>
        </div>
      </div>
    );
  }

  if (!language) return <LanguageSelector onSelect={setLanguage} />;
  if (!profile || !profile.isOnboarded) return <Onboarding onComplete={setProfile} lang={language} currentTheme={theme} onSetTheme={setTheme} initialProfile={profile || undefined} onTelegramAuto={handleTelegramAuto} />;

  const getNavEmoji = (type: string) => {
    switch(type) {
      case 'dashboard': return '🏠';
      case 'scheduler': return '📅';
      case 'smart_planner': return '🧩';
      case 'notes': return '📝';
      case 'chat': return '💬';
      case 'work': return '💼';
      case 'sport': return '💪';
      case 'study': return '📚';
      case 'health': return '❤️';
      default: return '📍';
    }
  };

  return (
    <div className="min-h-screen text-[var(--text-primary)] overflow-hidden transition-colors duration-500 flex flex-col">
      <div className="w-full sm:max-w-md mx-auto h-[100dvh] flex flex-col relative z-10 overflow-hidden">
        <header className="p-3 sm:p-5 pb-2 flex justify-between items-center z-40 relative">
           <button type="button" onClick={handleLogoTap} className="focus:outline-none focus:ring-0 touch-manipulation" aria-label="FoGoal">
             <Logo height={32} mood={getLogoMood(dailyStats.mood)} level={profile.level} />
           </button>
           <div className="flex items-center gap-2">
             <CreditsDisplay credits={profile.credits} lang={language || 'ru'} />
             <ThemeSelector currentTheme={theme} onSelect={setTheme} />
             {profile.telegramPhotoUrl ? (
               <img src={profile.telegramPhotoUrl} alt="" className="w-10 h-10 rounded-full object-cover ring-2 ring-[var(--theme-accent)]/30 shrink-0" />
             ) : (
               <div className="w-10 h-10 rounded-full glass-liquid flex items-center justify-center text-[var(--text-secondary)] shrink-0" title={language === 'ru' ? 'Привязать Telegram' : 'Link Telegram'}>
                 <User size={18} />
               </div>
             )}
             <button 
                onClick={() => setShowSettings(true)}
                className="w-10 h-10 rounded-full glass-liquid flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all active:scale-90"
             >
                <SlidersHorizontal size={18} />
             </button>
             <button onClick={handleLanguageCycle} className="px-3 py-1.5 rounded-full glass-liquid text-mini font-bold tracking-widest text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
               {language.toUpperCase()}
             </button>
           </div>
        </header>

        <main className="flex-1 overflow-y-auto px-3 py-2 scrollbar-hide pb-[120px]">
          {renderView()}
        </main>

        <nav className="fixed bottom-6 left-0 right-0 z-[600] flex justify-center px-4 pointer-events-none">
          <div className="glass-liquid rounded-[32px] px-2 py-2 flex items-center justify-between shadow-2xl w-full max-w-md pointer-events-auto bg-[var(--bg-card)]">
            <NavBtn active={currentView === AppView.DASHBOARD} onClick={() => handleNavigate(AppView.DASHBOARD)} emoji={getNavEmoji('dashboard')} />
            {(visibleNavItems.includes('scheduler') || visibleNavItems.includes('smart_planner')) && (
              <NavBtn active={currentView === AppView.SMART_PLANNER || currentView === AppView.SCHEDULER} onClick={() => handleNavigate(AppView.SCHEDULER)} emoji={getNavEmoji('smart_planner')} />
            )}
            {(profile.enabledEcosystems || []).filter(e => visibleNavItems.includes(e.type)).map((eco: EcosystemConfig) => (
                <NavBtn key={eco.type} active={currentView === AppView.ECOSYSTEM && activeEcosystem === eco.type} onClick={() => handleNavigate(AppView.ECOSYSTEM, eco.type)} emoji={getNavEmoji(eco.type)} />
            ))}
            {visibleNavItems.includes('notes') && <NavBtn active={currentView === AppView.NOTES} onClick={() => handleNavigate(AppView.NOTES)} emoji={getNavEmoji('notes')} />}
            {visibleNavItems.includes('chat') && <NavBtn active={currentView === AppView.CHAT} onClick={() => handleNavigate(AppView.CHAT)} emoji={getNavEmoji('chat')} />}
          </div>
        </nav>
      </div>

      {showSettings && <SettingsModal 
        user={profile} lang={language} onUpdate={handleUpdateProfile} 
        onLanguageChange={setLanguage} onClose={() => setShowSettings(false)} 
      />}

      {showEcosystemSelection && profile && (
        <EcosystemSelectionModal
          currentEcosystems={profile.enabledEcosystems || []}
          onConfirm={handleEcosystemUpdate}
          onClose={() => setShowEcosystemSelection(false)}
          lang={language || 'ru'}
        />
      )}

      {isSyncingOnOpen && profile && language && (
        <div className="fixed inset-0 z-[750] bg-[var(--bg-main)] flex flex-col items-center justify-center" aria-hidden="false">
          <Loader2 className="animate-spin text-[var(--theme-accent)]" size={48} strokeWidth={2.5} />
          <p className="mt-4 text-sm font-bold text-[var(--text-primary)] uppercase tracking-widest">
            {language === 'ru' ? 'Загрузка FoGoal' : 'Loading FoGoal'}
          </p>
        </div>
      )}

      {helpContext && profile && (
        <ContextHelpOverlay
            context={helpContext}
            profile={profile}
            lang={language || 'en'}
            onClose={() => setHelpContext(null)}
        />
      )}

      {showDevStatsModal && profile && language && (
        <DevStatsModal user={profile} lang={language} onClose={() => setShowDevStatsModal(false)} />
      )}
    </div>
  );
}

const NavBtn: React.FC<{ active: boolean, onClick: (e: React.MouseEvent) => void, emoji: string }> = ({ active, onClick, emoji }) => (
  <button onClick={onClick} className={`w-9 h-9 sm:w-12 sm:h-12 shrink-0 rounded-[14px] sm:rounded-[22px] flex items-center justify-center transition-all duration-300 relative ${active ? 'bg-[var(--bg-active)] text-[var(--bg-active-text)] shadow-lg scale-110' : 'grayscale opacity-60 hover:grayscale-0 hover:opacity-100 hover:bg-white/5'}`}>
    <span className="text-sm sm:text-xl">{emoji}</span>
    {active && <div className="absolute -bottom-1.5 w-1 h-1 bg-[var(--theme-accent)] rounded-full shadow-[0_0_8px_var(--theme-accent)]" />}
  </button>
);
