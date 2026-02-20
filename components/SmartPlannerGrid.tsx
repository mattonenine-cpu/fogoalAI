
import React, { useRef, useState, useEffect } from 'react';
import { Task, Language } from '../types';
import { HOURS_START, HOURS_END, PIXELS_PER_HOUR, TOTAL_HOURS, format, addDays, setHours, setMinutes, isSameDay, parseISO } from '../services/smartPlanner';
import { SmartBlock } from './SmartPlannerBlock';

interface WeekGridProps {
  currentDate: Date;
  tasks: Task[];
  onTaskUpdate: (updatedTask: Task) => void;
  onTaskClick: (task: Task) => void;
  onAddClick?: (date: Date) => void;
  lang: Language;
}

export const SmartPlannerGrid: React.FC<WeekGridProps> = ({ 
  currentDate,  
  tasks, 
  onTaskUpdate,
  onTaskClick,
  onAddClick
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  // Generate 3 days starting from currentDate
  const daysToShow = Array.from({ length: 3 }, (_, i) => addDays(currentDate, i));
  const hours = Array.from({ length: TOTAL_HOURS }, (_, i) => HOURS_START + i);

  // Moving task state - for click-based movement
  const [movingTask, setMovingTask] = useState<Task | null>(null);
  const [selectedCell, setSelectedCell] = useState<{ day: Date; hour: number; minute: number } | null>(null);

  // Dragging State (for resize only now)
  const [dragState, setDragState] = useState<{
    task: Task;
    type: 'RESIZE';
    startX: number;
    startY: number;
    initialStartTime: Date;
    initialDuration: number;
    currentY: number; 
    currentX: number;
  } | null>(null);

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (!dragState || !containerRef.current) return;
      e.preventDefault(); 
      setDragState(prev => prev ? { ...prev, currentX: e.clientX, currentY: e.clientY } : null);
    };

    const handlePointerUp = () => {
      if (!dragState || !containerRef.current) return;

      const { task, type, currentY } = dragState;

      if (type === 'RESIZE') {
         const deltaY = currentY - dragState.startY;
         const deltaMinutes = (deltaY / PIXELS_PER_HOUR) * 60;
         
         const newDurationRaw = dragState.initialDuration + deltaMinutes;
         const snappedDuration = Math.max(15, Math.round(newDurationRaw / 15) * 15);

         onTaskUpdate({
             ...task,
             durationMinutes: snappedDuration
         });
      }

      setDragState(null);
    };

    if (dragState) {
      window.addEventListener('pointermove', handlePointerMove, { passive: false });
      window.addEventListener('pointerup', handlePointerUp);
      window.addEventListener('pointercancel', handlePointerUp);
    }

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [dragState, onTaskUpdate]);


  const handleStartMove = (task: Task) => {
    setMovingTask(task);
    setSelectedCell(null);
  };

  const handleCancelMove = () => {
    setMovingTask(null);
    setSelectedCell(null);
  };

  const handleConfirmMove = () => {
    if (!movingTask || !selectedCell) return;
    
    const newDate = new Date(selectedCell.day);
    newDate.setHours(selectedCell.hour, selectedCell.minute, 0, 0);
    
    const dateStr = format(newDate, 'yyyy-MM-dd');
    const timeStr = format(newDate, 'HH:mm');

    onTaskUpdate({
      ...movingTask,
      date: dateStr,
      scheduledTime: timeStr
    });

    setMovingTask(null);
    setSelectedCell(null);
  };

  const handlePointerDown = (e: React.PointerEvent, task: Task, type: 'RESIZE') => {
    e.currentTarget.setPointerCapture(e.pointerId);
    if (!task.date || !task.scheduledTime) return;

    const d = parseISO(task.date);
    const [h, m] = task.scheduledTime.split(':').map(Number);
    const startDate = setMinutes(setHours(d, h), m);

    setDragState({
        task,
        type,
        startX: e.clientX,
        startY: e.clientY,
        initialStartTime: startDate,
        initialDuration: task.durationMinutes,
        currentX: e.clientX,
        currentY: e.clientY
    });
  };

  const handleEmptyClick = (e: React.MouseEvent, day: Date) => {
      // If we're in move mode, select the cell instead of adding
      if (movingTask) {
        const rect = e.currentTarget.getBoundingClientRect();
        const clickY = e.clientY - rect.top;
        
        const hoursClicked = clickY / PIXELS_PER_HOUR;
        const hour = HOURS_START + Math.floor(hoursClicked);
        const minute = Math.round((hoursClicked % 1) * 60 / 15) * 15; // Snap to 15-minute intervals
        
        setSelectedCell({ day, hour, minute });
        return;
      }

      if (!onAddClick) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const clickY = e.clientY - rect.top;
      
      const hoursClicked = clickY / PIXELS_PER_HOUR;
      const hour = HOURS_START + Math.floor(hoursClicked);
      const minute = 0; // Snap strictly to the hour (XX:00) to fill the grid slot perfectly
      
      const clickedDate = new Date(day);
      clickedDate.setHours(hour, minute, 0, 0);
      
      onAddClick(clickedDate);
  };

  const getDayTasks = (day: Date) => {
    return tasks.filter(t => {
        if (!t.date || !t.scheduledTime) return false;
        const taskDate = parseISO(t.date);
        return isSameDay(taskDate, day);
    });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden relative">
      {/* Fixed Header Row */}
      <div className="flex border-b border-[var(--border-glass)] bg-transparent overflow-hidden z-20"> 
        <div className="w-[50px] shrink-0 border-r border-[var(--border-glass)]"></div>
        <div className="flex-1 flex overflow-hidden">
             {/* Header matches grid width structure */}
             <div className="flex w-full min-w-full">
                {daysToShow.map((day, i) => (
                    <div key={i} className="flex-1 py-3 text-center border-r border-[var(--border-glass)] last:border-r-0">
                        <div className="text-[10px] uppercase text-[var(--text-secondary)] mb-1 font-black tracking-widest">{format(day, 'EEE')}</div>
                        <div className={`text-xl font-black ${isSameDay(day, new Date()) ? 'text-[var(--theme-accent)]' : 'text-[var(--text-primary)]'}`}>
                        {format(day, 'd')}
                        </div>
                    </div>
                ))}
             </div>
        </div>
      </div>

      {/* Scrollable Grid Body */}
      <div ref={containerRef} className="flex-1 overflow-auto relative scrollbar-hide touch-pan-x touch-pan-y overscroll-none pb-20">
        <div className="flex relative min-w-full" style={{ height: `${TOTAL_HOURS * PIXELS_PER_HOUR}px` }}>
            
            {/* Sticky Time Labels */}
            <div className="sticky left-0 z-30 w-[50px] shrink-0 border-r border-[var(--border-glass)] bg-[var(--bg-main)] text-[10px] text-[var(--text-secondary)] text-right pr-2 pt-2 select-none font-bold uppercase tracking-widest">
                {hours.map(h => (
                    <div key={h} style={{ height: `${PIXELS_PER_HOUR}px` }}>
                        {h}:00
                    </div>
                ))}
            </div>

            {/* Container for Days & Grid Lines */}
            <div className="flex-1 flex relative">
                
                {/* Global Horizontal Lines - Rendered once for straightness */}
                <div className="absolute inset-0 pointer-events-none z-0">
                    {hours.map((h, i) => (
                        <div 
                            key={i} 
                            className="absolute w-full border-t border-[var(--border-glass)]/30"
                            style={{ top: `${i * PIXELS_PER_HOUR}px` }}
                        />
                    ))}
                </div>

                {/* Grid Columns */}
                {daysToShow.map((day, dayIdx) => (
                    <div 
                        key={dayIdx} 
                        onClick={(e) => handleEmptyClick(e, day)}
                        className={`flex-1 relative border-r border-[var(--border-glass)]/50 last:border-r-0 transition-colors z-10 ${
                            movingTask ? 'cursor-pointer' : 'hover:bg-white/[0.02] cursor-pointer'
                        }`}
                    >
                        {/* Highlight selected cell when moving */}
                        {movingTask && selectedCell && isSameDay(selectedCell.day, day) && (
                            <div
                                className="absolute left-0 right-0 border-2 border-indigo-500 bg-indigo-500/10 z-40 pointer-events-none"
                                style={{
                                    top: `${((selectedCell.hour - HOURS_START) * 60 + selectedCell.minute) / 60 * PIXELS_PER_HOUR}px`,
                                    height: `${PIXELS_PER_HOUR}px`
                                }}
                            />
                        )}

                        {/* Render Tasks */}
                        {getDayTasks(day).map(task => {
                            const [h, m] = (task.scheduledTime || "09:00").split(':').map(Number);
                            const startMin = (h - HOURS_START) * 60 + m;
                            const top = (startMin / 60) * PIXELS_PER_HOUR;
                            
                            const isResizing = dragState?.task.id === task.id;
                            
                            const style: React.CSSProperties = {
                               top: `${top}px`,
                            };

                            if (isResizing && dragState.type === 'RESIZE') {
                                 const deltaY = dragState.currentY - dragState.startY;
                                 const heightChange = deltaY;
                                 const originalHeight = (task.durationMinutes / 60) * PIXELS_PER_HOUR;
                                 const newHeight = Math.max(20, originalHeight + heightChange);
                                 style.height = `${newHeight}px`;
                                 style.zIndex = 50;
                            }

                            return (
                                <SmartBlock 
                                    key={task.id} 
                                    task={task} 
                                    style={style}
                                    onPointerDown={handlePointerDown}
                                    onToggleStatus={(id) => onTaskUpdate({...task, completed: !task.completed})}
                                    onClick={onTaskClick}
                                    onStartMove={handleStartMove}
                                    isMoving={movingTask?.id === task.id}
                                    lang={lang}
                                />
                            );
                        })}
                    </div>
                ))}
            </div>
        </div>
      </div>

      {/* Move confirmation modal */}
      {movingTask && selectedCell && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-sm bg-[var(--bg-main)] border border-[var(--border-glass)] rounded-[40px] p-6 shadow-2xl space-y-6">
            <div className="flex justify-between items-center mb-2">
              <div>
                <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-widest">
                  {lang === 'ru' ? 'Переместить задачу' : 'Move Task'}
                </h3>
                <p className="text-xs text-[var(--text-secondary)] mt-1 truncate">{movingTask.title}</p>
              </div>
              <button 
                onClick={handleCancelMove} 
                className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                ×
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                <p className="text-xs text-[var(--text-secondary)] mb-2">
                  {lang === 'ru' ? 'Новое время:' : 'New time:'}
                </p>
                <p className="text-lg font-bold text-[var(--text-primary)]">
                  {format(selectedCell.day, 'EEE, d MMM')} {String(selectedCell.hour).padStart(2, '0')}:{String(selectedCell.minute).padStart(2, '0')}
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={handleCancelMove} 
                className="flex-1 h-14 bg-white/5 border border-[var(--border-glass)] text-[var(--text-primary)] rounded-full font-black uppercase text-[11px] active:scale-95 transition-all"
              >
                {lang === 'ru' ? 'Отмена' : 'Cancel'}
              </button>
              <button 
                onClick={handleConfirmMove} 
                className="flex-1 h-14 bg-[var(--bg-active)] text-[var(--bg-active-text)] rounded-full font-black uppercase text-[11px] shadow-lg active:scale-95 transition-all"
              >
                {lang === 'ru' ? 'Переместить' : 'Move'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
