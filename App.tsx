
import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile, AppView, Task, DailyStats, Language, TRANSLATIONS, EcosystemType, Note, NoteFolder, AppTheme, HelpContext } from '../types';
import { Onboarding } from './Onboarding';
import { Dashboard } from './Dashboard';
import { Scheduler } from './Scheduler';
import { SmartPlanner } from './SmartPlanner';
import { ChatInterface } from './ChatInterface';
import { EcosystemView } from './EcosystemView';
import { NotesView } from './NotesView';
import { LanguageSelector } from './LanguageSelector';
import { Logo } from './Logo';
import { ThemeSelector } from './ThemeSelector';
import { SettingsModal } from './SettingsModal';
import { ContextHelpOverlay } from './ContextHelpOverlay';
import { SlidersHorizontal, Globe, Box, Activity, Library, HeartPulse, Shapes, UserRound } from 'lucide-react';
import { getLocalISODate } from '../services/geminiService';
import { authService } from '../services/authService';

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
                  visibleViews: ['dashboard', 'scheduler', 'smart_planner', 'chat', 'notes', 'sport', 'study', 'health', 'creativity'],
                  fontSize: 'normal'
              };
          } else {
              // Ensure smart_planner is enabled for existing users
              if (parsed.settings.visibleViews && !parsed.settings.visibleViews.includes('smart_planner')) {
                  parsed.settings.visibleViews.push('smart_planner');
              }
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
        // Handle double-stringified values (e.g. "\"en\"") which happens because we use safeSave (JSON.stringify)
        const parsed = JSON.parse(saved);
        if (parsed === 'en' || parsed === 'ru') return parsed;
        return null; 
    } catch {
        // Handle legacy raw values (e.g. "en")
        if (saved === 'en' || saved === 'ru') return saved as Language;
        return null;
    }
  });

  const [theme, setTheme] = useState<AppTheme>(() => {
      const saved = localStorage.getItem('focu_theme');
      if (!saved) return 'dark';
      // Handle potentially stringified theme same as language
      try {
          const parsed = JSON.parse(saved);
          return (['dark', 'white', 'ice', 'lilac'].includes(parsed)) ? parsed : 'dark';
      } catch {
          return (['dark', 'white', 'ice', 'lilac'].includes(saved)) ? saved as AppTheme : 'dark';
      }
  });

  const [currentView, setCurrentView] = useState<AppView>(AppView.DASHBOARD);
  const [activeEcosystem, setActiveEcosystem] = useState<EcosystemType | null>(null);
  const [showSettings, setShowSettings] = useState(false);
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

  useEffect(() => {
      const user = authService.getCurrentUser();
      if (!user && profile) setProfile(null);
  }, []);

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
          ice: { bgMain: '#D6E6F3', bgCard: 'rgba(255, 255, 255, 0.4)', bgActive: '#0F52BA', bgActiveText: '#FFFFFF', accent: '#0F52BA', border: 'rgba(0, 9, 38, 0.06)', textPrimary: '#000926', textSecondary: 'rgba(0, 9, 38, 0.4)' },
          lilac: { bgMain: '#E6C7E6', bgCard: 'rgba(255, 255, 255, 0.4)', bgActive: '#663399', bgActiveText: '#FFFFFF', accent: '#663399', border: 'rgba(46, 26, 71, 0.06)', textPrimary: '#2E1A47', textSecondary: 'rgba(46, 26, 71, 0.4)' }
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

      const fontScales = {
          small: '0.95',
          normal: '1.05',
          medium: '1.15',
          large: '1.25',
          xlarge: '1.4'
      };
      const currentFontSize = profile?.settings?.fontSize || 'large';
      const scale = fontScales[currentFontSize] || '1.15';
      root.style.setProperty('--font-scale', scale);

  }, [theme, profile?.settings?.fontSize]);

  const handleUpdateProfile = (newProfile: UserProfile) => {
      if (!authService.getCurrentUser() && localStorage.getItem('session_user') === null) {
          setProfile(null);
      } else {
          setProfile(newProfile);
      }
  };

  const handleLanguageCycle = () => {
      const languages: Language[] = ['en', 'ru'];
      const currentIndex = languages.indexOf(language || 'en');
      const nextIndex = (currentIndex + 1) % languages.length;
      setLanguage(languages[nextIndex]);
  };

  const handleTrackRequest = (taskId: string) => {
      const task = tasks.find(t => t.id === taskId);
      if (task) {
          setHelpContext({
              blockName: 'Scheduler Task',
              taskText: task.title
          });
      }
  };

  const visibleNavItems = useMemo(() => {
    if (!profile?.settings?.visibleViews) return ['dashboard', 'scheduler', 'smart_planner', 'chat', 'notes'];
    return profile.settings.visibleViews;
  }, [profile?.settings?.visibleViews]);

  const renderView = () => {
    if (!profile) return null;
    switch (currentView) {
      case AppView.DASHBOARD:
        return <Dashboard 
          user={profile} stats={dailyStats} lang={language!} tasks={tasks} 
          onUpdateProfile={handleUpdateProfile} onUpdateStats={setDailyStats} onNavigate={setCurrentView}
          onAddTasks={(newTasks) => setTasks(prev => [...prev, ...newTasks])}
        />;
      case AppView.SCHEDULER:
        return <Scheduler 
          tasks={tasks} setTasks={setTasks} userProfile={profile} setUserProfile={handleUpdateProfile} 
          lang={language!} onTrackRequest={handleTrackRequest} notes={notes} onUpdateNotes={setNotes}
          currentStats={dailyStats}
        />;
      case AppView.SMART_PLANNER:
        return <SmartPlanner tasks={tasks} setTasks={setTasks} lang={language!} />;
      case AppView.CHAT:
        return <ChatInterface userProfile={profile} lang={language!} tasks={tasks} onSetTasks={setTasks} />;
      case AppView.ECOSYSTEM:
        return activeEcosystem ? <EcosystemView 
            type={activeEcosystem} user={profile} tasks={tasks} lang={language!} 
            onUpdateTasks={setTasks} onUpdateProfile={handleUpdateProfile} onNavigate={setCurrentView} theme={theme}
        /> : null;
      case AppView.NOTES:
        return <NotesView notes={notes} folders={folders} onUpdateNotes={setNotes} onUpdateFolders={setFolders} lang={language!} />;
      default: return null;
    }
  };

  if (!language) return <LanguageSelector onSelect={setLanguage} />;
  if (!profile || !profile.isOnboarded) return <Onboarding onComplete={setProfile} lang={language} currentTheme={theme} onSetTheme={setTheme} />;

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
      case 'creativity': return '🎨';
      default: return '📍';
    }
  };

  return (
    <div className="min-h-screen text-[var(--text-primary)] overflow-hidden font-sans transition-colors duration-500 flex flex-col">
      <div className="w-full sm:max-w-md mx-auto h-[100dvh] flex flex-col relative z-10 overflow-hidden">
        <header className="p-3 sm:p-5 pb-2 flex justify-between items-center z-40 relative">
           <Logo height={32} mood={getLogoMood(dailyStats.mood)} level={profile.level} />
           <div className="flex items-center gap-2">
             <ThemeSelector currentTheme={theme} onSelect={setTheme} />
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
            <NavBtn active={currentView === AppView.DASHBOARD} onClick={() => { setCurrentView(AppView.DASHBOARD); setActiveEcosystem(null); }} emoji={getNavEmoji('dashboard')} />
            <NavBtn active={currentView === AppView.SCHEDULER} onClick={() => { setCurrentView(AppView.SCHEDULER); setActiveEcosystem(null); }} emoji={getNavEmoji('scheduler')} />
            <NavBtn active={currentView === AppView.SMART_PLANNER} onClick={() => { setCurrentView(AppView.SMART_PLANNER); setActiveEcosystem(null); }} emoji={getNavEmoji('smart_planner')} />
            {(profile.enabledEcosystems || []).filter(e => visibleNavItems.includes(e.type)).map(eco => (
                <NavBtn key={eco.type} active={currentView === AppView.ECOSYSTEM && activeEcosystem === eco.type} onClick={() => { setCurrentView(AppView.ECOSYSTEM); setActiveEcosystem(eco.type); }} emoji={getNavEmoji(eco.type)} />
            ))}
            {visibleNavItems.includes('notes') && <NavBtn active={currentView === AppView.NOTES} onClick={() => { setCurrentView(AppView.NOTES); setActiveEcosystem(null); }} emoji={getNavEmoji('notes')} />}
            {visibleNavItems.includes('chat') && <NavBtn active={currentView === AppView.CHAT} onClick={() => { setCurrentView(AppView.CHAT); setActiveEcosystem(null); }} emoji={getNavEmoji('chat')} />}
          </div>
        </nav>
      </div>

      {showSettings && <SettingsModal 
        user={profile} lang={language} onUpdate={handleUpdateProfile} 
        onLanguageChange={setLanguage} onClose={() => setShowSettings(false)} 
      />}

      {helpContext && profile && (
        <ContextHelpOverlay
            context={helpContext}
            profile={profile}
            lang={language || 'en'}
            onClose={() => setHelpContext(null)}
        />
      )}
    </div>
  );
}

const NavBtn: React.FC<{ active: boolean, onClick: () => void, emoji: string }> = ({ active, onClick, emoji }) => (
  <button onClick={onClick} className={`w-9 h-9 sm:w-12 sm:h-12 shrink-0 rounded-[14px] sm:rounded-[22px] flex items-center justify-center transition-all duration-300 relative ${active ? 'bg-[var(--bg-active)] text-[var(--bg-active-text)] shadow-lg scale-110' : 'grayscale opacity-60 hover:grayscale-0 hover:opacity-100 hover:bg-white/5'}`}>
    <span className="text-sm sm:text-xl">{emoji}</span>
    {active && <div className="absolute -bottom-1.5 w-1 h-1 bg-[var(--theme-accent)] rounded-full shadow-[0_0_8px_var(--theme-accent)]" />}
  </button>
);
