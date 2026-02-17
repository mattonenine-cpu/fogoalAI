
import React, { useState } from 'react';
import { UserProfile, Language, TRANSLATIONS, EnergyProfile, Goal, EcosystemConfig, AppTheme, EcosystemType } from '../types';
import { GlassCard, GlassInput, GlassButton } from './GlassCard';
import { analyzeEcosystemSignals } from '../services/geminiService';
import { authService } from '../services/authService';
import { ThemeSelector } from './ThemeSelector';
import { Mascot } from './Mascot';
import { Logo } from './Logo';
import { Sparkles, ArrowRight, ArrowLeft, Battery, Zap, Brain, Shield, Plus, Loader2, Check, X, Lock, User, LogIn, ChevronDown, Trophy, GraduationCap, Heart, Palette, Briefcase, Info } from 'lucide-react';

interface OnboardingProps {
  onComplete: (profile: UserProfile) => void;
  lang: Language;
  currentTheme: AppTheme;
  onSetTheme: (theme: AppTheme) => void;
}

const ECO_CONFIG: Record<string, { color: string, icon: any }> = {
    sport: { color: '#f97316', icon: Trophy }, // Orange
    study: { color: '#6366f1', icon: GraduationCap }, // Indigo
    health: { color: '#ec4899', icon: Heart }, // Pink
    creativity: { color: '#a855f7', icon: Palette }, // Purple
    work: { color: '#3b82f6', icon: Briefcase } // Blue
};

const ECO_DETAILS: Record<string, { en: { inside: string, whom: string }, ru: { inside: string, whom: string } }> = {
    sport: {
        en: { inside: "Smart workout generator, technique guides, rest timer, and progress tracking.", whom: "Fitness enthusiasts, beginners, and anyone wanting to stay active." },
        ru: { inside: "Генератор тренировок, гид по технике, таймер и трекинг прогресса.", whom: "Для тех, кто хочет набрать форму, похудеть или тренироваться умнее." }
    },
    study: {
        en: { inside: "Exam prep wizard, AI flashcards, glossary generator, spaced repetition.", whom: "Students, certification seekers, and lifelong learners." },
        ru: { inside: "Мастер экзаменов, ИИ-карточки, словарь и интервальное повторение.", whom: "Студенты, специалисты и все, кто изучает сложные предметы." }
    },
    health: {
        en: { inside: "Vitality monitoring, burnout prevention, sleep & stress analytics.", whom: "High performers managing stress and prioritizing well-being." },
        ru: { inside: "Мониторинг витальности, защита от выгорания, анализ сна и стресса.", whom: "Люди с высоким уровнем стресса и те, кто следит за здоровьем." }
    },
    creativity: {
        en: { inside: "AI Art canvas, idea generator.", whom: "Artists, designers, and hobbyists looking for inspiration." },
        ru: { inside: "ИИ-холст, генератор идей и муза.", whom: "Художники, дизайнеры и все, кто ищет вдохновение." }
    }
};

const ONBOARDING_GOAL_COLORS = ['#6366f1', '#ef4444', '#f59e0b', '#10b981', '#ec4899', '#8b5cf6'];

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete, lang, currentTheme, onSetTheme }) => {
  const t = TRANSLATIONS[lang] || TRANSLATIONS['en'];
  
  // Auth State
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'setup'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Setup State
  // Steps: 1=Goals, 2=Energy, 3=Drains, 4=Review
  const [step, setStep] = useState(1);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [signals, setSignals] = useState<EcosystemConfig[]>([]);
  const [goalText, setGoalText] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  const [profile, setProfile] = useState<Partial<UserProfile>>({
    name: '',
    occupation: '',
    goals: [],
    bedtime: '23:00',
    wakeTime: '07:00',
    activityHistory: [new Date().toISOString().split('T')[0]], 
    energyProfile: {
        energyPeaks: [],
        energyDips: [],
        recoverySpeed: 'average',
        resistanceTriggers: []
    }
  });

  const handleLogin = async () => {
      if (!username || !password) return;
      setIsAuthenticating(true);
      setAuthError(null);
      
      const res = await authService.login(username, password);
      
      if (res.success) {
          const loadedProfileStr = localStorage.getItem('focu_profile');
          if (loadedProfileStr) {
              onComplete(JSON.parse(loadedProfileStr));
          } else {
              setProfile(prev => ({ ...prev, name: username }));
              setAuthMode('setup'); 
          }
      } else {
          setAuthError(t.authError);
      }
      setIsAuthenticating(false);
  };

  const handleStartSignup = () => {
      if (!username || !password) {
          setAuthError('Enter credentials');
          return;
      }
      // Initialize profile with username as name
      setProfile(prev => ({ ...prev, name: username, occupation: 'Explorer' }));
      setAuthMode('setup');
      setStep(1); // Start directly at goals (skipped old step 1)
      setAuthError(null);
  };

  const updateEnergy = (key: keyof EnergyProfile, value: any) => {
      setProfile(prev => ({
          ...prev,
          energyProfile: { ...prev.energyProfile!, [key]: value }
      }));
  };

  const toggleArrayItem = (key: 'energyPeaks' | 'energyDips' | 'resistanceTriggers', value: string) => {
    const current = profile.energyProfile?.[key] || [];
    const updated = current.includes(value as any) 
        ? current.filter((i: any) => i !== value)
        : [...current, value];
    updateEnergy(key, updated);
  };

  const handleAddGoal = () => {
      if (goalText.trim()) {
          const randomColor = ONBOARDING_GOAL_COLORS[Math.floor(Math.random() * ONBOARDING_GOAL_COLORS.length)];
          const newGoal: Goal = { 
              id: Date.now().toString(), 
              title: goalText.trim(), 
              progress: 0, 
              target: 100, 
              unit: '%', 
              completed: false, 
              timeframe: 'Month',
              color: randomColor
          };
          setProfile(p => ({
              ...p, 
              goals: [...(p.goals || []), newGoal]
          }));
          setGoalText('');
      }
  };

  const handleNext = async () => {
    if (step === 1 && goalText.trim()) {
        handleAddGoal();
    }

    if (step === 3) {
      const defaultSignals: EcosystemConfig[] = [
          { type: 'sport', label: 'SPORT', icon: '💪', enabled: true, justification: lang === 'ru' ? 'Физическая форма' : 'Physical well-being' },
          { type: 'study', label: 'STUDY', icon: '📚', enabled: true, justification: lang === 'ru' ? 'Обучение и развитие' : 'Learning & Development' },
          { type: 'health', label: 'HEALTH', icon: '❤️', enabled: true, justification: lang === 'ru' ? 'Здоровье и энергия' : 'Health & Vitality' },
          { type: 'creativity', label: 'CREATIVITY', icon: '🎨', enabled: true, justification: lang === 'ru' ? 'Творческий потенциал' : 'Creative outlet' }
      ];
      setSignals(defaultSignals);
      setStep(4);
      return;
    }

    if (step === 4) {
        setIsAuthenticating(true);
        const enabledEcosystems = signals.filter(s => s.enabled);
        const ecosystemViews = enabledEcosystems.map(e => e.type);
        
        const finalProfile: UserProfile = {
            ...profile,
            username: username,
            goals: profile.goals || [],
            isOnboarded: true,
            enabledEcosystems,
            level: 1,
            totalExperience: 0,
            statsHistory: [],
            settings: {
                aiPersona: 'balanced',
                aiDetailLevel: 'medium',
                visibleViews: ['dashboard', 'scheduler', 'chat', 'notes', ...ecosystemViews],
                fontSize: 'large' // Default to large
            }
        } as UserProfile;

        const res = await authService.register(username, password, {
            profile: finalProfile,
            tasks: [],
            notes: [],
            folders: [],
            stats: { focusScore: 0, tasksCompleted: 0, streakDays: 0, mood: 'Neutral', sleepHours: 7.5, activityHistory: [], apiRequestsCount: 0, lastRequestDate: new Date().toISOString().split('T')[0] }
        });

        if (res.success) {
            onComplete(finalProfile);
        } else {
            setAuthError(res.message === 'exists' ? t.authExists : 'Registration failed');
            setAuthMode('signup');
            setStep(1);
        }
        setIsAuthenticating(false);
    } else {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    } else {
        setAuthMode('signup');
    }
  };

  const toggleSignal = (type: string) => {
      setSignals(prev => prev.map(s => s.type === type ? { ...s, enabled: !s.enabled } : s));
  };

  // Render Auth Screens
  if (authMode === 'login' || authMode === 'signup') {
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--bg-main)] transition-colors duration-500">
            <div className="absolute top-6 right-6"><ThemeSelector currentTheme={currentTheme} onSelect={onSetTheme} /></div>
            <div className="w-full max-w-sm">
                <div className="text-center mb-10">
                    <div className="flex justify-center mb-2">
                        <Logo height={56} />
                    </div>
                    <p className="text-[var(--text-secondary)] text-xs font-bold uppercase tracking-[0.2em] mt-2">Intelligent Life OS</p>
                </div>

                <GlassCard className="p-8 bg-[var(--bg-card)] border-[var(--border-glass)] rounded-[40px] shadow-2xl relative overflow-hidden backdrop-blur-xl">
                    <div className="flex bg-[var(--bg-main)]/50 rounded-full p-1 mb-8 border border-[var(--border-glass)]">
                        <button 
                            onClick={() => { setAuthMode('login'); setAuthError(null); }}
                            className={`flex-1 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${authMode === 'login' ? 'bg-[var(--bg-active)] text-[var(--bg-active-text)] shadow-lg' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                        >
                            {t.authLogin}
                        </button>
                        <button 
                            onClick={() => { setAuthMode('signup'); setAuthError(null); }}
                            className={`flex-1 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${authMode === 'signup' ? 'bg-[var(--bg-active)] text-[var(--bg-active-text)] shadow-lg' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                        >
                            {t.authSignup}
                        </button>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase px-2">{t.authUsername}</label>
                            <div className="relative">
                                <User className="absolute left-4 top-3.5 text-[var(--text-secondary)]" size={16} />
                                <input 
                                    value={username}
                                    onChange={e => setUsername(e.target.value)}
                                    className="w-full bg-black/5 border border-white/10 rounded-2xl pl-12 pr-4 py-3 text-[13px] text-[var(--text-primary)] focus:outline-none focus:bg-black/10 focus:border-[var(--theme-accent)] transition-all duration-300 backdrop-blur-3xl placeholder-slate-400 hover:bg-black/10"
                                    placeholder="Username"
                                />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase px-2">{t.authPassword}</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-3.5 text-[var(--text-secondary)]" size={16} />
                                <input 
                                    type="password"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    className="w-full bg-black/5 border border-white/10 rounded-2xl pl-12 pr-4 py-3 text-[13px] text-[var(--text-primary)] focus:outline-none focus:bg-black/10 focus:border-[var(--theme-accent)] transition-all duration-300 backdrop-blur-3xl placeholder-slate-400 hover:bg-black/10"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        {authError && (
                            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold text-center animate-fade-in-up">
                                {authError}
                            </div>
                        )}

                        <button 
                            onClick={authMode === 'login' ? handleLogin : handleStartSignup}
                            disabled={!username || !password || isAuthenticating}
                            className="w-full h-14 bg-[var(--bg-active)] text-[var(--bg-active-text)] rounded-full font-black uppercase tracking-widest text-[11px] shadow-lg shadow-[var(--theme-glow)] active:scale-95 transition-all mt-4 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isAuthenticating ? <Loader2 className="animate-spin" size={18}/> : (authMode === 'login' ? <LogIn size={18}/> : <ArrowRight size={18}/>)}
                            {authMode === 'login' ? t.authLogin : t.authCreate}
                        </button>

                        {authMode === 'login' && (
                            <a
                                href={`${typeof window !== 'undefined' ? window.location.origin + (window.location.pathname || '') : ''}?show_telegram_widget=login`}
                                className="mt-4 flex items-center justify-center gap-2 w-full py-3 rounded-full border border-[var(--theme-accent)]/40 text-[var(--theme-accent)] text-[11px] font-bold hover:bg-[var(--theme-accent)]/10 transition-all"
                            >
                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.69 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.79-1.15 3.37-1.35 3.65-1.35.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/></svg>
                                {lang === 'ru' ? 'Войти через Telegram' : 'Log in with Telegram'}
                            </a>
                        )}
                    </div>
                </GlassCard>
                
                <p className="text-center text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-widest mt-8 opacity-50">
                    FoGoal v2.0 • Secure Cloud Sync
                </p>
            </div>
        </div>
      );
  }

  // Render Setup Steps
  const renderStep = () => {
      switch(step) {
          case 1: // Goals (formerly Step 2)
              return (
                  <div className="space-y-4 animate-fade-in-up w-full">
                      <div className="space-y-3">
                          <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.2em] px-1 block mb-1">{t.mainGoals}</label>
                          <div className="flex gap-2">
                            <GlassInput 
                                value={goalText}
                                onChange={e => setGoalText(e.target.value)}
                                placeholder={t.goalPlaceholder} 
                                onKeyDown={e => e.key === 'Enter' && handleAddGoal()}
                            />
                            <button onClick={handleAddGoal} className="w-12 h-12 rounded-2xl bg-white/5 border border-[var(--border-glass)] flex items-center justify-center text-[var(--text-primary)] hover:bg-white/10 active:scale-90 transition-all"><Plus size={20}/></button>
                          </div>
                          
                          {/* User Added Goals */}
                          {profile.goals && profile.goals.length > 0 && (
                              <div className="flex flex-wrap gap-2 mt-2 max-h-32 overflow-y-auto scrollbar-hide">
                                  {profile.goals.map(g => (
                                      <span key={g.id} className="px-3 py-1 bg-[var(--theme-accent)]/10 border border-[var(--theme-accent)]/20 rounded-full text-[10px] font-bold text-[var(--text-primary)] flex items-center gap-2">
                                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: g.color || '#6366f1' }} />
                                          {g.title} 
                                          <button onClick={() => setProfile(p => ({...p, goals: p.goals?.filter(gl => gl.id !== g.id)}))} className="hover:text-[var(--text-primary)] opacity-50 hover:opacity-100 transition-colors"><X size={10}/></button>
                                      </span>
                                  ))}
                              </div>
                          )}

                          {/* Fixed Example Goal Card */}
                          <div className="mt-4 pt-4 border-t border-[var(--border-glass)]">
                              <p className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest mb-3 opacity-60 px-1">{lang === 'ru' ? 'ПРИМЕР ОТОБРАЖЕНИЯ:' : 'EXAMPLE PREVIEW:'}</p>
                              <div className="p-4 rounded-[24px] bg-[var(--bg-card)] border border-[var(--border-glass)] flex flex-col gap-2 relative overflow-hidden opacity-80 pointer-events-none">
                                  <div className="absolute bottom-0 left-0 h-1 bg-white/5 w-full">
                                      <div className="h-full bg-[#6366f1]" style={{ width: `65%` }} />
                                  </div>
                                  <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-3">
                                          <div className="w-2 h-2 rounded-full bg-[#6366f1]" />
                                          <span className="text-[11px] font-bold text-[var(--text-primary)]">{lang === 'ru' ? 'Выучить английские слова' : 'Learn English Words'}</span>
                                      </div>
                                      <span className="text-[9px] font-black text-slate-500">65%</span>
                                  </div>
                                  <div className="flex justify-between items-end px-1">
                                      <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">1300 / 2000 {lang === 'ru' ? 'слов' : 'words'}</span>
                                  </div>
                              </div>
                          </div>
                      </div>
                  </div>
              );
          case 2: // Energy (formerly Step 3)
              return (
                  <div className="space-y-6 animate-fade-in-up w-full">
                      <div>
                          <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.2em] px-1 mb-3 block">{t.peakQuestion}</label>
                          <div className="grid grid-cols-2 gap-2">
                              {['morning', 'midday', 'evening', 'night'].map(time => (
                                  <button key={time} onClick={() => toggleArrayItem('energyPeaks', time)} className={`py-3 rounded-xl text-[11px] font-black uppercase transition-all border ${profile.energyProfile?.energyPeaks.includes(time as any) ? 'bg-[var(--bg-active)] text-[var(--bg-active-text)] border-[var(--bg-active)]' : 'bg-white/5 border-[var(--border-glass)] text-[var(--text-secondary)]'}`}>{t[time as keyof typeof t]}</button>
                              ))}
                          </div>
                      </div>
                      <div>
                          <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest px-1 mb-3 block">{t.recoveryQuestion}</label>
                          <div className="grid grid-cols-3 gap-2">
                              {['fast', 'average', 'slow'].map(speed => (
                                  <button key={speed} onClick={() => updateEnergy('recoverySpeed', speed)} className={`py-3 rounded-xl text-[10px] font-black uppercase transition-all border ${profile.energyProfile?.recoverySpeed === speed ? 'bg-[var(--bg-active)] text-[var(--bg-active-text)] border-[var(--bg-active)]' : 'bg-white/5 border-[var(--border-glass)] text-[var(--text-secondary)]'}`}>{t[speed as keyof typeof t]}</button>
                              ))}
                          </div>
                      </div>
                  </div>
              );
          case 3: // Drains (formerly Step 4)
              return (
                  <div className="space-y-5 animate-fade-in-up w-full">
                      <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.2em] px-1 block">{t.drainQuestion}</label>
                      <div className="grid grid-cols-2 gap-2">
                          {[t.longMeetings, t.socialInteraction, t.decisionMaking, t.monotony, t.uncertainty, t.deadlines].map(opt => (
                              <button key={opt} onClick={() => toggleArrayItem('resistanceTriggers', opt)} className={`p-3 rounded-xl text-[10px] font-bold text-left transition-all border ${profile.energyProfile?.resistanceTriggers.includes(opt) ? 'bg-rose-500/20 border-rose-500 text-rose-400' : 'bg-white/5 border-[var(--border-glass)] text-[var(--text-secondary)]'}`}>{opt}</button>
                          ))}
                      </div>
                  </div>
              );
          case 4: // Review (formerly Step 6)
              if (isAuthenticating) return <div className="flex flex-col items-center justify-center h-64 w-full"><Loader2 size={48} className="text-[var(--theme-accent)] animate-spin mb-4" /><p className="text-xs font-black uppercase tracking-widest text-[var(--text-secondary)]">{t.thinking}</p></div>;
              return (
                  <div className="space-y-4 animate-fade-in-up w-full">
                      <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-2 text-center">{t.signalsDesc}</p>
                      <div className="grid grid-cols-1 gap-3 max-h-[300px] overflow-y-auto scrollbar-hide px-1">
                          {signals.map(sig => {
                              const details = ECO_DETAILS[sig.type]?.[lang === 'ru' ? 'ru' : 'en'];
                              const config = ECO_CONFIG[sig.type] || ECO_CONFIG.work;
                              const isExpanded = expandedId === sig.type;
                              const Icon = config.icon;
                              
                              return (
                                  <div 
                                    key={sig.type} 
                                    onClick={() => setExpandedId(isExpanded ? null : sig.type)}
                                    className={`p-5 rounded-[28px] border transition-all duration-300 cursor-pointer group shadow-sm active:scale-[0.98] relative overflow-hidden`}
                                    style={{
                                        backgroundColor: sig.enabled ? 'var(--theme-glow)' : 'rgba(255,255,255,0.02)',
                                        borderColor: sig.enabled ? 'var(--theme-accent)' : 'var(--border-glass)',
                                        opacity: sig.enabled ? 1 : 0.6
                                    }}
                                  >
                                      <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-5">
                                              <div 
                                                className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-md transition-colors duration-300" 
                                                style={{ 
                                                    backgroundColor: sig.enabled ? `${config.color}15` : 'rgba(255,255,255,0.05)', 
                                                    color: sig.enabled ? config.color : 'var(--text-secondary)',
                                                    border: `1px solid ${sig.enabled ? config.color + '30' : 'transparent'}`
                                                }}
                                              >
                                                  <Icon size={24} />
                                              </div>
                                              <div className="pr-4">
                                                  <div className="flex items-center gap-2">
                                                      <h4 className={`text-[13px] font-black uppercase tracking-tight ${sig.enabled ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>{t[`eco_${sig.type}` as keyof typeof t] || sig.label}</h4>
                                                      <button 
                                                        onClick={(e) => { e.stopPropagation(); setExpandedId(isExpanded ? null : sig.type); }}
                                                        className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/20 transition-all"
                                                      >
                                                          <Info size={10} />
                                                      </button>
                                                  </div>
                                                  <p className="text-[10px] text-[var(--text-secondary)] font-medium leading-tight mt-1 opacity-80">{sig.justification}</p>
                                              </div>
                                          </div>
                                          <button 
                                            onClick={(e) => { e.stopPropagation(); toggleSignal(sig.type); }}
                                            className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all z-10 shadow-lg`}
                                            style={{
                                                backgroundColor: sig.enabled ? 'var(--theme-accent)' : 'transparent',
                                                borderColor: sig.enabled ? 'var(--theme-accent)' : 'var(--border-glass)',
                                                color: sig.enabled ? 'var(--bg-active-text)' : 'transparent'
                                            }}
                                          >
                                              {sig.enabled ? <Check size={14} strokeWidth={3} /> : <div className="w-2 h-2 rounded-full bg-white/20" />}
                                          </button>
                                      </div>
                                      
                                      <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${isExpanded ? 'grid-rows-[1fr] opacity-100 mt-4 pt-4 border-t border-white/5' : 'grid-rows-[0fr] opacity-0'}`}>
                                          <div className="overflow-hidden">
                                              <div className="space-y-3">
                                                  <div>
                                                      <p className="text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: config.color }}>{lang === 'ru' ? 'ЧТО ВНУТРИ' : 'INSIDE'}</p>
                                                      <p className="text-[11px] font-medium text-[var(--text-primary)] leading-relaxed opacity-90">{details?.inside}</p>
                                                  </div>
                                                  <div>
                                                      <p className="text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: config.color }}>{lang === 'ru' ? 'ДЛЯ КОГО' : 'FOR WHOM'}</p>
                                                      <p className="text-[11px] font-medium text-[var(--text-primary)] leading-relaxed opacity-90">{details?.whom}</p>
                                                  </div>
                                              </div>
                                          </div>
                                      </div>
                                      
                                      {!isExpanded && sig.enabled && (
                                          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-40 transition-opacity">
                                              <ChevronDown size={12} className="text-[var(--text-secondary)] animate-bounce" />
                                          </div>
                                      )}
                                  </div>
                              );
                          })}
                      </div>
                  </div>
              );
      }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--bg-main)] transition-colors duration-500">
      <div className="absolute top-6 right-6"><ThemeSelector currentTheme={currentTheme} onSelect={onSetTheme} /></div>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="mb-4 flex justify-center">
             <Logo height={48} level={1} />
          </div>
          <h1 className="text-2xl font-black text-[var(--text-primary)] mb-1 uppercase tracking-tighter">{step === 4 ? t.signalsFound : (step === 2 ? t.energyTitle : (step === 1 ? t.mainGoals : t.energyTitle))}</h1>
          <p className="text-[var(--text-secondary)] text-[9px] font-black uppercase tracking-[0.3em]">{step === 4 ? 'FINAL REVIEW' : `${step}/4`}</p>
        </div>
        <GlassCard className="p-7 min-h-[320px] flex flex-col relative overflow-hidden bg-[var(--bg-card)] border-[var(--border-glass)] rounded-[44px] shadow-2xl transition-all duration-500">
            <div className={`flex-1 flex flex-col items-center pt-2 ${step >= 3 ? 'justify-start' : 'justify-center'}`}>{renderStep()}</div>
            <div className="flex justify-between items-center mt-6 pt-5 border-t border-[var(--border-glass)]">
                <button onClick={handleBack} className="w-12 h-12 rounded-full bg-white/5 border border-[var(--border-glass)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all active:scale-90">{step > 1 ? <ArrowLeft size={20}/> : <X size={20}/>}</button>
                <button onClick={handleNext} className="px-8 py-4 rounded-full bg-[var(--bg-active)] text-[var(--bg-active-text)] font-black text-[11px] uppercase tracking-widest flex items-center gap-3 hover:opacity-90 transition-all shadow-xl active:scale-95">{step === 4 ? t.confirmEcosystems : t.next} <ArrowRight size={14} strokeWidth={3} /></button>
            </div>
        </GlassCard>
      </div>
    </div>
  );
};

