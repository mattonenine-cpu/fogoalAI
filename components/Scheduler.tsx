
import React, { useState, useMemo } from 'react';
import { Task, UserProfile, Language, TRANSLATIONS, Note, DailyStats } from '../types';
import { GlassInput } from './GlassCard';
import { Plus, Check, ChevronLeft, ChevronRight, Clock, Flag, Trash2, StickyNote, Edit2, Palette, X, Moon, Smile } from 'lucide-react';
import { getLocalISODate } from '../services/geminiService';

interface SchedulerProps {
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  userProfile: UserProfile;
  setUserProfile: (profile: UserProfile) => void;
  lang: Language;
  onTrackRequest: (taskId: string) => void;
  notes: Note[];
  onUpdateNotes: (notes: Note[]) => void;
  currentStats: DailyStats;
}

const TASK_COLORS = ['transparent', '#6366f1', '#ef4444', '#f59e0b', '#10b981', '#ec4899', '#8b5cf6'];

export const Scheduler: React.FC<SchedulerProps> = ({ 
    tasks, setTasks, userProfile, lang, notes, currentStats, setUserProfile
}) => {
    const t = TRANSLATIONS[lang] || TRANSLATIONS['en'];
    const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('day');
    const [currentDate, setCurrentDate] = useState(new Date());
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [newTaskTime, setNewTaskTime] = useState('');

    const [editingTask, setEditingTask] = useState<Task | null>(null);
    const [showColorPicker, setShowColorPicker] = useState<string | null>(null); // ISO Date string for the modal
    const [dayNote, setDayNote] = useState('');
    const [selectedColor, setSelectedColor] = useState('transparent');

    const selectedDateISO = getLocalISODate(currentDate);
    const todayISO = getLocalISODate(new Date());

    const handlePrev = () => {
        const d = new Date(currentDate);
        if (viewMode === 'day') d.setDate(d.getDate() - 1);
        else if (viewMode === 'week') d.setDate(d.getDate() - 7);
        else d.setMonth(d.getMonth() - 1);
        setCurrentDate(d);
    };

    const handleNext = () => {
        const d = new Date(currentDate);
        if (viewMode === 'day') d.setDate(d.getDate() + 1);
        else if (viewMode === 'week') d.setDate(d.getDate() + 7);
        else d.setMonth(d.getMonth() + 1);
        setCurrentDate(d);
    };

    const handleAddTask = () => {
        if (!newTaskTitle.trim()) return;
        const newTask: Task = {
            id: Date.now().toString(),
            title: newTaskTitle,
            category: 'focus',
            durationMinutes: 30,
            completed: false,
            priority: 'Medium',
            energyRequired: 'medium',
            date: selectedDateISO,
            status: 'planned',
            scheduledTime: newTaskTime || undefined,
            color: 'transparent'
        };
        setTasks([...tasks, newTask]);
        setNewTaskTitle('');
        setNewTaskTime('');
    };

    const handleSaveTaskEdit = () => {
        if (!editingTask) return;
        setTasks(prev => prev.map(tk => tk.id === editingTask.id ? editingTask : tk));
        setEditingTask(null);
    };

    const handleOpenDayModal = (iso: string) => {
        setShowColorPicker(iso);
        setDayNote(userProfile.dayNotes?.[iso] || '');
        setSelectedColor(userProfile.dayColors?.[iso] || 'transparent');
    };

    const handleSaveDayMarking = () => {
        if (!showColorPicker) return;
        const iso = showColorPicker;
        
        const updatedColors = { ...(userProfile.dayColors || {}) };
        if (selectedColor === 'transparent') delete updatedColors[iso];
        else updatedColors[iso] = selectedColor;

        const updatedNotes = { ...(userProfile.dayNotes || {}) };
        if (!dayNote.trim()) delete updatedNotes[iso];
        else updatedNotes[iso] = dayNote.trim();

        setUserProfile({ ...userProfile, dayColors: updatedColors, dayNotes: updatedNotes });
        setShowColorPicker(null);
    };

    const getStatsForDate = (iso: string) => {
        if (iso === todayISO) return currentStats;
        return userProfile.statsHistory?.find(s => s.date === iso);
    };

    const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
    const calendarDays = useMemo(() => {
        const days = [];
        const prevMonthDays = daysInMonth(currentDate.getFullYear(), currentDate.getMonth() - 1);
        const currentMonthDays = daysInMonth(currentDate.getFullYear(), currentDate.getMonth());
        
        const offset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
        for (let i = offset; i > 0; i--) days.push({ day: prevMonthDays - i + 1, month: 'prev', current: false });
        for (let i = 1; i <= currentMonthDays; i++) days.push({ day: i, month: 'current', current: i === currentDate.getDate() });
        return days;
    }, [currentDate, firstDayOfMonth]);

    const weekDays = useMemo(() => {
        const startOfWeek = new Date(currentDate);
        const day = startOfWeek.getDay();
        const diff = startOfWeek.getDate() - (day === 0 ? 6 : day - 1);
        startOfWeek.setDate(diff);
        
        return Array.from({ length: 7 }, (_, i) => {
            const d = new Date(startOfWeek);
            d.setDate(startOfWeek.getDate() + i);
            return d;
        });
    }, [currentDate]);

    const dayTasks = useMemo(() => tasks.filter(tk => tk.date === selectedDateISO), [tasks, selectedDateISO]);
    const dayNotes = useMemo(() => notes.filter(n => n.linkedDate === selectedDateISO), [notes, selectedDateISO]);
    const selectedDayMicroNote = userProfile.dayNotes?.[selectedDateISO];
    const selectedDayStats = getStatsForDate(selectedDateISO);

    const headerDateTitle = useMemo(() => {
        if (viewMode === 'month') {
            return currentDate.toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US', { month: 'long' });
        }
        return currentDate.toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'long', weekday: 'long' });
    }, [currentDate, lang, viewMode]);

    return (
        <div className="animate-fade-in-up space-y-5">
            <div className="flex bg-white/5 rounded-full p-1 border border-[var(--border-glass)] w-fit mx-auto shadow-sm backdrop-blur-xl">
                {(['day', 'week', 'month'] as const).map(m => (
                    <button 
                        key={m}
                        onClick={() => setViewMode(m)}
                        className={`px-6 py-2 rounded-full text-xs font-medium transition-all duration-300 ${viewMode === m ? 'bg-[var(--bg-active)] text-[var(--bg-active-text)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                    >
                        {m === 'day' ? (lang === 'ru' ? 'День' : 'Day') : m === 'week' ? (lang === 'ru' ? 'Неделя' : 'Week') : (lang === 'ru' ? 'Месяц' : 'Month')}
                    </button>
                ))}
            </div>

            <div className="flex flex-col gap-5 px-1">
                <div className="flex items-center justify-between">
                    <button onClick={handlePrev} className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 text-[var(--text-secondary)] active:scale-90 transition-all"><ChevronLeft size={20}/></button>
                    <div className="text-center">
                        <div className="flex items-center justify-center gap-3">
                            <p className="text-mini font-medium text-indigo-400 mb-1">{selectedDateISO}</p>
                            {(selectedDayStats?.mood || (selectedDayStats?.sleepHours !== undefined && selectedDayStats.sleepHours > 0)) && (
                                <div className="flex items-center gap-2 mb-1 px-2 py-0.5 rounded-full bg-white/5 border border-white/5">
                                    {selectedDayStats.mood && <span className="text-xs leading-none">{selectedDayStats.mood === 'Happy' ? '😊' : selectedDayStats.mood === 'Sad' ? '😔' : '😐'}</span>}
                                    {selectedDayStats.sleepHours > 0 && (
                                        <div className="flex items-center gap-1">
                                            <Moon size={8} className="text-indigo-400"/>
                                            <span className="text-[9px] font-bold text-[var(--text-secondary)] leading-none">{selectedDayStats.sleepHours}h</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        <h2 className="text-2xl font-medium text-[var(--text-primary)] capitalize">
                            {headerDateTitle}
                        </h2>
                    </div>
                    <button onClick={handleNext} className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 text-[var(--text-secondary)] active:scale-90 transition-all"><ChevronRight size={20}/></button>
                </div>

                <div className="flex gap-2">
                    <div className="relative group flex-1">
                        <GlassInput 
                            value={newTaskTitle}
                            onChange={e => setNewTaskTitle(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAddTask()}
                            placeholder={t.addTaskPlaceholder}
                            className="bg-white/5 border-[var(--border-glass)] h-14 rounded-[20px] pr-14 text-sm font-normal focus:bg-white/[0.08]"
                        />
                        <button 
                            onClick={handleAddTask}
                            className="absolute right-2 top-2 w-10 h-10 bg-[var(--bg-active)] text-[var(--bg-active-text)] rounded-[14px] flex items-center justify-center shadow-md active:scale-90 transition-all"
                        >
                            <Plus size={20} strokeWidth={2.5} />
                        </button>
                    </div>
                    <div className="relative w-20">
                        <input 
                            type="time" 
                            value={newTaskTime} 
                            onChange={(e) => setNewTaskTime(e.target.value)}
                            className="w-full h-14 rounded-[20px] bg-white/5 border border-[var(--border-glass)] text-center text-xs font-bold text-[var(--text-primary)] focus:outline-none appearance-none"
                        />
                    </div>
                </div>
            </div>

            <div className="px-1">
                {viewMode === 'week' && (
                    <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 mb-6">
                        {weekDays.map((wd, i) => {
                            const iso = getLocalISODate(wd);
                            const isActive = iso === selectedDateISO;
                            const dayColor = userProfile.dayColors?.[iso];
                            const historyStats = getStatsForDate(iso);
                            const hasTasks = tasks.some(t => t.date === iso);
                            const hasCustomColor = dayColor && dayColor !== 'transparent';

                            return (
                                <div 
                                    key={i} 
                                    onClick={() => setCurrentDate(wd)}
                                    className={`p-2 rounded-[24px] border transition-all cursor-pointer flex flex-col items-center gap-1 relative overflow-hidden h-[90px] justify-between ${isActive ? 'ring-2 ring-white/50 scale-105 z-10 shadow-md' : 'border-[var(--border-glass)] hover:bg-white/10'}`}
                                    style={{ 
                                        backgroundColor: hasCustomColor ? dayColor : (isActive ? 'var(--bg-active)' : 'rgba(255,255,255,0.05)'),
                                        color: isActive && !hasCustomColor ? 'var(--bg-active-text)' : 'var(--text-primary)'
                                    }}
                                >
                                    <div className="text-center mt-1">
                                        <span className={`text-[10px] font-bold uppercase block opacity-60`}>{wd.toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US', { weekday: 'short' })}</span>
                                        <span className="text-sm font-black">{wd.getDate()}</span>
                                    </div>
                                    
                                    <div className="flex flex-col items-center gap-0.5 mb-1">
                                        {(historyStats?.mood || historyStats?.sleepHours) ? (
                                            <div className="flex flex-col items-center">
                                                {historyStats.mood && (
                                                    <span className="text-xs leading-none">
                                                        {historyStats.mood === 'Happy' ? '😊' : historyStats.mood === 'Sad' ? '😔' : '😐'}
                                                    </span>
                                                )}
                                                {historyStats.sleepHours !== undefined && historyStats.sleepHours > 0 && (
                                                    <span className="text-[8px] font-black opacity-80 leading-none mt-0.5">{historyStats.sleepHours}h</span>
                                                )}
                                            </div>
                                        ) : (
                                            hasTasks && <div className={`w-1 h-1 rounded-full ${isActive && !hasCustomColor ? 'bg-[var(--bg-active-text)]' : 'bg-white'}`} />
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {viewMode === 'month' && (
                    <div className="bg-white/5 border border-[var(--border-glass)] rounded-[32px] p-5 shadow-xl mb-6 relative">
                        <div className="flex justify-between items-end mb-4 px-2">
                            <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-widest">{lang === 'ru' ? 'Месяц' : 'Month'}</h3>
                            <button 
                                onClick={() => handleOpenDayModal(selectedDateISO)}
                                className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-indigo-400 bg-indigo-500/10 px-3 py-1.5 rounded-full hover:bg-indigo-500/20 transition-all active:scale-95 border border-indigo-500/20"
                            >
                                <Palette size={12} />
                                {lang === 'ru' ? 'Отметить' : 'Mark'}
                            </button>
                        </div>
                        <div className="grid grid-cols-7 gap-1 mb-2">
                            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(d => (
                                <div key={d} className="text-center text-mini font-semibold text-[var(--text-secondary)] opacity-40">{d}</div>
                            ))}
                        </div>
                        <div className="grid grid-cols-7 gap-1">
                            {calendarDays.map((d, i) => {
                                const iso = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}-${d.day.toString().padStart(2, '0')}`;
                                const hasTasks = tasks.some(t => t.date === iso);
                                const dayColor = userProfile.dayColors?.[iso];
                                const hasMicroNote = !!userProfile.dayNotes?.[iso];
                                return (
                                    <div 
                                        key={i} 
                                        onClick={() => {
                                            if (d.month === 'current') {
                                                const newD = new Date(currentDate.getFullYear(), currentDate.getMonth(), d.day);
                                                if (selectedDateISO === iso) {
                                                    handleOpenDayModal(iso);
                                                } else {
                                                    setCurrentDate(newD);
                                                }
                                            }
                                        }}
                                        className={`aspect-square flex items-center justify-center rounded-xl transition-all relative ${d.month !== 'current' ? 'opacity-10 pointer-events-none' : 'cursor-pointer hover:bg-white/10'} ${d.current ? 'bg-[var(--bg-active)] text-[var(--bg-active-text)] font-semibold shadow-md' : 'font-medium text-xs text-[var(--text-primary)]'}`}
                                        style={{ 
                                            backgroundColor: (d.current ? undefined : (dayColor && dayColor !== 'transparent' ? `${dayColor}25` : undefined)),
                                            border: (dayColor && dayColor !== 'transparent' && !d.current) ? `1px solid ${dayColor}50` : undefined,
                                            boxShadow: (d.current && dayColor && dayColor !== 'transparent') ? `inset 0 0 0 2px ${dayColor}` : undefined
                                        }}
                                    >
                                        {d.day}
                                        {hasTasks && !d.current && <div className="absolute bottom-1 w-1 h-1 rounded-full bg-indigo-500" />}
                                        {hasMicroNote && <div className={`absolute top-1 right-1 w-1.5 h-1.5 rounded-full ${d.current ? 'bg-[var(--bg-active-text)]' : 'bg-[var(--theme-accent)]'}`} />}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div className="space-y-5 pb-24">
                    {/* Micro Note Display */}
                    {selectedDayMicroNote && (
                        <div className="p-4 rounded-[24px] bg-indigo-500/10 border border-indigo-500/20 flex gap-3 items-start animate-fade-in-up cursor-pointer hover:bg-indigo-500/15 transition-all" onClick={() => handleOpenDayModal(selectedDateISO)}>
                            <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0 mt-0.5">
                                <Flag size={14} fill="currentColor" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">{lang === 'ru' ? 'Важное' : 'Important'}</p>
                                <p className="text-sm font-medium text-[var(--text-primary)] leading-relaxed">{selectedDayMicroNote}</p>
                            </div>
                        </div>
                    )}

                    {dayNotes.length > 0 && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 px-2 text-[var(--text-secondary)] opacity-60">
                                <StickyNote size={14} />
                                <h4 className="text-xs font-semibold">{lang === 'ru' ? 'Заметки дня' : 'Day Notes'}</h4>
                            </div>
                            {dayNotes.map(note => (
                                <div key={note.id} className="p-4 rounded-[24px] border border-[var(--border-glass)] bg-white/2 flex flex-col gap-1 transition-all" style={{ borderLeft: `3px solid ${note.color !== 'transparent' ? note.color : 'var(--border-glass)'}` }}>
                                    <p className="text-sm font-semibold text-[var(--text-primary)]">{note.title || 'Untitled'}</p>
                                    <p className="text-xs text-[var(--text-secondary)] line-clamp-2 font-normal">{note.content}</p>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="space-y-3">
                        {dayTasks.length === 0 ? (
                            <div className="text-center py-10 opacity-30">
                                <p className="text-xs font-medium text-[var(--text-primary)]">{lang === 'ru' ? 'Задач нет' : 'No tasks'}</p>
                            </div>
                        ) : (
                            dayTasks.map(tk => (
                                <div 
                                    key={tk.id} 
                                    className={`p-4 rounded-[24px] border border-[var(--border-glass)] flex items-center gap-3 transition-all relative overflow-hidden ${tk.completed ? 'opacity-40 grayscale' : 'shadow-sm'}`}
                                    style={{ backgroundColor: tk.color && tk.color !== 'transparent' ? `${tk.color}15` : 'rgba(255,255,255,0.05)' }}
                                >
                                    {tk.color && tk.color !== 'transparent' && <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: tk.color }} />}
                                    
                                    <button onClick={() => setTasks(prev => prev.map(t => t.id === tk.id ? {...t, completed: !t.completed} : t))} className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all ${tk.completed ? 'bg-[var(--text-primary)] border-[var(--text-primary)]' : 'border-[var(--text-secondary)]/30'}`}>
                                        {tk.completed && <Check size={14} className="text-[var(--bg-main)]" strokeWidth={4} />}
                                    </button>
                                    <div className="flex-1 min-w-0" onClick={() => setEditingTask(tk)}>
                                        <div className="flex items-center gap-2">
                                            {tk.emoji && <span className="text-lg">{tk.emoji}</span>}
                                            <p className={`text-sm font-medium text-[var(--text-primary)] leading-tight ${tk.completed ? 'line-through' : ''}`}>{tk.title}</p>
                                        </div>
                                        {tk.scheduledTime && (
                                            <div className="flex items-center gap-1.5 mt-1 opacity-50">
                                                <Clock size={10} /><span className="text-mini font-medium">{tk.scheduledTime}</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => setEditingTask(tk)} className="text-[var(--text-secondary)] opacity-40 hover:opacity-100 p-2"><Edit2 size={14}/></button>
                                        <button onClick={() => setTasks(prev => prev.filter(t => t.id !== tk.id))} className="text-rose-500/30 hover:text-rose-500 transition-colors p-2"><Trash2 size={16}/></button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* DAY MARKING MODAL */}
            {showColorPicker && (
                <div className="fixed inset-0 z-[550] flex items-center justify-center p-6 animate-fadeIn">
                    <div className="w-full max-w-sm bg-[var(--bg-main)] border border-[var(--border-glass)] rounded-[40px] p-6 shadow-2xl space-y-6">
                        <div className="flex justify-between items-center">
                            <div className="flex flex-col">
                                <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-widest">{lang === 'ru' ? 'Отметить День' : 'Mark Day'}</h3>
                                <span className="text-[10px] text-[var(--text-secondary)] font-bold">{showColorPicker}</span>
                            </div>
                            <button onClick={() => setShowColorPicker(null)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)]"><X size={18}/></button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest mb-3 block">{lang === 'ru' ? 'Цвет дня' : 'Day Color'}</label>
                                <div className="flex gap-3 overflow-x-auto scrollbar-hide py-1">
                                    {TASK_COLORS.map(c => (
                                        <button 
                                            key={c}
                                            onClick={() => setSelectedColor(c)}
                                            className={`w-10 h-10 rounded-full shrink-0 transition-all border-2 ${selectedColor === c ? 'border-[var(--text-primary)] scale-110' : 'border-transparent opacity-60 hover:opacity-100'}`}
                                            style={{ backgroundColor: c === 'transparent' ? 'rgba(255,255,255,0.1)' : c }}
                                        >
                                            {selectedColor === c && <Check size={16} className="text-white mx-auto" strokeWidth={3} />}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest mb-2 block">{lang === 'ru' ? 'Микрозаметка' : 'Micro Note'}</label>
                                <GlassInput 
                                    value={dayNote}
                                    onChange={e => setDayNote(e.target.value)}
                                    placeholder={lang === 'ru' ? 'Важное событие...' : 'Important event...'}
                                    className="h-14 rounded-[20px]"
                                />
                            </div>
                        </div>

                        <button onClick={handleSaveDayMarking} className="w-full h-14 bg-[var(--bg-active)] text-[var(--bg-active-text)] rounded-full font-black uppercase text-[11px] shadow-lg active:scale-95 transition-all">
                            {t.save}
                        </button>
                    </div>
                </div>
            )}

            {/* EDIT TASK MODAL */}
            {editingTask && (
                <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 animate-fadeIn">
                    <div className="w-full max-w-sm bg-[var(--bg-main)] border border-[var(--border-glass)] rounded-[40px] p-6 shadow-2xl space-y-6">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-widest">{lang === 'ru' ? 'Редактировать' : 'Edit Task'}</h3>
                            <button onClick={() => setEditingTask(null)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)]"><X size={18}/></button>
                        </div>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest mb-2 block">{lang === 'ru' ? 'Название' : 'Title'}</label>
                                <input 
                                    value={editingTask.title}
                                    onChange={e => setEditingTask({...editingTask, title: e.target.value})}
                                    className="w-full h-12 bg-[var(--bg-card)] border border-[var(--border-glass)] rounded-2xl px-4 text-[var(--text-primary)] text-sm font-bold focus:outline-none focus:border-indigo-500/50"
                                />
                            </div>
                            
                            <div>
                                <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest mb-2 block">{lang === 'ru' ? 'Время' : 'Time'}</label>
                                <input 
                                    type="time"
                                    value={editingTask.scheduledTime || ''}
                                    onChange={e => setEditingTask({...editingTask, scheduledTime: e.target.value})}
                                    className="w-full h-12 bg-[var(--bg-card)] border border-[var(--border-glass)] rounded-2xl px-4 text-[var(--text-primary)] text-sm font-bold focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest mb-3 block">{lang === 'ru' ? 'Цвет' : 'Color'}</label>
                                <div className="flex gap-2 overflow-x-auto scrollbar-hide py-1">
                                    {TASK_COLORS.map(c => (
                                        <button 
                                            key={c}
                                            onClick={() => setEditingTask({...editingTask, color: c})}
                                            className={`w-10 h-10 rounded-full shrink-0 transition-all border-2 ${editingTask.color === c ? 'border-[var(--text-primary)] scale-110' : 'border-transparent opacity-60 hover:opacity-100'}`}
                                            style={{ backgroundColor: c === 'transparent' ? 'rgba(255,255,255,0.1)' : c }}
                                        >
                                            {editingTask.color === c && <Check size={16} className="text-white mx-auto" strokeWidth={3} />}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <button onClick={handleSaveTaskEdit} className="w-full h-14 bg-[var(--bg-active)] text-[var(--bg-active-text)] rounded-full font-black uppercase text-[11px] shadow-lg active:scale-95 transition-all">
                            {t.save}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
