
import React, { useState } from 'react';
import { Task } from '../types';
import { X, Check } from 'lucide-react';
import { GlassInput } from './GlassCard';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: Partial<Task>) => void;
  onDelete?: (id: string) => void;
  initialTask?: Task | null;
  lang: string;
}

const TASK_COLORS = ['transparent', '#6366f1', '#ef4444', '#f59e0b', '#10b981', '#ec4899', '#8b5cf6'];

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const SmartPlannerModal: React.FC<TaskModalProps> = ({ isOpen, onClose, onSave, onDelete, initialTask, lang }) => {
  const [title, setTitle] = useState(initialTask?.title || '');
  const [duration, setDuration] = useState(initialTask?.durationMinutes || 60);
  const [color, setColor] = useState(initialTask?.color || 'transparent');
  const [date, setDate] = useState(initialTask?.date || todayISO());
  const [scheduledTime, setScheduledTime] = useState(initialTask?.scheduledTime || '09:00');
  const [hasDate, setHasDate] = useState(!!(initialTask?.date && initialTask?.scheduledTime));

  React.useEffect(() => {
    if (isOpen) {
      setTitle(initialTask?.title || '');
      setDuration(initialTask?.durationMinutes || 60);
      setColor(initialTask?.color || 'transparent');
      setDate(initialTask?.date || todayISO());
      setScheduledTime(initialTask?.scheduledTime || '09:00');
      setHasDate(!!(initialTask?.date && initialTask?.scheduledTime));
    }
  }, [isOpen, initialTask]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      id: initialTask?.id,
      title,
      durationMinutes: duration,
      color,
      smartType: initialTask?.smartType || 'ONE_OFF',
      priority: initialTask?.priority || 'Medium',
      preferredTime: initialTask?.preferredTime || 'MORNING',
      category: initialTask?.category || 'work',
      date: hasDate ? date : undefined,
      scheduledTime: hasDate ? scheduledTime : undefined,
      completed: initialTask?.completed || false,
      status: 'planned'
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[800] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-fadeIn">
      <div className="w-full max-w-sm bg-[var(--bg-main)] border border-[var(--border-glass)] rounded-[40px] shadow-2xl overflow-hidden animate-fade-in-up">
        <div className="flex items-center justify-between p-6 border-b border-[var(--border-glass)] bg-white/5">
          <h2 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-widest">
            {initialTask?.id ? 'Редактировать' : 'Новая задача'}
          </h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-[var(--text-secondary)] hover:text-white transition-all">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="space-y-2">
            <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest px-1">Название</label>
            <GlassInput 
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Например: Поесть"
              required
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest px-1">Длительность (мин)</label>
            <GlassInput 
              type="number" 
              value={duration}
              onChange={e => setDuration(Number(e.target.value))}
              step={15}
              min={15}
            />
          </div>

          <div className="space-y-2">
            <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest px-1">Цвет</label>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide py-1">
                {TASK_COLORS.map(c => (
                    <button 
                        type="button"
                        key={c}
                        onClick={() => setColor(c)}
                        className={`w-10 h-10 rounded-full shrink-0 transition-all border-2 flex items-center justify-center ${color === c ? 'border-[var(--text-primary)] scale-110' : 'border-transparent opacity-60 hover:opacity-100'}`}
                        style={{ backgroundColor: c === 'transparent' ? 'rgba(255,255,255,0.1)' : c }}
                    >
                        {color === c && <Check size={16} className="text-white drop-shadow-md" strokeWidth={3} />}
                    </button>
                ))}
            </div>
          </div>

          <div className="space-y-3 p-3 rounded-2xl bg-white/5 border border-[var(--border-glass)]">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={hasDate}
                onChange={(e) => setHasDate(e.target.checked)}
                className="rounded border-[var(--border-glass)] bg-white/5 text-indigo-500 focus:ring-indigo-500"
              />
              <span className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest">
                {lang === 'ru' ? 'Назначить дату и время (появится в сетке)' : 'Set date & time (show on grid)'}
              </span>
            </label>
            {hasDate && (
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-widest block mb-1">Дата</label>
                  <GlassInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
                <div className="w-24">
                  <label className="text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-widest block mb-1">{lang === 'ru' ? 'Время' : 'Time'}</label>
                  <GlassInput type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} />
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 flex gap-3">
             {initialTask?.id && onDelete && (
                 <button 
                    type="button" 
                    onClick={() => onDelete(initialTask.id)}
                    className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center hover:bg-rose-500/20 transition-all active:scale-95"
                 >
                    <X size={20} />
                 </button>
             )}
             <button 
                type="submit" 
                className="flex-1 h-14 bg-[var(--bg-active)] text-[var(--bg-active-text)] rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-2xl active:scale-95 transition-all"
             >
                {initialTask?.id ? 'Сохранить' : 'Добавить'}
             </button>
          </div>
        </form>
      </div>
    </div>
  );
};
