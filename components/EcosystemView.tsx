
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { EcosystemType, UserProfile, Task, Language, TRANSLATIONS, Practice, Goal, AppView, AppTheme } from '../types';
import { GlassCard, GlassInput, GlassTextArea } from './GlassCard';
import { createChatSession, cleanTextOutput, evaluateProgress, getLocalISODate } from '../services/geminiService';
import { CreditsService } from '../services/creditsService';
import { ExamPrepApp } from './ExamPrepApp';
import { SportApp } from './SportApp';
import { HealthApp } from './HealthApp'; 
import { Activity, Bot, Sparkles, Loader2, Send, Brain, CheckCircle, X, ChevronRight, Trophy, Star, TrendingUp, ListTodo, History, Lightbulb, Clock, Check, Dumbbell, Heart, Share2, RefreshCcw, Quote } from 'lucide-react';

interface EcosystemViewProps {
  type: EcosystemType;
  user: UserProfile;
  tasks: Task[];
  lang: Language;
  onUpdateTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  onUpdateProfile: (profile: UserProfile) => void;
  onNavigate: (view: AppView) => void;
  theme: AppTheme;
  onDeductCredits?: (cost: number) => void;
  onLogout?: () => void;
}

export const EcosystemView: React.FC<EcosystemViewProps> = ({ type, user, tasks, lang, onUpdateTasks, onUpdateProfile, onNavigate, theme, onDeductCredits, onLogout }) => {
  const t = TRANSLATIONS[lang] || TRANSLATIONS['en'];
  
  // -- STATES --
  const [selectedPractice, setSelectedPractice] = useState<Practice | null>(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [messages, setMessages] = useState<{role: 'user' | 'model', text: string}[]>([]);
  const [inputValue, setInputValue] = useState('');
  
  const [logValue, setLogValue] = useState('');
  const [isLogging, setIsLogging] = useState(false);
  const [logFeedback, setLogFeedback] = useState<string | null>(null);
  const [productivityScore, setProductivityScore] = useState<number | null>(null);
  
  const [momentum, setMomentum] = useState(() => {
    const saved = localStorage.getItem(`focu_momentum_${type}`);
    return saved ? parseFloat(saved) : 0;
  });

  const [showDomainChat, setShowDomainChat] = useState(false);
  const [domainMessages, setDomainMessages] = useState<{role: 'user' | 'model', text: string}[]>([]);
  const [domainInputValue, setDomainInputValue] = useState('');
  const [domainLoading, setDomainLoading] = useState(false);

  
  const practiceSessionRef = useRef<any>(null);
  const domainSessionRef = useRef<any>(null);

  // ... (keeping existing computed logic for progress, etc.) ...
  const domainTasks = useMemo(() => tasks.filter(task => task.category.toLowerCase() === type.toLowerCase()), [tasks, type]);
  const pendingDomainTasks = useMemo(() => domainTasks.filter(task => !task.completed), [domainTasks]);
  
  const progress = useMemo(() => {
      const taskWeight = 0.4;
      const goalWeight = 0.4;
      const momentumWeight = 0.2;

      const completedCount = domainTasks.filter(task => task.completed).length;
      const totalCount = domainTasks.length;
      const taskProgress = totalCount > 0 ? (completedCount / totalCount) : 0;

      const relevantGoals = (user.goals || []).filter(g => {
        const title = g.title.toLowerCase();
        const category = type.toLowerCase();
        return title.includes(category) || 
               (category === 'sport' && (title.includes('зал') || title.includes('трени') || title.includes('фит'))) ||
               (category === 'work' && (title.includes('раб') || title.includes('дел') || title.includes('проект'))) ||
               (category === 'study' && (title.includes('уч') || title.includes('кур') || title.includes('чит')));
      });
      
      const goalProgress = relevantGoals.length > 0 
        ? relevantGoals.reduce((acc, g) => acc + (g.progress / g.target), 0) / relevantGoals.length
        : taskProgress;

      if (totalCount === 0 && relevantGoals.length === 0) {
          const activityBonus = Math.min(0.5, (user.activityHistory || []).filter(h => h.startsWith(`${type.toUpperCase()}: `)).length * 0.05);
          return Math.min(100, (momentum + activityBonus) * 100);
      }

      const finalProgress = (taskProgress * taskWeight + goalProgress * goalWeight + momentum * momentumWeight) * 100;
      return Math.min(100, finalProgress);
  }, [domainTasks, user.goals, type, momentum, user.activityHistory]);

  useEffect(() => {
    localStorage.setItem(`focu_momentum_${type}`, momentum.toString());
  }, [momentum, type]);

  const domainInsight = useMemo(() => {
      const insights: Record<string, string[]> = {
          work: [
              lang === 'ru' ? "Начните с самой сложной задачи, пока когнитивный ресурс на пике." : "Start with your hardest task while your cognitive resource is at its peak.",
              lang === 'ru' ? "Глубокая работа требует минимум 90 минут без уведомлений." : "Deep work requires at least 90 minutes without notifications."
          ],
          sport: [
              lang === 'ru' ? "Сегодня отличный день для работы над техникой, а не весом." : "Today is a great day to focus on technique over weight.",
              lang === 'ru' ? "Восстановление — это часть тренировки. Не пренебрегайте сном." : "Recovery is part of training. Don't neglect sleep."
          ],
          study: [
              lang === 'ru' ? "Попробуйте метод Фейнмана: объясните тему вслух воображаемому ученику." : "Try the Feynman technique: explain the topic aloud to an imaginary student.",
              lang === 'ru' ? "Активное припоминание эффективнее простого чтения конспектов." : "Active recall is more effective than just reading notes."
          ],
          health: [
              lang === 'ru' ? "Маленькие шаги в питании дают огромный эффект через год." : "Small dietary changes lead to massive effects in a year.",
              lang === 'ru' ? "Медитация на 5 минут лучше, чем отсутствие медитации." : "5 minutes of meditation is better than no meditation at all."
          ],
      };
      const list = insights[type] || [lang === 'ru' ? "Фокус — это мышца. Тренируйте её каждый день." : "Focus is a muscle. Train it every day."];
      return list[Math.floor(Math.random() * list.length)];
  }, [type, lang]);

  const workQuotes = useMemo(() => {
    if (lang === 'ru') {
        return [
            { text: "Ваше время ограничено, не тратьте его, живя чужой жизнью.", author: "Стив Джобс" },
            { text: "Успех — это способность идти от поражения к поражению, не теряя энтузиазма.", author: "Уинстон Черчилль" },
            { text: "Лучший способ предсказать будущее — создать его.", author: "Питер Друкер" },
            { text: "Не бойтесь отказаться от хорошего, ради великого.", author: "Джон Д. Рокфеллер" },
            { text: "Гений — это 1% вдохновения и 99% пота.", author: "Томас Эдисон" },
            { text: "Логика приведет вас из пункта А в пункт Б. Воображение приведет вас куда угодно.", author: "Альберт Эйнштейн" }
        ];
    }
    return [
        { text: "Your time is limited, so don't waste it living someone else's life.", author: "Steve Jobs" },
        { text: "Success is walking from failure to failure with no loss of enthusiasm.", author: "Winston Churchill" },
        { text: "The best way to predict the future is to create it.", author: "Peter Drucker" },
        { text: "Don't be afraid to give up the good to go for the great.", author: "John D. Rockefeller" },
        { text: "Genius is 1% inspiration and 99% perspiration.", author: "Thomas Edison" },
        { text: "Logic will get you from A to B. Imagination will take you everywhere.", author: "Albert Einstein" }
    ];
  }, [lang]);

  const randomQuote = useMemo(() => workQuotes[Math.floor(Math.random() * workQuotes.length)], [workQuotes]);

  const practices = useMemo((): Practice[] => {
      const isRu = lang === 'ru';
      const data: Record<string, Practice[]> = {
          sport: [
              { id: 'ar', name: isRu ? "Активное восстановление" : "Active Recovery", description: isRu ? "Легкая активность для восстановления." : "Light activity to recover." },
              { id: 'tr', name: isRu ? "Тренировочный сброс" : "Training Reset", description: isRu ? "Фокус на технике." : "Focus on technique." }
          ],
          work: [
              { id: 'dw', name: isRu ? "Глубокая работа" : "Deep Work", description: isRu ? "Блок полной тишины." : "Total focus block." },
              { id: 'fs', name: isRu ? "Спринт фокуса" : "Focus Sprint", description: isRu ? "25 минут без отвлечений." : "25 min focus." }
          ]
      };
      return data[type] || [
          { id: 'dr', name: isRu ? "Ежедневная рутина" : "Daily Routine", description: isRu ? "Поддержание порядка." : "Maintain order." }
      ];
  }, [type, lang]);

  // -- HANDLERS --

  const handlePracticeSend = async () => {
    if (!inputValue.trim() || chatLoading) return;
    const text = inputValue.trim();
    setMessages(prev => [...prev, {role: 'user', text}]);
    setInputValue('');
    setChatLoading(true);

    try {
        if (!practiceSessionRef.current) {
            practiceSessionRef.current = createChatSession(user, [], lang, domainTasks, type, getLocalISODate());
        }
        
        // Check and deduct credits for practice chat
        const practiceCost = CreditsService.getActionCost('chatMessage', user.settings?.aiDetailLevel);
        if (user.credits && !CreditsService.canAfford(user.credits, CreditsService.getActionCost('ecosystemAnalysis', user.settings?.aiDetailLevel))) {
          if (!CreditsService.canAfford(user.credits, practiceCost)) {
            setMessages(prev => [...prev, {role: 'model', text: lang === 'ru' ? '❌ Недостаточно кредитов для отправки сообщения. Введите промокод в настройках для получения безлимитного доступа.' : '❌ Not enough credits to send message. Enter promo code in settings for unlimited access.'}]);
            return;
          }
          onDeductCredits?.(practiceCost);
        }
        
        const res = await practiceSessionRef.current.sendMessage({ message: text });
        setMessages(prev => [...prev, {role: 'model', text: cleanTextOutput(res.text || "")}]);
    } catch (e) {
        setMessages(prev => [...prev, {role: 'model', text: t.chatError}]);
    } finally {
        setChatLoading(false);
    }
  };

  const handleDomainSend = async () => {
    if (!domainInputValue.trim() || domainLoading) return;
    const text = domainInputValue.trim();
    setDomainMessages(prev => [...prev, {role: 'user', text}]);
    setDomainInputValue('');
    setDomainLoading(true);
    
    // Check and deduct credits for domain chat
    const domainCost = CreditsService.getActionCost('chatMessage', user.settings?.aiDetailLevel);
    if (user.credits && !CreditsService.canAfford(user.credits, CreditsService.getActionCost('ecosystemAnalysis', user.settings?.aiDetailLevel))) {
      if (!CreditsService.canAfford(user.credits, domainCost)) {
        setDomainMessages(prev => [...prev, {role: 'model', text: lang === 'ru' ? '❌ Недостаточно кредитов для отправки сообщения. Введите промокод в настройках для получения безлимитного доступа.' : '❌ Not enough credits to send message. Enter promo code in settings for unlimited access.'}]);
        return;
      }
      onDeductCredits?.(domainCost);
    }
    
    try {
        if (!domainSessionRef.current) {
            domainSessionRef.current = createChatSession(user, [], lang, domainTasks, type, getLocalISODate());
        }
        const res = await domainSessionRef.current.sendMessage({ message: text });
        setDomainMessages(prev => [...prev, {role: 'model', text: cleanTextOutput(res.text || "")}]);
    } catch (e) {
        setDomainMessages(prev => [...prev, {role: 'model', text: t.chatError}]);
    } finally {
        setDomainLoading(false);
    }
  };

  const handleLogProgress = async () => {
      if (!logValue.trim() || isLogging) return;
      setIsLogging(true);
      setLogFeedback(null);
      setProductivityScore(null);

      try {
          const evalResult = await evaluateProgress(logValue, domainTasks, user.goals || [], type, lang);
          const updatedTaskIds = evalResult?.updatedTaskIds ?? [];
          const goalUpdates = evalResult?.goalUpdates ?? [];
          const isUseful = (evalResult?.productivityScore ?? 0) > 0 ||
                           (evalResult?.generalProgressAdd ?? 0) > 0 ||
                           updatedTaskIds.length > 0 ||
                           goalUpdates.length > 0;

          if (!isUseful) {
              setLogFeedback(evalResult?.feedback || (lang === 'ru' ? "Действие не распознано как полезное для этой сферы." : "Action not recognized as productive for this sphere."));
              setLogValue('');
              setTimeout(() => setLogFeedback(null), 4000);
              return;
          }

          if (updatedTaskIds.length > 0) {
              onUpdateTasks(prev => prev.map(tk => updatedTaskIds.includes(tk.id) ? { ...tk, completed: true } : tk));
          }

          const updatedGoals = (user.goals || []).map(g => {
              const update = goalUpdates.find((u: any) => u.id === g.id);
              if (update) {
                  const newProgress = Math.min(g.target, g.progress + update.progressAdd);
                  return { ...g, progress: newProgress, completed: newProgress >= g.target };
              }
              return g;
          });
          
          if ((evalResult?.generalProgressAdd ?? 0) > 0) {
              setMomentum(prev => Math.min(1, prev + (evalResult?.generalProgressAdd ?? 0)));
          }

          let newXp = (user.totalExperience || 0) + (evalResult?.productivityScore ?? 0);
          let newLevel = user.level || 1;
          
          while (newXp >= newLevel * 100) {
              newXp -= newLevel * 100;
              newLevel += 1;
          }

          onUpdateProfile({ 
              ...user, 
              goals: updatedGoals,
              activityHistory: [...(user.activityHistory || []), `${type.toUpperCase()}: ${logValue}`],
              totalExperience: newXp,
              level: newLevel
          });
          
          setLogFeedback(evalResult?.feedback ?? '');
          setProductivityScore(evalResult?.productivityScore ?? 0);
          setLogValue('');
          
          setTimeout(() => {
              setLogFeedback(null);
              setProductivityScore(null);
          }, 6000);
      } catch (e) {
          console.error(e);
      } finally {
          setIsLogging(false);
      }
  };

  const handleToggleTask = (id: string) => {
    onUpdateTasks(prev => prev.map(tk => tk.id === id ? { ...tk, completed: !tk.completed } : tk));
  };

  const ecoLabel = t[`eco_${type}` as keyof typeof t] || type;

  // -- RENDERERS --

  if (type === 'study') {
      return (
          <div className="animate-fadeIn pb-32">
              <ExamPrepApp 
                user={user} 
                lang={lang} 
                onUpdateProfile={onUpdateProfile} 
                theme={theme}
                onDeductCredits={onDeductCredits}
            />  
          </div>
      );
  }

  if (type === 'sport') {
      return (
        <div className="animate-fadeIn pb-32">
            <header className="flex justify-between items-center px-1 mb-8">
                <div>
                    <h1 className="text-2xl font-black text-[var(--text-primary)] tracking-tight uppercase">{lang === 'ru' ? 'Атлетика' : 'Athletics'}</h1>
                    <p className="text-[10px] text-orange-500 font-black uppercase tracking-[0.2em]">{t.sportHubSub}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-400 border border-orange-500/20">
                    <Dumbbell size={24} />
                </div>
            </header>
            <SportApp user={user} lang={lang} onUpdateProfile={onUpdateProfile} onAddTasks={(newTasks) => onUpdateTasks(prev => [...prev, ...newTasks])} theme={theme} onDeductCredits={onDeductCredits} onLogout={onLogout} />
        </div>
      );
  }

  if (type === 'health') {
      return (
        <div className="animate-fadeIn pb-32">
            <HealthApp user={user} lang={lang} onUpdateProfile={onUpdateProfile} theme={theme} />
        </div>
      );
  }

  // DEFAULT VIEW (Work) - EXPERT CHAT IS HERE
  return (
    <div className="space-y-6 animate-fadeIn pb-6">
      <header className="flex justify-between items-center px-1">
          <div>
              <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight uppercase">{ecoLabel}</h1>
              <p className="text-sm text-[var(--text-secondary)] font-medium">{t.ecoState}: {t.stateBalanced}</p>
          </div>
          <button 
            onClick={() => { setShowDomainChat(true); setDomainMessages([{role: 'model', text: lang === 'ru' ? `Привет! Я ИИ-эксперт в сфере ${ecoLabel}. Что обсудим?` : `Hello! I'm an AI expert for ${ecoLabel}. What's on your mind?`}]); }}
            className="px-5 py-2.5 bg-white/5 rounded-full border border-white/10 text-[10px] font-bold uppercase tracking-widest text-[var(--text-primary)] flex items-center gap-2 hover:bg-white/10 transition-all active:scale-95 shadow-lg"
          >
              <Bot size={14} className="text-indigo-400"/>
              {t.navExpert}
          </button>
      </header>

      <section className="space-y-3">
          <GlassCard className="p-6 bg-[var(--bg-card)] border-[var(--border-glass)] shadow-lg relative overflow-hidden rounded-[32px]">
              <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-2">
                    <Trophy size={14} className="text-amber-400" />
                    <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">{t.domainProgress}</span>
                  </div>
                  <span className="text-xl font-bold text-[var(--text-primary)] tracking-tighter">{Math.round(progress)}%</span>
              </div>
              <div className="h-2.5 w-full bg-white/5 rounded-full overflow-hidden mb-6 ring-1 ring-white/5">
                  <div className="h-full bg-indigo-500 transition-all duration-1000 shadow-[0_0_15px_rgba(99,102,241,0.6)]" style={{width: `${progress}%`}} />
              </div>

              {(logFeedback || productivityScore !== null) && (
                  <div className="mb-4 p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-[24px] flex flex-col gap-2 animate-fade-in-up">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Star size={14} className="text-indigo-400" />
                            <span className="text-[9px] font-bold text-indigo-300 uppercase tracking-widest">{t.examResult}</span>
                        </div>
                        {productivityScore !== null && productivityScore > 0 && (
                            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-indigo-500/20 rounded-full">
                                <TrendingUp size={10} className="text-indigo-400" />
                                <span className="text-[10px] font-bold text-indigo-400">+{productivityScore} XP</span>
                            </div>
                        )}
                      </div>
                      <p className="text-[12px] text-indigo-100 italic leading-snug">{logFeedback}</p>
                  </div>
              )}

              <div className="flex gap-2">
                  <input 
                    value={logValue} 
                    onChange={e => setLogValue(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleLogProgress()}
                    placeholder={t.ecoLogPlaceholder}
                    disabled={isLogging}
                    className="flex-1 bg-black/10 border border-[var(--border-glass)] rounded-full px-6 py-4 text-sm text-[var(--text-primary)] focus:outline-none focus:border-indigo-500/20 transition-all placeholder:text-[var(--text-secondary)]"
                  />
                  <button 
                    onClick={handleLogProgress}
                    disabled={isLogging || !logValue.trim()}
                    className="w-12 h-12 bg-[var(--bg-active)] rounded-full flex items-center justify-center text-[var(--bg-active-text)] active:scale-90 transition-all disabled:opacity-30 shadow-lg"
                  >
                    {isLogging ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} strokeWidth={2.5} />}
                  </button>
              </div>
          </GlassCard>
      </section>

      <section className="animate-fade-in-up delay-100">
          <GlassCard className="p-4 bg-indigo-500/5 border-indigo-500/10 rounded-[28px] flex gap-4 items-center">
              <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 shrink-0">
                  <Lightbulb size={20} />
              </div>
              <div>
                  <h4 className="text-[9px] font-bold text-indigo-400 uppercase tracking-[0.2em] mb-1">{t.ecoInsightTitle}</h4>
                  <p className="text-[12px] text-[var(--text-secondary)] leading-snug font-medium italic">"{domainInsight}"</p>
              </div>
          </GlassCard>
      </section>

      <section className="animate-fade-in-up delay-150">
          <GlassCard className="p-6 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 border-[var(--border-glass)] rounded-[28px] relative overflow-hidden group">
              <Quote className="absolute top-4 right-4 text-[var(--text-secondary)] opacity-10 rotate-180" size={64} />
              <div className="relative z-10">
                  <p className="text-[13px] font-bold text-[var(--text-primary)] leading-relaxed italic mb-3">"{randomQuote.text}"</p>
                  <div className="flex items-center gap-2 justify-end">
                      <div className="h-px w-8 bg-[var(--theme-accent)] opacity-50" />
                      <p className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest">{randomQuote.author}</p>
                  </div>
              </div>
          </GlassCard>
      </section>

      {pendingDomainTasks.length > 0 && (
          <section className="animate-fade-in-up delay-200">
              <div className="flex items-center gap-2 mb-3 px-2">
                <ListTodo size={14} className="text-[var(--text-secondary)]" />
                <h3 className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.2em]">{t.ecoTasksTitle}</h3>
              </div>
              <div className="space-y-2">
                  {pendingDomainTasks.slice(0, 3).map(tk => (
                      <div 
                        key={tk.id} 
                        onClick={() => handleToggleTask(tk.id)}
                        className="p-4 rounded-[24px] bg-[var(--bg-card)] border border-[var(--border-glass)] flex items-center justify-between group active:scale-[0.98] transition-all cursor-pointer"
                      >
                          <div className="flex items-center gap-3">
                              <div className="w-5 h-5 rounded-full border border-[var(--border-glass)] group-hover:border-indigo-400 flex items-center justify-center transition-all">
                                  {tk.completed && <Check size={12} className="text-indigo-400" />}
                              </div>
                              <span className="text-sm font-medium text-[var(--text-primary)]">{tk.title}</span>
                          </div>
                          {tk.scheduledTime && (
                              <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-secondary)] font-bold uppercase">
                                  <Clock size={12} />
                                  {tk.scheduledTime}
                              </div>
                          )}
                      </div>
                  ))}
              </div>
          </section>
      )}

      <section className="animate-fade-in-up delay-300">
          <div className="flex items-center gap-2 mb-3 px-2">
            <History size={14} className="text-[var(--text-secondary)]" />
            <h3 className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.2em]">{t.ecoHistoryTitle}</h3>
          </div>
          <div className="grid grid-cols-1 gap-2">
              {(user.activityHistory || []).filter(h => h.startsWith(type.toUpperCase())).slice(-3).reverse().map((entry, idx) => (
                  <div key={idx} className="px-5 py-3 rounded-[22px] bg-white/2 border border-[var(--border-glass)] text-[11px] text-[var(--text-secondary)] font-medium flex items-center gap-3">
                      <CheckCircle size={14} className="text-emerald-500/50 shrink-0" />
                      <span className="truncate">{entry.split(': ')[1]}</span>
                  </div>
              ))}
          </div>
      </section>

      <section className="animate-fade-in-up delay-400">
          <div className="flex items-center gap-2 mb-4 px-2">
            <Activity size={14} className="text-[var(--text-secondary)]" />
            <h3 className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.2em]">{t.ecoPractices}</h3>
          </div>
          <div className="grid gap-4">
              {practices.map(p => (
                  <button 
                    key={p.id} 
                    onClick={() => { setSelectedPractice(p); setMessages([{role: 'model', text: p.description}]); }}
                    className="w-full p-6 rounded-[32px] bg-[var(--bg-card)] border border-[var(--border-glass)] hover:bg-white/5 transition-all flex items-center justify-between group shadow-md active:scale-[0.98]"
                  >
                      <div className="flex items-center gap-5">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-500/20 transition-all">
                            <Sparkles size={20} />
                        </div>
                        <div className="text-left">
                          <span className="text-[16px] font-bold text-[var(--text-primary)] block group-hover:text-indigo-400 transition-colors">{p.name}</span>
                          <span className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-widest opacity-60">FoGoal Core</span>
                        </div>
                      </div>
                      <ChevronRight size={20} className="text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-all transform group-hover:translate-x-1" />
                  </button>
              ))}
          </div>
      </section>
      
      {showDomainChat && (
        <div className="fixed inset-0 z-[500] bg-black/60 backdrop-blur-sm flex flex-col p-4 animate-fadeIn">
            <div className="flex-1 flex flex-col pb-[110px] w-full max-w-lg mx-auto">
                <header className="flex justify-between items-center p-6 bg-[var(--bg-main)] border border-[var(--border-glass)] rounded-t-[40px] shadow-lg">
                    <div className="flex items-center gap-3">
                        <Bot size={24} className="text-indigo-400" />
                        <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-widest">{lang === 'ru' ? 'Эксперт' : 'Expert'} {ecoLabel}</h3>
                    </div>
                    <button onClick={() => setShowDomainChat(false)} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"><X size={20}/></button>
                </header>
                <div className="flex-1 overflow-y-auto space-y-4 px-6 py-6 bg-[var(--bg-main)] border-x border-[var(--border-glass)] scrollbar-hide">
                    {domainMessages.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] px-5 py-3.5 rounded-[24px] text-[13px] leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-[var(--bg-active)] text-[var(--bg-active-text)] font-medium' : 'bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-glass)]'}`}>
                                {msg.text}
                            </div>
                        </div>
                    ))}
                    {domainLoading && (
                        <div className="flex justify-start animate-pulse">
                            <div className="bg-[var(--bg-card)] px-5 py-3 rounded-[24px] flex items-center gap-2 text-[10px] text-indigo-400 font-bold uppercase tracking-widest border border-[var(--border-glass)]">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                <span>{t.thinking}</span>
                            </div>
                        </div>
                    )}
                </div>
                <div className="p-6 bg-[var(--bg-main)] border-x border-b border-[var(--border-glass)] rounded-b-[40px]">
                    <div className="relative flex items-center gap-2 bg-[var(--bg-card)] border border-[var(--border-glass)] rounded-[32px] p-1 shadow-lg focus-within:border-white/20 transition-all w-full">
                        <input 
                            value={domainInputValue} 
                            onChange={e => setDomainInputValue(e.target.value)} 
                            onKeyDown={e => e.key === 'Enter' && handleDomainSend()}
                            placeholder={lang === 'ru' ? 'Спросить эксперта...' : 'Ask expert...'} 
                            className="flex-1 bg-transparent border-none text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] py-3 px-5 focus:outline-none"
                        />
                        <button onClick={handleDomainSend} disabled={domainLoading || !domainInputValue.trim()} className="w-10 h-10 rounded-full flex items-center justify-center transition-all bg-indigo-500 text-white active:scale-90">
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
