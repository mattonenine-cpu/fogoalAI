
import React from 'react';
import { Task, Language } from '../types';
import { PIXELS_PER_HOUR } from '../services/smartPlanner';
import { GripVertical, CheckCircle2, Circle, Clock, Move } from 'lucide-react';

interface SmartBlockProps {
  task: Task;
  style?: React.CSSProperties;
  onPointerDown: (e: React.PointerEvent, task: Task, type: 'RESIZE') => void;
  onToggleStatus: (id: string) => void;
  onClick: (task: Task) => void;
  onStartMove: (task: Task) => void;
  isMoving?: boolean;
  lang: Language;
}

const TYPE_COLORS: Record<string, string> = {
  ROUTINE: 'bg-blue-500/20 border-blue-600/30 text-[var(--text-primary)]',
  ONE_OFF: 'bg-purple-500/20 border-purple-600/30 text-[var(--text-primary)]',
  EVENT: 'bg-amber-500/20 border-amber-600/30 text-[var(--text-primary)]',
  RECURRING: 'bg-emerald-500/20 border-emerald-600/30 text-[var(--text-primary)]',
  DEFAULT: 'bg-indigo-500/20 border-indigo-600/30 text-[var(--text-primary)]'
};

export const SmartBlock: React.FC<SmartBlockProps> = ({ 
  task, 
  style, 
  onPointerDown, 
  onToggleStatus,
  onClick,
  onStartMove,
  isMoving = false,
  lang
}) => {
  const height = (task.durationMinutes / 60) * PIXELS_PER_HOUR;
  // Use task color if available, otherwise fallback to type color
  const baseColorClass = TYPE_COLORS[task.smartType || 'DEFAULT'] || TYPE_COLORS.DEFAULT;
  const isDone = task.completed;

  return (
    <div
      className={`absolute w-[95%] left-[2.5%] rounded-xl border shadow-sm group transition-all overflow-visible select-none backdrop-blur-md ${baseColorClass} ${isDone ? 'opacity-50 grayscale' : ''} ${isMoving ? 'ring-4 ring-indigo-500/60 shadow-[0_0_20px_rgba(99,102,241,0.5)]' : ''}`}
      style={{
        ...style,
        height: `${height}px`,
        touchAction: 'none', // Crucial for Pointer Events
        zIndex: isMoving ? 50 : 10,
        backgroundColor: task.color && task.color !== 'transparent' ? `${task.color}30` : undefined,
        borderColor: task.color && task.color !== 'transparent' ? `${task.color}50` : undefined,
        animation: isMoving ? 'pulse-glow 2s ease-in-out infinite' : undefined,
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (!isMoving) {
          onClick(task);
        }
      }}
    >
      {/* Move Button - Absolute positioned top-left */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onStartMove(task);
        }}
        className={`absolute -top-2 -left-2 w-7 h-7 rounded-lg bg-indigo-500 hover:bg-indigo-600 border-2 border-white dark:border-gray-800 flex items-center justify-center transition-all active:scale-95 shadow-lg z-50 ${isMoving ? 'animate-pulse bg-indigo-600 ring-2 ring-indigo-400 ring-offset-2' : ''}`}
        title={lang === 'ru' ? 'Переместить задачу' : 'Move task'}
      >
        <Move size={14} className="text-white" strokeWidth={2.5} />
      </button>

      {/* Moving indicator */}
      {isMoving && (
        <div className="absolute top-0 left-0 right-0 h-6 flex items-center justify-center bg-indigo-500/20 border-b border-indigo-500/30 z-40">
          <span className="text-[8px] font-bold text-indigo-400 uppercase animate-pulse">
            {lang === 'ru' ? 'Выберите время' : 'Select time'}
          </span>
        </div>
      )}

      {/* Header */}
      <div 
        className={`flex items-center justify-between px-2 border-b border-black/5 dark:border-white/10 bg-black/5 dark:bg-white/5 ${isMoving ? 'pt-8' : 'h-6'}`}
      >
      </div>

      {/* Content */}
      <div className={`p-2 flex flex-col relative ${isMoving ? 'h-[calc(100%-32px)]' : 'h-[calc(100%-16px)]'}`}>
        <div className="flex items-start gap-2">
            <button 
                onClick={(e) => {
                    e.stopPropagation();
                    onToggleStatus(task.id);
                }}
                className="mt-0.5 hover:scale-110 transition-transform opacity-80 hover:opacity-100 text-[var(--text-primary)]"
            >
                {isDone ? <CheckCircle2 size={16} /> : <Circle size={16} />}
            </button>
            <span className={`text-[12px] font-bold leading-tight line-clamp-3 text-[var(--text-primary)] ${isDone ? 'line-through opacity-70' : ''}`}>
                {task.title}
            </span>
        </div>
        
        {/* Info Footer (only visible if tall enough) */}
        {height > 70 && (
            <div className="mt-auto pt-1 flex items-center justify-between text-[10px] opacity-70 text-[var(--text-primary)] font-medium">
                 <div className="flex items-center gap-1">
                    <Clock size={10} />
                    <span>{task.durationMinutes}m</span>
                 </div>
            </div>
        )}
      </div>

      {/* Resize Handle – slightly taller for easier touch dragging */}
      <div 
        className="absolute bottom-0 left-0 w-full h-5 cursor-ns-resize hover:bg-black/5 dark:hover:bg-white/10 transition-colors z-20 flex items-end justify-center pb-0.5"
        onPointerDown={(e) => onPointerDown(e, task, 'RESIZE')}
      >
        <div className="w-8 h-1 rounded-full bg-black/20 dark:bg-white/20" />
      </div>
    </div>
  );
};

