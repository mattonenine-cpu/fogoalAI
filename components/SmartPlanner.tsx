
import React, { useState, useMemo } from 'react';
import { Task, Language, TRANSLATIONS } from '../types';
import { SmartPlannerGrid } from './SmartPlannerGrid';
import { SmartPlannerModal } from './SmartPlannerModal';
import { ChevronLeft, ChevronRight, LayoutGrid, Undo2, List, Plus } from 'lucide-react';
import { addDays, subDays, format } from '../services/smartPlanner';

type ViewMode = 'list' | 'grid';

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
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [taskHistory, setTaskHistory] = useState<Task[][]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

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
      id: '',
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

  const openAddTask = () => {
    setEditingTask(null);
    setIsModalOpen(true);
  };

  const openEditTask = (task: Task) => {
    setEditingTask(task);
    setIsModalOpen(true);
  };

  return (
    <div className="h-full flex flex-col animate-fadeIn relative">
      <header className="shrink-0 flex flex-col gap-3 px-2 pb-2 z-20">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-2">
            <div className="flex rounded-full p-1 bg-white/5 border border-[var(--border-glass)]">
              <button
                onClick={() => setViewMode('list')}
                className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                  viewMode === 'list' ? 'bg-[var(--bg-active)] text-[var(--bg-active-text)] shadow-lg' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/10'
                }`}
              >
                <List size={14} />
                {t.viewList}
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                  viewMode === 'grid' ? 'bg-[var(--bg-active)] text-[var(--bg-active-text)] shadow-lg' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/10'
                }`}
              >
                <LayoutGrid size={14} />
                {t.viewGrid}
              </button>
            </div>
            {viewMode === 'grid' && (
              <div className="flex items-center gap-1 bg-white/5 rounded-full p-1 border border-[var(--border-glass)]">
                <button onClick={() => setCurrentDate(subDays(currentDate, 3))} className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/10 transition-all">
                  <ChevronLeft size={16} />
                </button>
                <span className="text-[11px] font-black uppercase tracking-widest text-[var(--text-primary)] min-w-[100px] text-center">
                  {format(currentDate, 'd MMM')} – {format(addDays(currentDate, 2), 'd MMM')}
                </span>
                <button onClick={() => setCurrentDate(addDays(currentDate, 3))} className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/10 transition-all">
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {onOpenScheduler && (
              <button
                onClick={onOpenScheduler}
                className="px-3 py-2 rounded-full text-[10px] font-black uppercase tracking-widest bg-white/5 border border-[var(--border-glass)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/10 active:scale-95 transition-all"
              >
                {lang === 'ru' ? 'Календарь' : 'Calendar'}
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

      <main className="flex-1 flex flex-col overflow-hidden relative px-2 pb-0 min-h-0">
        {viewMode === 'list' ? (
          <div className="h-full flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => setViewMode('grid')}
                className="px-4 py-2.5 rounded-full text-[11px] font-black uppercase tracking-widest bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 hover:bg-indigo-500/30 transition-all flex items-center gap-2"
              >
                <LayoutGrid size={16} />
                {t.viewInGrid}
              </button>
              <button
                onClick={openAddTask}
                className="w-10 h-10 rounded-full bg-[var(--bg-active)] text-[var(--bg-active-text)] flex items-center justify-center shadow-lg active:scale-95 transition-all"
              >
                <Plus size={20} strokeWidth={2.5} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-6 pb-8">
              {backlogTasks.length > 0 && (
                <section>
                  <h3 className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest mb-2 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    {t.noDateSection} ({backlogTasks.length})
                  </h3>
                  <div className="space-y-2">
                    {backlogTasks.map(task => (
                      <div
                        key={task.id}
                        onClick={() => openEditTask(task)}
                        className="p-4 bg-white/5 border border-[var(--border-glass)] rounded-2xl hover:border-[var(--theme-accent)]/50 hover:bg-white/10 cursor-pointer transition-all active:scale-[0.99]"
                      >
                        <div className="flex justify-between items-start gap-2">
                          <span className="font-bold text-sm text-[var(--text-primary)]">{task.title}</span>
                          <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full text-[var(--text-secondary)] shrink-0">{task.durationMinutes}m</span>
                        </div>
                        <p className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-wider mt-1.5 opacity-70">
                          {lang === 'ru' ? 'Назначь дату в задаче — появится в сетке' : 'Set date in task to show on grid'}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {scheduledTasks.length > 0 && (
                <section>
                  <h3 className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest mb-2 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    {t.onGridSection} ({scheduledTasks.length})
                  </h3>
                  <div className="space-y-2">
                    {scheduledTasks
                      .slice()
                      .sort((a, b) => {
                        if (!a.date || !b.date) return 0;
                        const d = a.date.localeCompare(b.date);
                        if (d !== 0) return d;
                        return (a.scheduledTime || '').localeCompare(b.scheduledTime || '');
                      })
                      .map(task => (
                        <div
                          key={task.id}
                          onClick={() => openEditTask(task)}
                          className="p-4 bg-white/5 border border-[var(--border-glass)] rounded-2xl hover:border-[var(--theme-accent)]/50 hover:bg-white/10 cursor-pointer transition-all active:scale-[0.99]"
                        >
                          <div className="flex justify-between items-start gap-2">
                            <span className="font-bold text-sm text-[var(--text-primary)]">{task.title}</span>
                            <span className="text-[10px] text-[var(--text-secondary)] shrink-0">
                              {task.date} {task.scheduledTime}
                            </span>
                          </div>
                          <div className="flex gap-2 mt-1.5 text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-wider">
                            <span>{task.durationMinutes}m</span>
                          </div>
                        </div>
                      ))}
                  </div>
                </section>
              )}

              {backlogTasks.length === 0 && scheduledTasks.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <p className="text-[var(--text-secondary)] text-sm font-medium opacity-70 mb-4">
                    {lang === 'ru' ? 'Нет задач. Добавь в списке или в сетке.' : 'No tasks. Add from list or grid.'}
                  </p>
                  <button
                    onClick={openAddTask}
                    className="px-6 py-3 rounded-full bg-[var(--bg-active)] text-[var(--bg-active-text)] font-black uppercase text-[11px] shadow-lg active:scale-95 transition-all"
                  >
                    {t.addTask}
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col min-h-0">
            <div className="shrink-0 flex items-center justify-between mb-2">
              <button
                onClick={() => setViewMode('list')}
                className="px-3 py-2 rounded-full text-[10px] font-black uppercase tracking-widest bg-white/5 border border-[var(--border-glass)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/10 transition-all flex items-center gap-2"
              >
                <List size={14} />
                {t.viewInList}
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              <SmartPlannerGrid
                currentDate={currentDate}
                tasks={scheduledTasks}
                onTaskUpdate={handleUpdateTask}
                onTaskClick={(task) => openEditTask(task)}
                onAddClick={handleGridClick}
                lang={lang}
              />
            </div>
          </div>
        )}
      </main>

      <SmartPlannerModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingTask(null); }}
        onSave={handleCreateTask}
        onDelete={handleDeleteTask}
        initialTask={editingTask}
        lang={lang}
      />
    </div>
  );
};

export default SmartPlanner;
