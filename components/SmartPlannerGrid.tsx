
import React, { useRef, useState, useEffect } from 'react';
import { Task } from '../types';
import { HOURS_START, HOURS_END, PIXELS_PER_HOUR, TOTAL_HOURS, format, addDays, setHours, setMinutes, isSameDay, parseISO } from '../services/smartPlanner';
import { SmartBlock } from './SmartPlannerBlock';

interface WeekGridProps {
  currentDate: Date;
  tasks: Task[];
  onTaskUpdate: (updatedTask: Task) => void;
  onTaskClick: (task: Task) => void;
  onAddClick?: (date: Date) => void;
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

  // Dragging State
  const [dragState, setDragState] = useState<{
    task: Task;
    type: 'DRAG' | 'RESIZE';
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

      const { task, type, currentX, currentY } = dragState;
      const rect = containerRef.current.getBoundingClientRect();
      
      const relX = currentX - rect.left;
      const relY = currentY - rect.top;

      const timeColWidth = 50;
      const scrollLeft = containerRef.current.scrollLeft;
      const scrollTop = containerRef.current.scrollTop;
      const correctedX = relX + scrollLeft;
      
      const contentWidth = containerRef.current.scrollWidth;
      // Adjusted for 3 days
      const dayColWidth = (contentWidth - timeColWidth) / 3;

      if (type === 'DRAG') {
          let dayIndex = Math.floor((correctedX - timeColWidth) / dayColWidth);
          dayIndex = Math.max(0, Math.min(2, dayIndex)); // Max index 2 for 3 days

          const absoluteY = relY + scrollTop;
          const hoursFromStart = absoluteY / PIXELS_PER_HOUR;
          const minutesFromStart = hoursFromStart * 60;
          const snappedMinutes = Math.round(minutesFromStart / 15) * 15;
          
          let newDate = addDays(currentDate, dayIndex);
          newDate = setHours(newDate, HOURS_START);
          newDate = setMinutes(newDate, 0);
          newDate = setMinutes(newDate, snappedMinutes);

          if (newDate.getHours() < HOURS_START) newDate.setHours(HOURS_START, 0);
          
          const dateStr = format(newDate, 'yyyy-MM-dd');
          const timeStr = format(newDate, 'HH:mm');

          onTaskUpdate({
              ...task,
              date: dateStr,
              scheduledTime: timeStr
          });
      } else if (type === 'RESIZE') {
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
  }, [dragState, onTaskUpdate, currentDate]);


  const handlePointerDown = (e: React.PointerEvent, task: Task, type: 'DRAG' | 'RESIZE') => {
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
                        className="flex-1 relative border-r border-[var(--border-glass)]/50 last:border-r-0 hover:bg-white/[0.02] transition-colors cursor-pointer z-10"
                    >
                        {/* Render Tasks */}
                        {getDayTasks(day).map(task => {
                            const [h, m] = (task.scheduledTime || "09:00").split(':').map(Number);
                            const startMin = (h - HOURS_START) * 60 + m;
                            const top = (startMin / 60) * PIXELS_PER_HOUR;
                            
                            const isDragging = dragState?.task.id === task.id;
                            
                            const style: React.CSSProperties = {
                               top: `${top}px`,
                            };

                            if (isDragging && dragState.type === 'DRAG') {
                               const deltaX = dragState.currentX - dragState.startX;
                               const deltaY = dragState.currentY - dragState.startY;
                               style.transform = `translate(${deltaX}px, ${deltaY}px)`;
                               style.zIndex = 50;
                               style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.5)';
                               style.opacity = 0.9;
                            } else if (isDragging && dragState.type === 'RESIZE') {
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
                                />
                            );
                        })}
                    </div>
                ))}
            </div>
        </div>
      </div>
    </div>
  );
};
