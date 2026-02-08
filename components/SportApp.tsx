import React, { useState, useMemo, useEffect, useRef } from 'react';
import { UserProfile, Language, TRANSLATIONS, WorkoutPlan, Exercise, FitnessGoal, FitnessLevel, Task, Category, AppTheme } from '../types';
import { GlassCard, GlassInput } from './GlassCard';
import { generateWorkout, getExerciseTechnique, createChatSession, cleanTextOutput, getLocalISODate } from '../services/geminiService';
import { Trophy, Dumbbell, Zap, Play, Pause, CheckCircle2, ChevronRight, X, Loader2, Bot, Info, RefreshCw, Clock, Timer as TimerIcon, Plus, User, MessageCircle, Send, Star, TrendingUp, Check } from 'lucide-react';

interface SportAppProps {
  user: UserProfile;
  lang: Language;
  onUpdateProfile: (profile: UserProfile) => void;
  onAddTasks?: (tasks: Task[]) => void;
  theme: AppTheme;
}

const EQUIPMENT_LIST = [
  { id: 'dumbbells', en: "Dumbbells", ru: "Гантели" },
  { id: 'barbell', en: "Barbell", ru: "Штанга" },
  { id: 'pullup', en: "Pull-up Bar", ru: "Турник" },
  { id: 'dip', en: "Dip Bars", ru: "Брусья" },
  { id: 'smith', en: "Smith Machine", ru: "Тренажер Смита" },
  { id: 'leg_press', en: "Leg Press", ru: "Жим ногами" },
  { id: 'cable', en: "Cable Machine", ru: "Тяга блока" },
  { id: 'mat', en: "Yoga Mat", ru: "Коврик" },
  { id: 'kettlebell', en: "Kettlebells", ru: "Гири" },
  { id: 'crossover', en: "Crossover", ru: "Кроссовер" }
];

const FIT_LEVEL_LABELS: Record<FitnessLevel, { en: string, ru: string }> = {
    [FitnessLevel.BEGINNER]: { en: 'Beginner', ru: 'Новичок' },
    [FitnessLevel.INTERMEDIATE]: { en: 'Intermediate', ru: 'Любитель' },
    [FitnessLevel.ADVANCED]: { en: 'Advanced', ru: 'Профи' }
};

const FIT_GOAL_LABELS: Record<FitnessGoal, { en: string, ru: string }> = {
    [FitnessGoal.WEIGHT_LOSS]: { en: 'Weight Loss', ru: 'Похудение' },
    [FitnessGoal.MUSCLE_GAIN]: { en: 'Muscle Gain', ru: 'Набор массы' },
    [FitnessGoal.GENERAL]: { en: 'General Fitness', ru: 'Общая форма' },
    [FitnessGoal.ENDURANCE]: { en: 'Endurance', ru: 'Выносливость' }
};

// --- Text Rendering Helpers for Chat ---
const parseBold = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, idx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={idx} className="font-black opacity-90">{part.slice(2, -2)}</strong>;
        }
        return part;
    });
};

const renderMessageContent = (text: string, isUser: boolean) => {
    return text.split('\n').map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} className="h-2" />;
        
        if (trimmed.startsWith('### ') || trimmed.startsWith('## ')) {
            const content = trimmed.replace(/^#+\s+/, '');
            return <h3 key={i} className={`text-xs font-black uppercase tracking-widest mt-3 mb-1 ${isUser ? 'text-white' : 'text-orange-500'}`}>{parseBold(content)}</h3>;
        }
        
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
             return (
                <div key={i} className="flex gap-2 pl-2 mb-1">
                    <span className={`font-black ${isUser ? 'text-white/60' : 'text-orange-400'}`}>•</span>
                    <span className="text-[13px] leading-relaxed">{parseBold(trimmed.replace(/^[\-\*]\s+/, ''))}</span>
                </div>
            );
        }

        return <p key={i} className="text-[13px] leading-relaxed mb-1">{parseBold(line)}</p>;
    });
};
// ----------------------------------------

const SportNoteRenderer: React.FC<{ text: string }> = ({ text }) => {
    const lines = text.split('\n');
    return (
        <div className="space-y-5 text-[var(--text-secondary)] leading-relaxed font-medium">
            {lines.map((line, idx) => {
                const trimmed = line.trim();
                if (!trimmed) return <div key={idx} className="h-2" />;
                if (trimmed.startsWith('# ')) {
                    return (
                        <h1 key={idx} className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-200 tracking-tighter pt-1 pb-4 mb-4 uppercase text-center border-b border-orange-500/20">
                            {trimmed.substring(2)}
                        </h1>
                    );
                }
                if (trimmed.startsWith('## ')) {
                    return (
                        <div key={idx} className="pt-6 mt-2 mb-3">
                            <h2 className="text-lg font-black text-orange-500 tracking-widest uppercase flex items-center gap-3">
                                <span className="w-1 h-5 bg-orange-600 rounded-full"></span>
                                {trimmed.substring(3)}
                            </h2>
                        </div>
                    );
                }
                if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                    return (
                        <div key={idx} className="flex items-start gap-3 pl-1 group">
                            <div className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-2.5 shrink-0 group-hover:scale-125 transition-transform shadow-[0_0_8px_rgba(249,115,22,0.5)]" />
                            <p className="text-[15px] leading-relaxed text-[var(--text-primary)] flex-1">{renderBoldText(trimmed.substring(2))}</p>
                        </div>
                    );
                }
                return <p key={idx} className="text-[15px] leading-7 text-[var(--text-primary)] font-normal tracking-wide pl-1">{renderBoldText(trimmed)}</p>;
            })}
        </div>
    );
};

export const SportApp: React.FC<SportAppProps> = ({ user, lang, onUpdateProfile, onAddTasks, theme }) => {
  const t = TRANSLATIONS[lang] || TRANSLATIONS['en'];
  const [activePlan, setActivePlan] = useState<WorkoutPlan | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedEq, setSelectedEq] = useState<string[]>(user.fitnessEquipment || []);
  const [customEq, setCustomEq] = useState('');
  
  const [workoutSeconds, setWorkoutSeconds] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [restSeconds, setRestSeconds] = useState(0);
  const [isResting, setIsResting] = useState(false);
  
  const [showSummary, setShowSummary] = useState(false);
  const [earnedXp, setEarnedXp] = useState(0);
  
  const isLightTheme = theme === 'white' || theme === 'ice' || theme === 'lilac';

  const [showCoachChat, setShowCoachChat] = useState(false);
  const [coachMessages, setCoachMessages] = useState<{role: 'user' | 'model', text: string}[]>([]);
  const [coachInput, setCoachInput] = useState('');
  const [coachLoading, setCoachLoading] = useState(false);
  const coachSessionRef = useRef<any>(null);
  const coachEndRef = useRef<HTMLDivElement>(null);

  const [activeExercise, setActiveExercise] = useState<Exercise | null>(null);
  const [techniqueText, setTechniqueText] = useState('');
  const [isLoadingTechnique, setIsLoadingTechnique] = useState(false);
  const [completedIds, setCompletedIds] = useState<string[]>([]);

  const [onboardingProfile, setOnboardingProfile] = useState({
      weight: user.weight || 70,
      height: user.height || 175,
      gender: user.gender || 'male',
      level: user.fitnessLevel || FitnessLevel.BEGINNER,
      goal: user.fitnessGoal || FitnessGoal.GENERAL
  });

  useEffect(() => {
    let interval: any;
    if (activePlan && !isPaused && !isResting) {
      interval = setInterval(() => {
        setWorkoutSeconds(s => s + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [activePlan, isPaused, isResting]);

  useEffect(() => {
    let interval: any;
    if (isResting && restSeconds > 0) {
      interval = setInterval(() => {
        setRestSeconds(s => {
          if (s <= 1) {
            setIsResting(false);
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isResting, restSeconds]);

  // Robust Scroll Logic
  useEffect(() => {
      if (showCoachChat) {
          setTimeout(() => {
              coachEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
          }, 100);
      }
  }, [coachMessages.length, coachLoading, showCoachChat]);

  const toggleEq = (item: { en: string, ru: string }) => {
    const isSelected = selectedEq.includes(item.en) || selectedEq.includes(item.ru);
    
    let updated = [...selectedEq];
    if (isSelected) {
        // Remove both variants to be safe
        updated = updated.filter(e => e !== item.en && e !== item.ru);
    } else {
        // Add current language variant
        const val = lang === 'ru' ? item.ru : item.en;
        updated.push(val);
    }
    
    setSelectedEq(updated);
    onUpdateProfile({ ...user, fitnessEquipment: updated });
  };

  const handleAddCustomEq = () => {
    if (customEq.trim() && !selectedEq.includes(customEq.trim())) {
        const updated = [...selectedEq, customEq.trim()];
        setSelectedEq(updated);
        setCustomEq('');
        onUpdateProfile({ ...user, fitnessEquipment: updated });
    }
  };

  const handleFinishOnboarding = () => {
      onUpdateProfile({
          ...user,
          weight: onboardingProfile.weight,
          height: onboardingProfile.height,
          gender: onboardingProfile.gender as any,
          fitnessLevel: onboardingProfile.level,
          fitnessGoal: onboardingProfile.goal,
          fitnessOnboarded: true
      });
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
        const plan = await generateWorkout(user, lang);
        setActivePlan(plan);
        setCompletedIds([]);
        setWorkoutSeconds(0);
        setIsPaused(false);
        setIsResting(false);
    } catch (e) {
        console.error(e);
    } finally {
        setIsGenerating(false);
    }
  };

  const handleFinishWorkout = () => {
      const xp = 50 + (completedIds.length * 15);
      setEarnedXp(xp);
      
      let newXp = (user.totalExperience || 0) + xp;
      let newLevel = user.level || 1;
      
      while (newXp >= newLevel * 100) {
          newXp -= newLevel * 100;
          newLevel += 1;
      }
      
      const completionMsg = t.sportWorkoutCompleted.replace('{title}', activePlan?.title || (lang === 'ru' ? 'тренировка' : 'workout'));
      onUpdateProfile({
          ...user,
          totalExperience: newXp,
          level: newLevel,
          activityHistory: [...(user.activityHistory || []), `SPORT: ${completionMsg}`]
      });
      
      setActivePlan(null);
      setShowSummary(true);
  };

  const openTechnique = async (ex: Exercise) => {
      setActiveExercise(ex);
      setIsLoadingTechnique(true);
      setTechniqueText('');
      try {
          const res = await getExerciseTechnique(ex.name, ex.equipment, lang);
          setTechniqueText(res);
      } catch (e) {
          console.error(e);
          setTechniqueText(lang === 'ru' ? 'Не удалось загрузить технику.' : 'Failed to load technique.');
      } finally {
          setIsLoadingTechnique(false);
      }
  };

  const toggleComplete = (ex: Exercise) => {
      const isMarkingDone = !completedIds.includes(ex.id);
      setCompletedIds(prev => isMarkingDone ? [...prev, ex.id] : prev.filter(i => i !== ex.id));
      if (isMarkingDone && ex.restSeconds > 0) {
          setRestSeconds(ex.restSeconds);
          setIsResting(true);
      }
  };

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSendCoachMsg = async () => {
      if (!coachInput.trim() || coachLoading) return;
      const textToSend = coachInput.trim();
      setCoachMessages(prev => [...prev, {role: 'user', text: textToSend}]);
      setCoachInput('');
      setCoachLoading(true);
      try {
          if (!coachSessionRef.current) {
              coachSessionRef.current = createChatSession(user, [], lang, [], 'sport');
          }
          let response = await coachSessionRef.current.sendMessage({ message: textToSend });
          if (response.text) {
              setCoachMessages(prev => [...prev, {role: 'model', text: cleanTextOutput(response.text || "")}]);
          }
      } catch (e) {
          setCoachMessages(prev => [...prev, {role: 'model', text: t.chatError}]);
      } finally {
          setCoachLoading(false);
      }
  };

  const getFitnessGoalLabel = (goal: FitnessGoal) => {
      return FIT_GOAL_LABELS[goal][lang === 'ru' ? 'ru' : 'en'] || goal;
  };

  const getFitnessLevelLabel = (level: FitnessLevel) => {
      return FIT_LEVEL_LABELS[level][lang === 'ru' ? 'ru' : 'en'] || level;
  };

  if (!user.fitnessOnboarded) {
      return (
          <div className="animate-fadeIn space-y-6">
              <div className="pb-[110px]">
                <GlassCard className="p-5 sm:p-8 border-[var(--border-glass)] rounded-[40px] shadow-2xl">
                    {/* ... Onboarding UI (using theme variables from GlassCard, so OK) ... */}
                    <div className="text-center mb-8">
                        <User className="w-12 h-12 text-orange-500 mx-auto mb-4" />
                        <h2 className="text-2xl font-black text-[var(--text-primary)] uppercase tracking-tighter">{t.sportOnboardingTitle}</h2>
                        <p className="text-xs text-[var(--text-secondary)] font-bold uppercase tracking-widest mt-1">{t.sportOnboardingSub}</p>
                    </div>
                    {/* ... Inputs ... */}
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase px-1">{t.sportWeight}</label>
                                <GlassInput type="number" value={onboardingProfile.weight} onChange={e => setOnboardingProfile({...onboardingProfile, weight: parseInt(e.target.value)})} />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase px-1">{t.sportHeight}</label>
                                <GlassInput type="number" value={onboardingProfile.height} onChange={e => setOnboardingProfile({...onboardingProfile, height: parseInt(e.target.value)})} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase px-1">{t.sportLevel}</label>
                            <div className="grid grid-cols-3 gap-2">
                                {Object.values(FitnessLevel).map(lv => (
                                    <button key={lv} onClick={() => setOnboardingProfile({...onboardingProfile, level: lv})} className={`py-3 rounded-xl text-[10px] font-black uppercase transition-all border ${onboardingProfile.level === lv ? 'bg-[var(--bg-active)] text-[var(--bg-active-text)] border-[var(--bg-active)]' : 'bg-black/5 border-[var(--border-glass)] text-[var(--text-secondary)]'}`}>{getFitnessLevelLabel(lv)}</button>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase px-1">{t.sportGoal}</label>
                            <div className="grid grid-cols-1 gap-2">
                                {Object.values(FitnessGoal).map(g => (
                                    <button key={g} onClick={() => setOnboardingProfile({...onboardingProfile, goal: g})} className={`py-3 px-4 rounded-xl text-[11px] font-black uppercase transition-all border text-left ${onboardingProfile.goal === g ? 'bg-orange-600 text-white border-orange-600' : 'bg-black/5 border-[var(--border-glass)] text-[var(--text-secondary)]'}`}>{getFitnessGoalLabel(g)}</button>
                                ))}
                            </div>
                        </div>
                    </div>
                    <button onClick={handleFinishOnboarding} className="w-full h-16 bg-[var(--bg-active)] rounded-full mt-10 text-[var(--bg-active-text)] font-black uppercase tracking-widest text-[12px] shadow-2xl active:scale-[0.98] transition-all">
                        {t.sportConfirmProfile}
                    </button>
                </GlassCard>
              </div>
          </div>
      );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {!activePlan ? (
          <div className="space-y-6">
              {/* Main Hub Dashboard */}
              <GlassCard className={`p-4 sm:p-6 border-[var(--border-glass)] rounded-[32px] relative overflow-hidden shadow-2xl bg-[var(--bg-card)]`}>
                  <div className="flex justify-between items-start mb-4">
                      <div>
                          <h2 className="text-2xl font-black text-[var(--text-primary)] tracking-tighter uppercase leading-none mb-1">{t.sportHubTitle}</h2>
                          <p className="text-[10px] text-orange-600 font-black uppercase tracking-[0.2em]">{t.sportHubSub}</p>
                      </div>
                      <Dumbbell className="text-orange-500/20" size={48} />
                  </div>
                  <div className="flex gap-4 mb-6">
                      <div className={`flex-1 p-3 rounded-2xl border bg-white/5 border-[var(--border-glass)]`}>
                          <p className={`text-[8px] font-black uppercase mb-1 text-[var(--text-secondary)]`}>{lang === 'ru' ? 'ЦЕЛЬ' : 'GOAL'}</p>
                          <p className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-tight truncate">{getFitnessGoalLabel(user.fitnessGoal || FitnessGoal.GENERAL)}</p>
                      </div>
                      <div className={`flex-1 p-3 rounded-2xl border bg-white/5 border-[var(--border-glass)]`}>
                          <p className={`text-[8px] font-black uppercase mb-1 text-[var(--text-secondary)]`}>{lang === 'ru' ? 'УРОВЕНЬ' : 'LEVEL'}</p>
                          <p className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-tight truncate">{getFitnessLevelLabel(user.fitnessLevel || FitnessLevel.BEGINNER)}</p>
                      </div>
                  </div>
                  <div className="space-y-4">
                      <h3 className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest">{t.sportEquipmentTitle}</h3>
                      <div className="flex flex-wrap gap-2">
                          {EQUIPMENT_LIST.map(eq => {
                              const active = selectedEq.includes(eq.en) || selectedEq.includes(eq.ru);
                              const label = lang === 'ru' ? eq.ru : eq.en;
                              return (
                                  <button 
                                    key={eq.id} 
                                    onClick={() => toggleEq(eq)}
                                    className={`px-4 py-2 rounded-full text-[11px] font-bold tracking-tight transition-all border ${active ? 'bg-orange-600 border-orange-600 text-white shadow-lg' : 'bg-black/5 border-[var(--border-glass)] text-[var(--text-secondary)]'}`}
                                  >
                                      {label}
                                  </button>
                              );
                          })}
                      </div>
                      <div className="flex gap-2">
                          <GlassInput 
                            value={customEq} 
                            onChange={e => setCustomEq(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAddCustomEq()}
                            placeholder={t.sportAddEquipment}
                            className={'bg-black/20'}
                          />
                          <button onClick={handleAddCustomEq} className={`w-11 h-11 rounded-full flex items-center justify-center active:scale-90 border transition-all bg-white/5 border-white/10 text-[var(--text-primary)]`}><Plus size={18}/></button>
                      </div>
                  </div>
              </GlassCard>
              <div className="grid grid-cols-2 gap-4">
                  <button onClick={handleGenerate} disabled={isGenerating} className={`h-24 rounded-[32px] flex flex-col items-center justify-center gap-2 font-black uppercase tracking-widest text-[11px] shadow-2xl active:scale-[0.98] transition-all disabled:opacity-50 bg-[var(--bg-card)] border border-[var(--border-glass)] text-[var(--text-primary)]`}>
                      {isGenerating ? <Loader2 className="animate-spin" size={24}/> : <><RefreshCw size={24}/> {t.sportGenerateBtn}</>}
                  </button>
                  <button onClick={() => { setShowCoachChat(true); if(coachMessages.length === 0) setCoachMessages([{role: 'model', text: t.sportCoachInit}])}} className={`h-24 border rounded-[32px] flex flex-col items-center justify-center gap-2 font-black uppercase tracking-widest text-[11px] shadow-2xl active:scale-[0.98] transition-all bg-[var(--bg-card)] border-[var(--border-glass)] text-[var(--text-primary)]`}>
                      <MessageCircle size={24} className="text-orange-500" />
                      {t.sportCoachChat}
                  </button>
              </div>
          </div>
      ) : (
          <div className="space-y-6 animate-fadeIn pb-32">
              {/* Active Workout View - keeping Orange as accent for Sport active state regardless of theme */}
              <div className="w-full bg-[#E85C1C] p-4 sm:p-6 rounded-[36px] flex items-center justify-between shadow-2xl shadow-orange-600/30">
                  <div className="flex items-center gap-5">
                      <button onClick={() => setIsPaused(!isPaused)} className="w-12 h-16 rounded-2xl bg-white/20 flex items-center justify-center text-white transition-all active:scale-90">
                        {isPaused ? <Play fill="white" size={24} className="ml-1" /> : <Pause fill="white" size={24} />}
                      </button>
                      <div className="text-left">
                          <h4 className="text-lg font-black text-white uppercase tracking-tight leading-none mb-2 max-w-[200px] truncate">{activePlan.title}</h4>
                          <div className="flex items-center gap-2 text-white/80 font-black uppercase text-[10px] tracking-widest">
                            <Clock size={12} strokeWidth={3} />
                            <span>{formatTime(workoutSeconds)}</span>
                          </div>
                      </div>
                  </div>
                  <button onClick={() => setActivePlan(null)} className="p-3 text-white/60 hover:text-white active:scale-90 transition-all"><X size={24} strokeWidth={3} /></button>
              </div>

              {isResting && (
                  <div className="animate-fadeIn p-4 sm:p-6 bg-blue-600 rounded-[36px] flex items-center justify-between shadow-2xl shadow-blue-500/30">
                    {/* ... */}
                    <div className="flex items-center gap-5">
                        <div className="w-12 h-16 rounded-2xl bg-white/20 flex items-center justify-center text-white">
                          <TimerIcon size={24} className="animate-pulse" />
                        </div>
                        <div className="text-left">
                            <h4 className="text-xl font-black text-white uppercase tracking-[0.2em] leading-none mb-1">{lang === 'ru' ? 'ОТДЫХ' : 'REST'}</h4>
                            <p className="text-[28px] font-black text-white tracking-tighter leading-none">{restSeconds}s</p>
                        </div>
                    </div>
                    <button onClick={() => setIsResting(false)} className="p-4 bg-white/20 rounded-full text-white font-black uppercase text-[10px] tracking-widest active:scale-90 transition-all">{lang === 'ru' ? 'ПРОПУСТИТЬ' : 'SKIP'}</button>
                  </div>
              )}

              <div className="space-y-4">
                  {(activePlan.exercises || []).map((ex, idx) => {
                      const isDone = completedIds.includes(ex.id);
                      return (
                          <GlassCard key={ex.id} className={`p-4 sm:p-6 rounded-[32px] border transition-all flex flex-col gap-4 ${isDone ? 'bg-emerald-500/5 border-emerald-500/20 opacity-60 grayscale' : 'border-[var(--border-glass)]'}`}>
                              {/* ... Exercise Card Content ... */}
                              <div className="flex justify-between items-start cursor-pointer" onClick={() => openTechnique(ex)}>
                                  <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-2">
                                        <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest">#{idx + 1}</span>
                                        {ex.equipment && <span className="text-[9px] font-bold text-[var(--text-secondary)] uppercase bg-white/5 px-2 py-0.5 rounded-full">{ex.equipment}</span>}
                                      </div>
                                      <h4 className={`text-base font-black tracking-tight leading-tight uppercase ${isDone ? 'line-through text-[var(--text-secondary)]' : 'text-[var(--text-primary)]'}`}>{ex.name}</h4>
                                      <div className="flex gap-2 mt-3">
                                          <div className="flex flex-col">
                                            <span className="text-[8px] font-black text-[var(--text-secondary)] uppercase">Сеты</span>
                                            <span className="text-sm font-black text-[var(--text-primary)]">{ex.sets}</span>
                                          </div>
                                          <div className="w-px h-6 bg-white/5 mx-2 self-center" />
                                          <div className="flex flex-col">
                                            <span className="text-[8px] font-black text-[var(--text-secondary)] uppercase">Повторы</span>
                                            <span className="text-sm font-black text-[var(--text-primary)]">{ex.reps}</span>
                                          </div>
                                          <div className="w-px h-6 bg-white/5 mx-2 self-center" />
                                          <div className="flex flex-col">
                                            <span className="text-[8px] font-black text-[var(--text-secondary)] uppercase">Отдых</span>
                                            <span className="text-sm font-black text-[var(--text-primary)]">{ex.restSeconds}s</span>
                                          </div>
                                      </div>
                                  </div>
                                  <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 shrink-0">
                                      <Info size={18} />
                                  </div>
                              </div>
                              
                              {!isDone && ex.notes && (
                                  <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                                      <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed font-medium">"{ex.notes}"</p>
                                  </div>
                              )}

                              <button 
                                onClick={() => toggleComplete(ex)} 
                                className={`w-full h-14 rounded-2xl font-black uppercase tracking-widest text-[11px] transition-all flex items-center justify-center gap-3 ${isDone ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/20' : 'bg-[var(--bg-active)] text-[var(--bg-active-text)] shadow-xl active:scale-95'}`}
                              >
                                  {isDone ? <><CheckCircle2 size={18}/> {t.sportDone}</> : <><Dumbbell size={18}/> {t.sportComplete}</>}
                              </button>
                          </GlassCard>
                      );
                  })}
              </div>
              
              <button 
                onClick={handleFinishWorkout} 
                className="w-full h-20 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-[32px] font-black uppercase tracking-[0.25em] text-[15px] shadow-[0_20px_50px_rgba(16,185,129,0.3)] active:scale-95 transition-all mt-6 mb-24 flex items-center justify-center gap-3"
              >
                  <CheckCircle2 size={24} strokeWidth={3} />
                  {t.sportFinishBtn}
              </button>
          </div>
      )}

      {/* Technique Modal */}
      {activeExercise && (
          <div className="fixed inset-0 z-[500] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 animate-fadeIn">
              <div className="w-full max-w-sm h-[80vh] flex flex-col pb-[110px]">
                  <GlassCard className="flex-1 bg-[var(--bg-main)] border border-[var(--border-glass)] rounded-[32px] overflow-hidden flex flex-col relative">
                      <div className="absolute top-0 left-0 right-0 p-6 bg-[var(--bg-main)] z-10 flex justify-between items-start border-b border-[var(--border-glass)]">
                          <div>
                              <h3 className="text-lg font-black text-[var(--text-primary)] uppercase tracking-tight leading-tight mb-1">{activeExercise.name}</h3>
                              <p className="text-[10px] text-orange-500 font-bold uppercase tracking-widest">{activeExercise.equipment}</p>
                          </div>
                          <button onClick={() => setActiveExercise(null)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"><X size={18}/></button>
                      </div>
                      
                      <div className="flex-1 overflow-y-auto p-6 pt-24 scrollbar-hide">
                          {isLoadingTechnique ? (
                              <div className="flex flex-col items-center justify-center py-20 space-y-4">
                                  <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
                                  <p className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest">{t.thinking}</p>
                              </div>
                          ) : (
                              <SportNoteRenderer text={techniqueText} />
                          )}
                      </div>

                      <div className="p-6 bg-[var(--bg-main)] border-t border-[var(--border-glass)] shrink-0">
                          <button onClick={() => setActiveExercise(null)} className="w-full h-14 bg-[var(--bg-active)] text-[var(--bg-active-text)] rounded-full font-black uppercase tracking-widest text-[11px] shadow-lg active:scale-95 transition-all">
                              {t.sportTechniqueClose}
                          </button>
                      </div>
                  </GlassCard>
              </div>
          </div>
      )}

      {/* Summary Modal */}
      {showSummary && (
          <div className="fixed inset-0 z-[400] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 animate-fadeIn">
              <div className="w-full max-w-sm text-center space-y-10 animate-fade-in-up pb-[110px]">
                  {/* ... Summary Content ... */}
                  <div className="relative mx-auto w-40 h-40">
                      <div className="absolute inset-0 rounded-full bg-indigo-500/20 blur-3xl animate-pulse" />
                      <div className="relative w-full h-full rounded-full border-4 border-indigo-500/30 flex items-center justify-center shadow-[0_0_60px_rgba(99,102,241,0.4)]">
                          <Trophy size={80} className="text-indigo-400" />
                      </div>
                  </div>
                  
                  <div className="space-y-2">
                    <h2 className="text-4xl font-black text-white uppercase tracking-tighter">{lang === 'ru' ? 'ТРЕНИРОВКА ЗАВЕРШЕНА' : 'WORKOUT COMPLETE'}</h2>
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">{lang === 'ru' ? 'Отличная работа!' : 'Incredible effort!'}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                      <GlassCard className="p-4 border-indigo-500/20 bg-[#1A1A1E]">
                          <TrendingUp size={24} className="text-indigo-400 mx-auto mb-2" />
                          <span className="block text-2xl font-black text-white">+{earnedXp}</span>
                          <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest">{t.xpLabel}</span>
                      </GlassCard>
                      <GlassCard className="p-4 border-emerald-500/20 bg-[#1A1A1E]">
                          <Check size={24} className="text-emerald-400 mx-auto mb-2" />
                          <span className="block text-2xl font-black text-white">{completedIds.length}</span>
                          <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-widest">{lang === 'ru' ? 'Упражнений' : 'Exercises'}</span>
                      </GlassCard>
                  </div>

                  <button 
                    onClick={() => setShowSummary(false)} 
                    className="w-full h-16 bg-white text-black rounded-full font-black uppercase tracking-widest text-[12px] shadow-2xl active:scale-95 transition-all"
                  >
                      {t.back}
                  </button>
              </div>
          </div>
      )}

      {/* COACH CHAT OVERLAY - FIXED SCROLLING */}
      {showCoachChat && (
          <div className="fixed inset-0 z-[550] bg-black/60 backdrop-blur-sm flex flex-col p-4 animate-fadeIn">
              <div className="flex-1 flex flex-col min-h-0 mb-20 bg-[var(--bg-main)] border border-[var(--border-glass)] rounded-[40px] shadow-2xl overflow-hidden relative">
                <header className="flex justify-between items-center p-6 bg-[var(--bg-main)] border-b border-[var(--border-glass)] shrink-0 z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-500 border border-orange-500/30"><Bot size={20} /></div>
                        <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-widest">{t.sportCoachChat}</h3>
                    </div>
                    <button onClick={() => setShowCoachChat(false)} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"><X size={20}/></button>
                </header>
                
                <div className="flex-1 overflow-y-auto p-6 scrollbar-hide min-h-0">
                    {coachMessages.map((msg, i) => (
                        <div key={i} className={`flex mb-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] px-5 py-3.5 rounded-[24px] shadow-sm ${msg.role === 'user' ? 'bg-[var(--bg-active)] text-[var(--bg-active-text)] font-medium' : 'bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-glass)]'}`}>
                                {renderMessageContent(msg.text, msg.role === 'user')}
                            </div>
                        </div>
                    ))}
                    {coachLoading && (
                        <div className="flex justify-start animate-pulse mb-4">
                            <div className="bg-[var(--bg-card)] px-5 py-3 rounded-[24px] flex items-center gap-2 text-[10px] text-orange-400 font-bold uppercase tracking-widest border border-[var(--border-glass)]">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                <span>{t.thinking}</span>
                            </div>
                        </div>
                    )}
                    <div ref={coachEndRef} />
                </div>

                <div className="p-4 bg-[var(--bg-main)] border-t border-[var(--border-glass)] shrink-0 z-10">
                    <div className="relative flex items-center gap-2 bg-[var(--bg-card)] border border-[var(--border-glass)] rounded-[32px] p-1 shadow-2xl focus-within:border-orange-500/50 transition-all w-full">
                        <input 
                            value={coachInput} 
                            onChange={e => setCoachInput(e.target.value)} 
                            onKeyDown={e => e.key === 'Enter' && handleSendCoachMsg()}
                            placeholder={lang === 'ru' ? 'Спросить коуча...' : 'Ask coach...'} 
                            className="flex-1 bg-transparent border-none text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] py-3 px-5 focus:outline-none"
                        />
                        <button onClick={handleSendCoachMsg} disabled={coachLoading || !coachInput.trim()} className="w-10 h-10 rounded-full flex items-center justify-center transition-all bg-orange-500 text-white active:scale-90">
                            <Send size={18} />
                        </button>
                    </div>
                </div>
              </div>
          </div>
      )}
    </div>
  );
};