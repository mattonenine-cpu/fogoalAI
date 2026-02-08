
import { Task, PreferredTime } from '../types';

// Date Utils Replacement for date-fns
export const addMinutes = (date: Date, amount: number): Date => {
    return new Date(date.getTime() + amount * 60000);
};

export const setHours = (date: Date, hours: number): Date => {
    const d = new Date(date);
    d.setHours(hours);
    return d;
};

export const setMinutes = (date: Date, minutes: number): Date => {
    const d = new Date(date);
    d.setMinutes(minutes);
    return d;
};

export const addDays = (date: Date, amount: number): Date => {
    const d = new Date(date);
    d.setDate(d.getDate() + amount);
    return d;
};

export const subDays = (date: Date, amount: number): Date => {
    return addDays(date, -amount);
};

export const parseISO = (isoString: string): Date => {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) {
        // Simple fallback YYYY-MM-DD or YYYY-MM-DDTHH:mm
        const [datePart, timePart] = isoString.split('T');
        if (!datePart) return new Date();
        const [y, m, day] = datePart.split('-').map(Number);
        const result = new Date(y, m - 1, day);
        if (timePart) {
            const [h, min] = timePart.split(':').map(Number);
            result.setHours(h || 0, min || 0);
        }
        return result;
    }
    return d;
};

export const isSameDay = (d1: Date, d2: Date): boolean => {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
};

export const startOfWeek = (date: Date, options: { weekStartsOn: number } = { weekStartsOn: 0 }): Date => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = (day < options.weekStartsOn ? 7 : 0) + day - options.weekStartsOn;
    d.setDate(d.getDate() - diff);
    d.setHours(0, 0, 0, 0);
    return d;
};

export const areIntervalsOverlapping = (i1: {start: Date, end: Date}, i2: {start: Date, end: Date}): boolean => {
    return i1.start < i2.end && i2.start < i1.end;
};

export const format = (date: Date, pattern: string): string => {
  const d = new Date(date);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  const dd = String(d.getDate()).padStart(2, '0');
  const dNum = d.getDate();
  const yyyy = d.getFullYear();
  const MM = String(d.getMonth() + 1).padStart(2, '0');
  const HH = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const dayName = days[d.getDay()];
  const monthName = months[d.getMonth()];

  if (pattern === 'yyyy-MM-dd') return `${yyyy}-${MM}-${dd}`;
  if (pattern === 'HH:mm') return `${HH}:${mm}`;
  if (pattern === 'd MMM') return `${dNum} ${monthName}`;
  if (pattern === 'd') return String(dNum);
  if (pattern === 'EEE') return dayName;
  
  return d.toDateString();
};

export const HOURS_START = 8; // 08:00
export const HOURS_END = 23; // 23:00
export const TOTAL_HOURS = HOURS_END - HOURS_START;
export const PIXELS_PER_HOUR = 80;

// Internal representation for the algorithm
interface PlannerTask extends Task {
    startDateTime: Date | null;
}

const hasOverlap = (proposedStart: Date, duration: number, scheduledTasks: PlannerTask[]): boolean => {
  const proposedEnd = addMinutes(proposedStart, duration);

  return scheduledTasks.some((task) => {
    if (!task.startDateTime) return false;
    const taskEnd = addMinutes(task.startDateTime, task.durationMinutes);
    return areIntervalsOverlapping(
      { start: proposedStart, end: proposedEnd },
      { start: task.startDateTime, end: taskEnd }
    );
  });
};

const getHourRangeForPreference = (pref: PreferredTime | undefined): { start: number; end: number } => {
  switch (pref) {
    case 'MORNING': return { start: 8, end: 12 };
    case 'AFTERNOON': return { start: 12, end: 17 };
    case 'EVENING': return { start: 17, end: 22 };
    default: return { start: 9, end: 18 };
  }
};

export const autoPlanTasks = (
  tasks: Task[], 
  currentDate: Date
): Task[] => {
  // 1. Convert to internal format with Dates
  const allTasks: PlannerTask[] = tasks.map(t => {
      let startDateTime: Date | null = null;
      if (t.date && t.scheduledTime) {
          try {
              const [h, m] = t.scheduledTime.split(':').map(Number);
              const d = parseISO(t.date);
              startDateTime = setMinutes(setHours(d, h), m);
          } catch (e) { console.error("Date parse error", e); }
      }
      return { ...t, startDateTime };
  });

  // 2. Separate locked vs backlog
  const scheduledTasks = allTasks.filter(t => t.startDateTime !== null);
  const backlogTasks = allTasks.filter(t => t.startDateTime === null && !t.completed);

  // 3. Sort backlog: High Priority > Longer Duration
  const priorityWeight = { 'High': 3, 'Medium': 2, 'Low': 1 };
  backlogTasks.sort((a, b) => {
    const pDiff = priorityWeight[b.priority] - priorityWeight[a.priority];
    if (pDiff !== 0) return pDiff;
    return b.durationMinutes - a.durationMinutes;
  });

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const newScheduledTasks = [...scheduledTasks];

  // 4. Place tasks
  for (const task of backlogTasks) {
    let placed = false;
    const prefRange = getHourRangeForPreference(task.preferredTime);

    // Try each day (0-6)
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      if (placed) break;

      const currentDay = addDays(weekStart, dayOffset);
      
      // Try preferred range first
      for (let hour = prefRange.start; hour < prefRange.end; hour++) {
        const proposedStart = setMinutes(setHours(currentDay, hour), 0);
        const proposedEndHour = hour + (task.durationMinutes / 60);
        
        if (proposedEndHour > HOURS_END) continue;

        if (!hasOverlap(proposedStart, task.durationMinutes, newScheduledTasks)) {
            task.startDateTime = proposedStart;
            newScheduledTasks.push(task);
            placed = true;
            break;
        }
      }

      // If no slot in preferred, try whole day
      if (!placed) {
         for (let hour = HOURS_START; hour < HOURS_END; hour++) {
            if (hour >= prefRange.start && hour < prefRange.end) continue; // Skip already checked

            const proposedStart = setMinutes(setHours(currentDay, hour), 0);
            const proposedEndHour = hour + (task.durationMinutes / 60);
            
            if (proposedEndHour > HOURS_END) continue;

            if (!hasOverlap(proposedStart, task.durationMinutes, newScheduledTasks)) {
                task.startDateTime = proposedStart;
                newScheduledTasks.push(task);
                placed = true;
                break;
            }
         }
      }
    }
  }

  // 5. Convert back to Task format
  const finalTasks: Task[] = [...newScheduledTasks, ...backlogTasks.filter(t => t.startDateTime === null)].map(t => {
      if (t.startDateTime) {
          const dateStr = format(t.startDateTime, 'yyyy-MM-dd');
          const timeStr = format(t.startDateTime, 'HH:mm');
          const { startDateTime, ...rest } = t;
          return { ...rest, date: dateStr, scheduledTime: timeStr };
      }
      const { startDateTime, ...rest } = t;
      return { ...rest, date: undefined, scheduledTime: undefined };
  });

  // Re-merge with tasks that were completed or not involved in this logic
  const touchedIds = new Set(finalTasks.map(t => t.id));
  const untouchableTasks = tasks.filter(t => !touchedIds.has(t.id));

  return [...finalTasks, ...untouchableTasks];
};
