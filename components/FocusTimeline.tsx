import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Task, Language } from '../types';

interface FocusTimelineProps {
  tasks: Task[];
  selectedDateISO: string;
  lang: Language;
  onTaskClick: (task: Task) => void;
  onAddTaskAtTime: (time: string) => void;
}

const DAY_START = 6;  // 06:00
const DAY_END = 22;   // 22:00
const MIN_CONTENT_HEIGHT = 640; // px, чуть выше для более «полного» дня
const MIN_NODE_SPACING = 40; // px between nodes
const TIME_MARKERS = [6, 9, 12, 15, 18, 21];

interface PositionedTask {
  task: Task;
  top: number;
}

const normalizeText = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ');

const suggestEmojiFromTitle = (title: string): string => {
  const t = normalizeText(title);

  if (!t.trim()) return '⏺';

  if (/(wake|alarm|rise|подъём|подъем|проснись|будильник)/.test(t)) return '⏰';
  if (/(sleep|bed|night|сон|спать|отбой)/.test(t)) return '🌙';
  if (/(study|learn|read|учеб|учить|читать|книга|lesson|лекция)/.test(t)) return '📚';
  if (/(workout|gym|run|jog|йога|тренир|спорт|кардио|пробежка)/.test(t)) return '💪';
  if (/(work|deep work|focus|code|coding|project|работа|код|продакт|дизайн)/.test(t)) return '💻';
  if (/(meeting|call|zoom|teams|митинг|созвон|встреча)/.test(t)) return '📅';
  if (/(email|почта|inbox)/.test(t)) return '📨';
  if (/(breakfast|lunch|dinner|обед|ужин|завтрак|coffee|кофе|чай)/.test(t)) return '☕';
  if (/(walk|прогулка|outside|street|парк)/.test(t)) return '🚶';
  if (/(meditat|медит)/.test(t)) return '🧘';

  return '⏺';
};

const getTaskEmoji = (task: Task): string => {
  if (task.emoji && task.emoji.trim()) return task.emoji;
  return suggestEmojiFromTitle(task.title || '');
};

export const FocusTimeline: React.FC<FocusTimelineProps> = ({
  tasks,
  selectedDateISO,
  lang,
  onTaskClick,
  onAddTaskAtTime
}) => {
  const [lineAnimated, setLineAnimated] = useState(false);
  const [mountedAt] = useState(() => Date.now());
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [scrollCenter, setScrollCenter] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setLineAnimated(true), 30);
    return () => clearTimeout(t);
  }, [selectedDateISO]);

  const dayTasks = useMemo(
    () =>
      tasks
        .filter(t => t.date === selectedDateISO && t.scheduledTime)
        .sort((a, b) => (a.scheduledTime || '').localeCompare(b.scheduledTime || '')),
    [tasks, selectedDateISO]
  );

  const contentHeight = MIN_CONTENT_HEIGHT;

  const positioned: PositionedTask[] = useMemo(() => {
    if (!dayTasks.length) return [];

    const timesMinutes = dayTasks.map(task => {
      const [hStr, mStr] = (task.scheduledTime || '12:00').split(':');
      const h = Number(hStr);
      const m = Number(mStr);
      const clampedH = Math.min(Math.max(h, DAY_START), DAY_END);
      return (clampedH - DAY_START) * 60 + m;
    });

    const visualMinutes: number[] = [];
    let acc = 0;
    const MAX_GAP_MIN = 120; // визуально не больше 2х часов

    timesMinutes.forEach((realMin, index) => {
      if (index === 0) {
        const fromStart = Math.min(realMin, MAX_GAP_MIN);
        acc = fromStart;
        visualMinutes.push(acc);
      } else {
        const diff = Math.max(0, realMin - timesMinutes[index - 1]);
        const visualDiff = Math.min(diff, MAX_GAP_MIN);
        acc += visualDiff || 30; // гарантируем небольшой шаг даже при одинаковом времени
        visualMinutes.push(acc);
      }
    });

    const maxVisual = visualMinutes[visualMinutes.length - 1] || 1;

    const baseTop = 32;
    const usable = contentHeight - 96;

    const raw: PositionedTask[] = dayTasks.map((task, index) => {
      const ratio = maxVisual > 0 ? visualMinutes[index] / maxVisual : 0;
      const top = baseTop + ratio * usable;
      return { task, top };
    });

    const adjusted: PositionedTask[] = [];
    for (const item of raw) {
      if (!adjusted.length) {
        adjusted.push(item);
        continue;
      }
      const prev = adjusted[adjusted.length - 1];
      const minAllowed = prev.top + MIN_NODE_SPACING;
      adjusted.push({
        ...item,
        top: Math.max(item.top, minAllowed)
      });
    }
    return adjusted;
  }, [dayTasks, contentHeight]);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const handleScroll = () => {
      const rect = node.getBoundingClientRect();
      setScrollCenter(node.scrollTop + rect.height / 2);
    };
    handleScroll();
    node.addEventListener('scroll', handleScroll, { passive: true });
    return () => node.removeEventListener('scroll', handleScroll);
  }, []);

  const handleBackgroundTap = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const usable = contentHeight - 96;
    const ratio = Math.min(Math.max((y - 32) / usable, 0), 1);
    const totalMinutes = (DAY_END - DAY_START) * 60;
    const minutesFromStart = Math.round(totalMinutes * ratio / 15) * 15;
    const total = (DAY_START * 60) + minutesFromStart;
    const h = Math.min(Math.max(Math.floor(total / 60), DAY_START), DAY_END);
    const m = Math.max(0, Math.min(59, total % 60));
    const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    onAddTaskAtTime(time);
  };

  const now = new Date();
  const nowISO = now.toISOString().split('T')[0];
  const showCurrentTime = nowISO === selectedDateISO;
  const currentTimeTop = useMemo(() => {
    if (!showCurrentTime) return null;
    const minutesToday = now.getHours() * 60 + now.getMinutes();
    const dayStartMinutes = DAY_START * 60;
    const dayEndMinutes = DAY_END * 60;
    const clamped = Math.min(Math.max(minutesToday, dayStartMinutes), dayEndMinutes);
    const span = dayEndMinutes - dayStartMinutes;
    const ratio = span > 0 ? (clamped - dayStartMinutes) / span : 0.5;
    return 32 + ratio * (contentHeight - 96);
  }, [showCurrentTime, contentHeight, now]);

  useEffect(() => {
    if (!showCurrentTime || currentTimeTop == null) return;
    const node = scrollRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const target = Math.max(0, currentTimeTop - rect.height / 2);
    node.scrollTo({ top: target, behavior: 'smooth' });
  }, [showCurrentTime, currentTimeTop, selectedDateISO]);

  return (
    <div className="mt-4">
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--text-secondary)]">
            {lang === 'ru' ? 'Лента дня' : 'Timeline'}
          </span>
          <span className="text-sm font-medium text-[var(--text-secondary)] mt-1">
            {dayTasks.length
              ? (lang === 'ru' ? `${dayTasks.length} задач` : `${dayTasks.length} tasks`)
              : (lang === 'ru' ? 'Нажми по ленте, чтобы добавить задачу' : 'Tap the line to add a task')}
          </span>
        </div>
        {showCurrentTime && (
          <span className="text-[10px] font-bold uppercase tracking-[0.32em] text-[var(--text-secondary)]">
            {now.toLocaleTimeString(lang === 'ru' ? 'ru-RU' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      <div
        ref={scrollRef}
        className="relative h-[460px] overflow-y-auto scrollbar-hide px-4 pb-6"
        onClick={handleBackgroundTap}
      >
        <div
          className="relative mx-auto flex"
          style={{ height: contentHeight, width: '100%', maxWidth: 400 }}
        >
          {/* Левая колонка — метки времени */}
          <div className="w-12 pr-2 pt-6 text-right text-[10px] font-medium text-[var(--text-secondary)] select-none">
            {TIME_MARKERS.map((hour) => {
              const minutesFromStart = (hour - DAY_START) * 60;
              const totalMinutes = (DAY_END - DAY_START) * 60;
              const ratio = Math.min(Math.max(minutesFromStart / totalMinutes, 0), 1);
              const top = 32 + ratio * (contentHeight - 96);
              return (
                <div
                  key={hour}
                  className="absolute right-3"
                  style={{ top }}
                >
                  {`${String(hour).padStart(2, '0')}:00`}
                </div>
              );
            })}
          </div>

          {/* Центральная колонка — линия дня и узлы */}
          <div className="relative flex-1 pl-6">
            {/* Базовая линия дня */}
            <div className="absolute left-[72px] top-8 bottom-8 w-[3px] bg-[#2A2A2A] overflow-hidden rounded-full pointer-events-none">
              <div
                className="w-full bg-[rgba(148,163,184,0.55)] origin-top"
                style={{
                  transform: `scaleY(${lineAnimated ? 1 : 0})`,
                  opacity: lineAnimated ? 1 : 0,
                  transition: 'transform 600ms ease-out, opacity 400ms ease-out'
                }}
              />
            </div>

            {/* Прогресс по текущему времени */}
            <div
              className="absolute left-[72px] top-8 bottom-8 w-[3px] rounded-full pointer-events-none"
              style={{
                background: showCurrentTime ? 'linear-gradient(to bottom, var(--theme-accent), rgba(148,163,184,0.5))' : 'transparent',
                clipPath:
                  showCurrentTime && currentTimeTop != null
                    ? `inset(0 0 ${Math.max(contentHeight - (currentTimeTop - 32), 0)}px 0)`
                    : undefined
              }}
            />

            {/* Индикатор текущего времени */}
            {showCurrentTime && currentTimeTop !== null && (
              <div
                className="absolute left-[72px] -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                style={{ top: currentTimeTop }}
              >
                <div className="relative">
                  <div className="w-2.5 h-2.5 rounded-full bg-[var(--theme-accent)] shadow-[0_0_18px_rgba(248,113,113,0.7)]" />
                  <div className="absolute left-1/2 top-1/2 -translate-y-1/2 -translate-x-1/2 w-[999px] border-t border-[var(--theme-accent)]/40 opacity-70" />
                </div>
              </div>
            )}

            {/* Узлы и карточки задач */}
            {positioned.map(({ task, top }, index) => {
              const createdAgo = Date.now() - mountedAt;
              const baseDelay = Math.min(createdAgo, 200);
              const isPast =
                task.completed ||
                (task.date === nowISO && (task.scheduledTime || '') < now.toTimeString().slice(0, 5));

              const nodeCenter = top;
              const distance = Math.abs(nodeCenter - scrollCenter);
              const norm = Math.min(distance / 240, 1);
              const scale = 1.03 - norm * 0.07; // 1.03 → ~0.96
              const opacity = 1 - norm * 0.12;

              return (
                <button
                  key={task.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onTaskClick(task);
                  }}
                  className="group absolute left-0 right-0 flex items-center"
                  style={{
                    top,
                    transform: `scale(${scale})`,
                    opacity,
                    transformOrigin: 'left center',
                    transition: 'transform 220ms ease-out, opacity 200ms ease-out'
                  }}
                >
                  {/* Карточка задачи */}
                  <div
                    className="ml-[90px] flex items-center gap-3 px-3 py-2.5 rounded-[14px] bg-[rgba(15,23,42,0.96)] border border-[var(--border-glass)] text-left min-w-[190px] max-w-[260px] shadow-[0_18px_40px_rgba(0,0,0,0.6)]"
                    style={{
                      transform: 'translateX(4px)',
                      opacity: 0,
                      animation: 'fg-node-in 260ms ease-out forwards',
                      animationDelay: `${baseDelay + index * 40}ms`
                    }}
                  >
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 shadow-[0_0_0_1px_rgba(255,255,255,0.08)] relative transition-transform duration-160 group-active:scale-110"
                      style={{
                        background: isPast
                          ? 'radial-gradient(circle at 30% 30%, rgba(252,165,165,0.9), rgba(248,113,113,0.32))'
                          : 'radial-gradient(circle at 30% 30%, rgba(248,250,252,0.95), rgba(248,250,252,0.14))',
                        boxShadow: isPast
                          ? '0 0 0 1px rgba(248,250,252,0.34)'
                          : '0 0 20px rgba(248,250,252,0.45)'
                      }}
                    >
                      <span className="text-[17px] leading-none">
                        {getTaskEmoji(task)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[13px] font-medium text-[var(--text-primary)] truncate">
                          {task.title || (lang === 'ru' ? 'Без названия' : 'Untitled')}
                        </p>
                        {task.scheduledTime && (
                          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
                            {task.scheduledTime}
                          </span>
                        )}
                      </div>
                      {task.description && (
                        <p className="mt-1 text-[11px] text-[var(--text-secondary)] line-clamp-2">
                          {task.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Сам таймлайн‑узел (кружок) поверх оси */}
                  <div
                    className="absolute left-[72px] -translate-x-1/2 -translate-y-1/2 w-11 h-11 rounded-full shadow-[0_0_22px_rgba(248,113,113,0.7)] flex items-center justify-center"
                    style={{
                      top,
                      background: isPast ? 'var(--theme-accent)' : 'rgba(30, 41, 59, 0.98)',
                      border: isPast ? '2px solid rgba(248,113,113,0.95)' : '2px solid rgba(148,163,184,0.7)'
                    }}
                  >
                    <div className="w-[26px] h-[26px] rounded-full bg-[var(--bg-main)]/40 flex items-center justify-center text-[15px]">
                      {getTaskEmoji(task)}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FocusTimeline;

