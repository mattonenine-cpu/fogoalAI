
import React, { useState } from 'react';
import { UserProfile, DailyStats, Language, TRANSLATIONS, Task, AppView, Goal } from '../types';
import { GlassCard, GlassInput } from './GlassCard';
import { Mascot } from './Mascot';
import { 
  Sparkles, List, Trophy, X, Edit3, Check, Plus, Star, Trash2, Edit, CalendarDays
} from 'lucide-react';

interface DashboardProps {
  user: UserProfile;
  stats: DailyStats;
  lang: Language;
  tasks: Task[];
  onUpdateProfile: (profile: UserProfile) => void;
  onUpdateStats: (stats: DailyStats) => void;
  onNavigate: (view: AppView) => void;
  onAddTasks: (tasks: Task[]) => void;
}

const REWARDS = [
  { level: 2, label: 'New Theme: Ice', icon: '❄️' },
  { level: 3, label: 'AI Expert Unlocked', icon: '🤖' },
  { level: 5, label: 'Ecosystem: Sport', icon: '💪' },
  { level: 10, label: 'Divine Badge', icon: '👑' },
];

const GOAL_COLORS = ['#6366f1', '#ef4444', '#f59e0b', '#10b981', '#ec4899', '#8b5cf6', '#06b6d4'];

export const Dashboard: React.FC<DashboardProps> = ({ user, stats, lang, tasks, onUpdateProfile, onUpdateStats }) => {
  const t = TRANSLATIONS[lang] || TRANSLATIONS['en'];
  const [showLevelModal, setShowLevelModal] = useState(false);
  const [showGoalsList, setShowGoalsList] = useState(false);
  const [showSleepModal, setShowSleepModal] = useState(false);
  const [editSleepValue, setEditSleepValue] = useState(stats.sleepHours || 7);

  const [showAddGoalModal, setShowAddGoalModal] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [newGoal, setNewGoal] = useState({ title: '', target: 100, unit: '%', color: GOAL_COLORS[0] });
  
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [activeGoalId, setActiveGoalId] = useState<string | null>(null);
  const [progressInput, setProgressInput] = useState('');

  const today = new Date();
  const formattedDate = today.toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US', { 
    day: 'numeric', 
    month: 'long', 
    weekday: 'long' 
  });
  
  const getLocalISODate = () => {
    const d = new Date();
    const offset = d.getTimezoneOffset();
    const localDate = new Date(d.getTime() - (offset * 60 * 1000));
    return localDate.toISOString().split('T')[0];
  };
  const todayISO = getLocalISODate();

  const nextTask = tasks
    .filter(t => !t.completed && (t.date === todayISO || !t.date)) 
    .sort((a,b) => (a.scheduledTime || '23:59').localeCompare(b.scheduledTime || '23:59'))[0];

  const nextLevelXp = user.level * 100;
  const progressPercent = (user.totalExperience / nextLevelXp) * 100;
  const activeGoals = (user.goals || []).filter(g => !g.completed);

  const handleOpenEditGoal = (goal: Goal) => {
    setEditingGoalId(goal.id);
    setNewGoal({
      title: goal.title,
      target: goal.target,
      unit: goal.unit,
      color: goal.color || GOAL_COLORS[0]
    });
    setShowAddGoalModal(true);
    setShowGoalsList(false);
  };

  const handleAddGoal = () => {
      if (!newGoal.title.trim()) return;
      
      if (editingGoalId) {
          const updatedGoals = (user.goals || []).map(g => 
            g.id === editingGoalId 
              ? { ...g, title: newGoal.title, target: newGoal.target, unit: newGoal.unit, color: newGoal.color } 
              : g
          );
          onUpdateProfile({ ...user, goals: updatedGoals });
      } else {
          const goal: Goal = {
              id: Date.now().toString(),
              title: newGoal.title.trim(),
              target: newGoal.target,
              progress: 0,
              unit: newGoal.unit || '%',
              color: newGoal.color,
              completed: false,
              timeframe: 'Month'
          };
          onUpdateProfile({ ...user, goals: [...(user.goals || []), goal] });
      }
      
      setShowAddGoalModal(false);
      setEditingGoalId(null);
      setNewGoal({ title: '', target: 100, unit: '%', color: GOAL_COLORS[0] });
  };

  const handleDeleteGoal = (id: string) => {
      if (confirm(lang === 'ru' ? 'Удалить цель?' : 'Delete goal?')) {
          onUpdateProfile({ ...user, goals: (user.goals || []).filter(g => g.id !== id) });
      }
  };

  const handleUpdateProgress = () => {
      if (!activeGoalId) return;
      const value = parseFloat(progressInput);
      if (isNaN(value)) return;

      const updatedGoals = (user.goals || []).map(g => {
          if (g.id === activeGoalId) {
              const newProgress = Math.min(g.target, g.progress + value);
              return { ...g, progress: newProgress, completed: newProgress >= g.target };
          }
          return g;
      });
      onUpdateProfile({ ...user, goals: updatedGoals });
      setShowProgressModal(false);
      setProgressInput('');
  };

  return (
    <div className="space-y-6 animate-fade-in-up pb-24 px-1">
       {/* 1. Date & Level Row */}
       <div className="flex gap-3">
          <GlassCard className="flex-[2] py-4 px-5 flex items-center gap-3 bg-[var(--bg-card)] border-[var(--border-glass)] rounded-[32px]">
              <CalendarDays size={18} className="text-[var(--theme-accent)]" />
              <div className="flex flex-col justify-center">
                  <span className="text-sm font-black text-[var(--text-primary)] capitalize">
                      {formattedDate}
                  </span>
              </div>
          </GlassCard>
          
          <GlassCard 
            onClick={() => setShowLevelModal(true)}
            className="flex-1 py-4 px-2 flex flex-col items-center justify-center gap-1 bg-[var(--bg-card)] border-[var(--border-glass)] rounded-[32px] cursor-pointer active:scale-95 transition-all"
          >
             <span className="text-xs font-black uppercase tracking-widest text-[var(--text-primary)]">Lvl {user.level}</span>
             <div className="h-1 w-10 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-[var(--theme-accent)] transition-all" style={{ width: `${progressPercent}%` }} />
             </div>
          </GlassCard>
       </div>

       {/* 2. Next Task */}
       <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
             <span className="text-lg">⚡</span>
             <h3 className="text-sm font-semibold text-[var(--text-secondary)]">{lang === 'ru' ? 'Следующее' : 'Next Up'}</h3>
          </div>
          <GlassCard className="p-5 rounded-[32px] border border-[var(--border-glass)] bg-white/5 shadow-md">
             {nextTask ? (
                <div className="flex items-center justify-between gap-4">
                   <div className="space-y-1 min-w-0">
                      <p className="text-md font-medium text-[var(--text-primary)] truncate">{nextTask.title}</p>
                      <p className="text-xs font-medium text-[var(--text-secondary)]">{nextTask.category || 'Focus'}</p>
                   </div>
                   <div className="px-4 py-2 bg-white text-black rounded-2xl text-xs font-semibold shrink-0">
                      {nextTask.scheduledTime || 'Today'}
                   </div>
                </div>
             ) : (
                <p className="text-center py-2 text-sm font-medium text-[var(--text-secondary)] opacity-50">{lang === 'ru' ? 'На сегодня всё' : 'No more tasks today'}</p>
             )}
          </GlassCard>
       </div>

       {/* 3. Goals */}
       <div className="space-y-3">
           <div className="flex items-center justify-between px-1">
               <div className="flex items-center gap-2">
                   <Trophy size={18} className="text-amber-500" />
                   <h3 className="text-sm font-semibold text-[var(--text-secondary)]">{lang === 'ru' ? 'Цели' : 'Goals'}</h3>
               </div>
               <div className="flex gap-2">
                   <button onClick={() => setShowGoalsList(true)} className="w-8 h-8 rounded-full bg-white/5 border border-[var(--border-glass)] flex items-center justify-center text-[var(--text-secondary)] active:scale-90 transition-all"><List size={14}/></button>
                   <button onClick={() => { setEditingGoalId(null); setNewGoal({ title: '', target: 100, unit: '%', color: GOAL_COLORS[0] }); setShowAddGoalModal(true); }} className="w-8 h-8 rounded-full bg-[var(--bg-active)] text-[var(--bg-active-text)] flex items-center justify-center shadow-lg active:scale-90 transition-all"><Plus size={16} strokeWidth={2.5}/></button>
               </div>
           </div>
           
           <div className="space-y-2">
               {activeGoals.length === 0 ? (
                   <p className="text-center py-6 text-[var(--text-secondary)] text-sm font-medium opacity-40">{lang === 'ru' ? 'Нет активных целей' : 'No active goals'}</p>
               ) : (
                   activeGoals.slice(0, 3).map(g => {
                       const pct = Math.min(100, Math.round((g.progress / (g.target || 100)) * 100));
                       return (
                           <div key={g.id} className="p-4 rounded-[28px] bg-white/5 border border-[var(--border-glass)] flex items-center justify-between gap-4 relative overflow-hidden transition-all hover:bg-white/[0.08]">
                                <div className="absolute bottom-0 left-0 h-[2px] bg-white/5 w-full">
                                    <div className="h-full transition-all duration-1000" style={{ width: `${pct}%`, backgroundColor: g.color || '#6366f1' }} />
                                </div>
                                <div className="flex items-center gap-3 flex-1 min-w-0" onClick={() => handleOpenEditGoal(g)}>
                                   <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border border-white/5" style={{ backgroundColor: `${g.color}15`, color: g.color }}>
                                       <Star size={14} />
                                   </div>
                                   <div className="min-w-0">
                                       <p className="text-sm font-medium text-[var(--text-primary)] truncate">{g.title}</p>
                                       <p className="text-xxs font-medium text-[var(--text-secondary)] mt-0.5">{g.progress} / {g.target} {g.unit}</p>
                                   </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs font-semibold text-[var(--text-primary)]">{pct}%</span>
                                    <button 
                                       onClick={() => { setActiveGoalId(g.id); setShowProgressModal(true); }}
                                       className="w-7 h-7 rounded-xl bg-[var(--bg-active)] text-[var(--bg-active-text)] flex items-center justify-center active:scale-90 transition-all shadow-md"
                                    >
                                        <Plus size={14} strokeWidth={3} />
                                    </button>
                                </div>
                           </div>
                       );
                   })
               )}
           </div>
       </div>

       {/* 4. State Grid */}
       <div className="grid grid-cols-2 gap-3">
          <GlassCard onClick={() => setShowSleepModal(true)} className="p-4 rounded-[32px] bg-white/5 border-[var(--border-glass)] flex flex-col gap-3 cursor-pointer hover:bg-white/[0.08]">
             <div className="flex justify-between items-start">
                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-md">🌙</div>
                <Edit3 size={12} className="text-[var(--text-secondary)] opacity-30" />
             </div>
             <div>
                <p className="text-xxs font-medium text-[var(--text-secondary)] mb-1">{t.sleepTitle}</p>
                <p className="text-lg font-semibold">{stats.sleepHours || 0}h</p>
             </div>
          </GlassCard>

          <div className="p-4 rounded-[32px] bg-white/5 border border-[var(--border-glass)] flex flex-col gap-3">
             <div className="flex justify-between items-start">
                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-md">
                   {stats.mood === 'Happy' ? '😊' : stats.mood === 'Sad' ? '😔' : '😐'}
                </div>
             </div>
             <div className="space-y-2">
                <p className="text-xxs font-medium text-[var(--text-secondary)] mb-1">{t.moodTitle}</p>
                <div className="flex gap-1">
                   {['Happy', 'Neutral', 'Sad'].map((m) => (
                      <button 
                        key={m}
                        onClick={() => onUpdateStats({ ...stats, mood: m as any })}
                        className={`flex-1 h-7 rounded-lg transition-all text-xs ${stats.mood === m ? 'bg-white shadow-md' : 'bg-white/5 hover:bg-white/10'}`}
                      >
                        {m === 'Happy' ? '😊' : m === 'Sad' ? '😔' : '😐'}
                      </button>
                   ))}
                </div>
             </div>
          </div>
       </div>
       
       {/* LEVEL MODAL */}
       {showLevelModal && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 animate-fadeIn">
              <div className="w-full max-w-sm bg-[var(--bg-main)] border border-[var(--border-glass)] rounded-[40px] p-8 text-center relative shadow-2xl pb-10">
                  <button onClick={() => setShowLevelModal(false)} className="absolute top-6 right-6 text-slate-500 hover:text-[var(--text-primary)] transition-colors">
                      <X size={20} />
                  </button>
                  
                  <div className="relative mb-6 mx-auto w-32 h-32 flex items-center justify-center">
                      <div className="absolute inset-0 bg-indigo-500/20 blur-3xl rounded-full animate-pulse" />
                      <Mascot size={100} mood="Good" level={user.level} />
                  </div>

                  <h2 className="text-3xl font-black text-[var(--text-primary)] uppercase tracking-tighter mb-1">{lang === 'ru' ? 'УРОВЕНЬ' : 'LEVEL'} {user.level}</h2>
                  <p className="text-sm font-bold text-indigo-400">{user.totalExperience} XP</p>

                  <div className="mt-8 mb-2 flex justify-between text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">
                      <span>XP</span>
                      <span>{Math.floor(user.totalExperience)} / {nextLevelXp}</span>
                  </div>
                  <div className="h-4 w-full bg-black/40 rounded-full overflow-hidden border border-white/5 mb-8">
                      <div className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 transition-all duration-1000 shadow-[0_0_15px_rgba(99,102,241,0.5)]" style={{ width: `${progressPercent}%` }} />
                  </div>
              </div>
          </div>
       )}

       {/* GOALS LIST MODAL */}
       {showGoalsList && (
           <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 animate-fadeIn">
               <div className="w-full max-w-sm h-[70vh] bg-[var(--bg-main)] border border-[var(--border-glass)] rounded-[40px] shadow-2xl flex flex-col overflow-hidden">
                   <header className="p-6 border-b border-white/5 flex justify-between items-center bg-[var(--bg-main)] z-10">
                       <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-widest">{lang === 'ru' ? 'Все цели' : 'All Goals'}</h3>
                       <button onClick={() => setShowGoalsList(false)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)]"><X size={18}/></button>
                   </header>
                   <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-hide">
                       {(user.goals || []).length === 0 ? (
                           <p className="text-center text-slate-500 text-xs mt-10">{lang === 'ru' ? 'Список пуст' : 'No goals yet'}</p>
                       ) : (
                           (user.goals || []).map(g => (
                               <div key={g.id} className="p-4 rounded-[24px] bg-white/5 border border-white/5 flex items-center justify-between">
                                   <div className="flex items-center gap-3 overflow-hidden">
                                       <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: g.color || '#fbbf24' }} />
                                       <div className="flex flex-col overflow-hidden">
                                           <span className="text-sm font-bold text-[var(--text-primary)] truncate">{g.title}</span>
                                           <span className="text-mini text-slate-500 font-bold uppercase">{g.progress} / {g.target} {g.unit}</span>
                                       </div>
                                   </div>
                                   <div className="flex items-center gap-2 shrink-0">
                                       <button onClick={() => handleOpenEditGoal(g)} className="p-2 text-slate-500 hover:text-white transition-colors"><Edit size={14}/></button>
                                       <button onClick={() => handleDeleteGoal(g.id)} className="p-2 text-slate-500 hover:text-rose-500 transition-colors"><X size={16}/></button>
                                   </div>
                               </div>
                           ))
                       )}
                   </div>
               </div>
           </div>
       )}

       {/* ADD/EDIT GOAL MODAL */}
       {showAddGoalModal && (
           <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 animate-fadeIn">
               <div className="w-full max-w-sm bg-[var(--bg-main)] border border-[var(--border-glass)] rounded-[40px] p-6 shadow-2xl">
                   <div className="flex justify-between items-center mb-6">
                       <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-widest">{editingGoalId ? (lang === 'ru' ? 'Редактировать' : 'Edit Goal') : (lang === 'ru' ? 'Новая цель' : 'New Goal')}</h3>
                       <button onClick={() => setShowAddGoalModal(false)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)]"><X size={18}/></button>
                   </div>
                   <div className="space-y-4">
                       <input 
                         value={newGoal.title}
                         onChange={e => setNewGoal({...newGoal, title: e.target.value})}
                         placeholder={lang === 'ru' ? 'Название' : 'Title'}
                         className="w-full h-12 bg-[var(--bg-card)] border border-[var(--border-glass)] rounded-2xl px-4 text-[var(--text-primary)] text-sm font-bold focus:outline-none focus:border-indigo-500/50"
                       />
                       <div className="grid grid-cols-2 gap-4">
                           <div>
                               <label className="text-xxs font-black text-slate-500 uppercase tracking-widest mb-2 block">{lang === 'ru' ? 'Цель' : 'Target'}</label>
                               <input 
                                    type="number"
                                    value={newGoal.target}
                                    onChange={e => setNewGoal({...newGoal, target: parseFloat(e.target.value)})}
                                    className="w-full h-12 bg-[var(--bg-card)] border border-[var(--border-glass)] rounded-2xl px-4 text-[var(--text-primary)] text-sm font-bold focus:outline-none"
                                />
                           </div>
                           <div>
                               <label className="text-xxs font-black text-slate-500 uppercase tracking-widest mb-2 block">{lang === 'ru' ? 'Ед. изм.' : 'Unit'}</label>
                               <input 
                                    value={newGoal.unit}
                                    onChange={e => setNewGoal({...newGoal, unit: e.target.value})}
                                    placeholder="%"
                                    className="w-full h-12 bg-[var(--bg-card)] border border-[var(--border-glass)] rounded-2xl px-4 text-[var(--text-primary)] text-sm font-bold focus:outline-none"
                                />
                           </div>
                       </div>
                       
                       <div>
                           <label className="text-xxs font-black text-slate-500 uppercase tracking-widest mb-3 block">{lang === 'ru' ? 'Цвет' : 'Color'}</label>
                           <div className="flex gap-2 overflow-x-auto scrollbar-hide py-1">
                               {GOAL_COLORS.map(c => (
                                   <button 
                                     key={c}
                                     onClick={() => setNewGoal({...newGoal, color: c})}
                                     className={`w-8 h-8 rounded-full shrink-0 transition-all ${newGoal.color === c ? 'ring-2 ring-white scale-110' : 'opacity-50 hover:opacity-100'}`}
                                     style={{ backgroundColor: c }}
                                   />
                               ))}
                           </div>
                       </div>
                       <button onClick={handleAddGoal} disabled={!newGoal.title.trim()} className="w-full h-14 bg-indigo-500 text-white rounded-full font-black uppercase text-[11px] shadow-lg disabled:opacity-30 active:scale-95 transition-all mt-2">
                           {t.save}
                       </button>
                   </div>
               </div>
           </div>
       )}

       {/* PROGRESS MODAL */}
       {showProgressModal && activeGoalId && (
            <div className="fixed inset-0 z-[600] flex items-center justify-center p-6 animate-fadeIn">
                <div className="w-full max-w-[300px] bg-[var(--bg-main)] border border-[var(--border-glass)] rounded-[36px] p-6 shadow-2xl transform transition-all">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-widest">{lang === 'ru' ? 'Прогресс' : 'Add Progress'}</h3>
                        <button onClick={() => setShowProgressModal(false)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:text-[var(--text-primary)]"><X size={18}/></button>
                    </div>
                    
                    <div className="space-y-4">
                        <div className="bg-white/5 rounded-2xl p-2 border border-white/5">
                            <GlassInput 
                                type="number"
                                value={progressInput} 
                                onChange={e => setProgressInput(e.target.value)} 
                                autoFocus
                                placeholder="0"
                                className="text-base font-bold h-12 bg-transparent border-none focus:ring-0 placeholder:text-slate-600 text-center text-[var(--text-primary)]"
                                onKeyDown={e => e.key === 'Enter' && handleUpdateProgress()}
                            />
                        </div>
                        <div className="text-center text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                            {user.goals?.find(g => g.id === activeGoalId)?.unit || '%'}
                        </div>
                        
                        <button 
                            onClick={handleUpdateProgress} 
                            disabled={!progressInput}
                            className="w-full h-12 bg-indigo-600 text-white rounded-full font-black uppercase text-[11px] shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            <Check size={16} strokeWidth={3} /> {t.save}
                        </button>
                    </div>
                </div>
            </div>
       )}

       {/* SLEEP MODAL */}
       {showSleepModal && (
           <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 animate-fadeIn">
               <div className="w-full max-w-sm bg-[var(--bg-main)] border border-[var(--border-glass)] rounded-[40px] p-6 shadow-2xl text-center">
                   <div className="flex justify-between items-center mb-8">
                       <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-widest">{lang === 'ru' ? 'Сон' : 'Sleep'}</h3>
                       <button onClick={() => setShowSleepModal(false)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)]"><X size={18}/></button>
                   </div>
                   
                   <div className="mb-8">
                       <div className="text-6xl font-black text-indigo-400 mb-2">{editSleepValue}<span className="text-2xl text-indigo-500/50 ml-1">h</span></div>
                       <p className="text-mini font-black text-slate-500 uppercase tracking-widest">{lang === 'ru' ? 'Сегодня' : 'Today'}</p>
                   </div>

                   <div className="flex items-center gap-4 mb-8">
                       <button onClick={() => setEditSleepValue(Math.max(0, editSleepValue - 0.5))} className="w-12 h-12 rounded-full bg-white/5 border border-[var(--border-glass)] flex items-center justify-center text-[var(--text-primary)] text-xl font-bold active:scale-90">-</button>
                       <input 
                         type="range" 
                         min="0" 
                         max="14" 
                         step="0.5" 
                         value={editSleepValue} 
                         onChange={e => setEditSleepValue(Number(e.target.value))} 
                         className="flex-1 h-3 bg-[var(--bg-card)] rounded-full appearance-none accent-indigo-500 cursor-pointer"
                       />
                       <button onClick={() => setEditSleepValue(Math.min(14, editSleepValue + 0.5))} className="w-12 h-12 rounded-full bg-white/5 border border-[var(--border-glass)] flex items-center justify-center text-[var(--text-primary)] text-xl font-bold active:scale-90">+</button>
                   </div>

                   <button onClick={() => { onUpdateStats({...stats, sleepHours: editSleepValue}); setShowSleepModal(false); }} className="w-full h-14 bg-indigo-500 text-white rounded-full font-black uppercase text-[11px] shadow-lg active:scale-95 transition-all">
                       {t.save}
                   </button>
               </div>
           </div>
       )}
    </div>
  );
};
