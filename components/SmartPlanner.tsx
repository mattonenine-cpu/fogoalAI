
import React, { useState, useEffect, useMemo } from 'react';
import { Task, Language, TRANSLATIONS } from '../types';
import { SmartPlannerGrid } from './SmartPlannerGrid';
import { SmartPlannerModal } from './SmartPlannerModal';
import { ChevronLeft, ChevronRight, LayoutGrid, Undo2, List } from 'lucide-react';
import { addDays, subDays, format } from '../services/smartPlanner';
import { CreditsService } from '../services/creditsService';

interface SmartPlannerProps {
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  lang: Language;
  onOpenScheduler?: () => void;
  onDeductCredits?: (cost: number) => void;
}

export const SmartPlanner: React.FC<SmartPlannerProps> = ({ tasks, setTasks, lang, onOpenScheduler, onDeductCredits }) => {
  const t = TRANSLATIONS[lang] || TRANSLATIONS['en'];
  const [currentDate, setCurrentDate] = useState(new Date());
  const [taskHistory, setTaskHistory] = useState<Task[][]>([]); // For Undo
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showBacklog, setShowBacklog] = useState(false); 

  const scheduledTasks = useMemo(() => tasks.filter(t => t.date && t.scheduledTime && !t.completed), [tasks]);
  const backlogTasks = useMemo(() => tasks.filter(t => (!t.date || !t.scheduledTime) && !t.completed), [tasks]);

  const handleUpdateTask = (updatedTask: Task) => {
    setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
  };

  const handleCreateTask = (newTaskPartial: Partial<Task>) => {
    if (editingTask && editingTask.id) {
        setTasks(prev => prev.map(t => t.id === editingTask.id ? { ...t, ...newTaskPartial } as Task : t));
    } else {
        const newTask: Task = {
            ...newTaskPartial as Task,
            id: `smart_${Date.now()}`,
            status: 'planned'
        };
        setTasks(prev => [...prev, newTask]);
    }
  };

  const handleDeleteTask = (id: string) => {
      setTasks(prev => prev.filter(t => t.id !== id));
      setIsModalOpen(false);
  };

  const handleUndo = () => {
    if (taskHistory.length === 0) return;
    const previous = taskHistory[taskHistory.length - 1];
    setTasks(previous);
    setTaskHistory(prev => prev.slice(0, -1));
  };

  const handleGridClick = (date: Date) => {
      const dateStr = format(date, 'yyyy-MM-dd');
      const timeStr = format(date, 'HH:mm');
      setEditingTask({
          id: '', // Empty ID signals new task
          title: '',
          date: dateStr,
          scheduledTime: timeStr,
          durationMinutes: 60,
          category: 'work',
          completed: false,
          priority: 'Medium',
          energyRequired: 'medium',
          status: 'planned'
      });
      setIsModalOpen(true);
  };

  useEffect(() => {
      const handleClick = () => setShowBacklog(false);
  }, []);

  return (
    <div className="h-full flex flex-col animate-fadeIn relative">
      {showBacklog && (
        <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] transition-opacity"
            onClick={() => setShowBacklog(false)}
        />
      )}

      <div className={`
          fixed inset-y-0 left-0 z-[110] w-72 bg-[var(--bg-card)] border-r border-[var(--border-glass)] flex flex-col shadow-2xl backdrop-blur-xl transition-all duration-300 ease-in-out
          ${showBacklog ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-6 border-b border-[var(--border-glass)] flex items-center justify-between bg-white/5">
            <h2 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-widest flex items-center gap-2">
                <List size={16} /> {t.backlog}
            </h2>
            <div className="flex items-center gap-2">
                <div className="text-[9px] font-black bg-[var(--theme-accent)] text-white px-2 py-0.5 rounded-full">{backlogTasks.length}</div>
                <button onClick={() => setShowBacklog(false)} className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                    <ChevronLeft size={20} />
                </button>
            </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {backlogTasks.length === 0 && (
                <div className="text-center text-[var(--text-secondary)] text-xs py-10 opacity-50 font-medium">
                    {lang === 'ru' ? 'Пусто.' : 'Empty.'}
                </div>
            )}
            {backlogTasks.map(task => (
                <div 
                    key={task.id} 
                    onClick={() => { setEditingTask(task); setIsModalOpen(true); setShowBacklog(false); }}
                    className="p-3 bg-white/5 border border-[var(--border-glass)] rounded-2xl hover:border-[var(--theme-accent)] hover:bg-white/10 cursor-pointer group transition-all"
                >
                    <div className="flex justify-between items-start mb-1">
                        <span className="font-bold text-[11px] text-[var(--text-primary)] truncate">{task.title}</span>
                        <span className="text-[9px] bg-white/10 px-1.5 rounded text-[var(--text-secondary)]">{task.durationMinutes}m</span>
                    </div>
                    <div className="flex gap-2 text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-wider">
                        <span>{task.smartType || 'ONE_OFF'}</span>
                        <span className="opacity-50">•</span>
                        <span className={`${task.priority === 'High' ? 'text-rose-500' : 'text-[var(--text-secondary)]'}`}>{task.priority}</span>
                    </div>
                </div>
            ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0 h-full">
        
        <header className="shrink-0 flex flex-col gap-3 px-2 pb-2 z-20">
            <div className="flex items-center justify-between h-14">
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => setShowBacklog(!showBacklog)} 
                        className={`w-10 h-10 rounded-full flex items-center justify-center bg-white/5 border border-[var(--border-glass)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all`}
                    >
                        <LayoutGrid size={18} />
                    </button>
                    <div className="flex items-center gap-1 bg-white/5 rounded-full p-1 border border-[var(--border-glass)]">
                        <button onClick={() => setCurrentDate(subDays(currentDate, 3))} className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/10 transition-all">
                            <ChevronLeft size={16} />
                        </button>
                        <span className="text-[11px] font-black uppercase tracking-widest text-[var(--text-primary)] min-w-[100px] text-center">
                            {format(currentDate, 'd MMM')} - {format(addDays(currentDate, 2), 'd MMM')}
                        </span>
                        <button onClick={() => setCurrentDate(addDays(currentDate, 3))} className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/10 transition-all">
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {onOpenScheduler && (
                        <button
                            onClick={onOpenScheduler}
                            className="px-3 py-2 rounded-full text-[10px] font-black uppercase tracking-widest bg-white/5 border border-[var(--border-glass)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/10 active:scale-95 transition-all"
                        >
                            {lang === 'ru' ? 'Список' : 'List'}
                        </button>
                    )}
                    {taskHistory.length > 0 && (
                        <button 
                            onClick={handleUndo}
                            className="w-10 h-10 rounded-full bg-white/5 border border-[var(--border-glass)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
                            title="Undo"
                        >
                            <Undo2 size={18} />
                        </button>
                    )}
                </div>
            </div>
        </header>

        <main className="flex-1 overflow-hidden relative px-2 pb-0">
             <SmartPlannerGrid 
                currentDate={currentDate} 
                tasks={scheduledTasks} 
                onTaskUpdate={handleUpdateTask}
                onTaskClick={(task) => { setEditingTask(task); setIsModalOpen(true); }}
                onAddClick={handleGridClick}
                lang={lang}
             />
        </main>

      </div>

      <SmartPlannerModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSave={handleCreateTask}
        onDelete={handleDeleteTask}
        initialTask={editingTask}
        lang={lang}
      />
    </div>
  );
};
