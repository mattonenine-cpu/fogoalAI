import type { UserProfile, Task, Goal, Language } from '../types';
import { getLocalISODate } from './geminiService';

/**
 * Builds a short daily summary: goals + today's tasks (and nearest deadlines).
 */
export function buildDailySummary(
  profile: UserProfile,
  tasks: Task[],
  lang: Language
): string {
  const today = getLocalISODate();
  const ru = lang === 'ru';

  const lines: string[] = [];
  lines.push(ru ? '📋 Цели и задачи на день' : '📋 Goals & tasks for today');
  lines.push('');

  const activeGoals = (profile.goals || []).filter((g: Goal) => !g.completed);
  if (activeGoals.length > 0) {
    lines.push(ru ? '🎯 Цели:' : '🎯 Goals:');
    activeGoals.slice(0, 5).forEach((g) => {
      const pct = Math.min(100, Math.round((g.progress / (g.target || 100)) * 100));
      lines.push(`• ${g.title} — ${g.progress}/${g.target} ${g.unit} (${pct}%)`);
    });
    lines.push('');
  }

  const todayTasks = tasks.filter((t) => t.date === today && !t.completed);
  const upcomingTasks = tasks.filter((t) => t.date && t.date >= today && !t.completed && t.date !== today);
  upcomingTasks.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  if (todayTasks.length > 0) {
    lines.push(ru ? '📌 На сегодня:' : '📌 Today:');
    todayTasks.slice(0, 10).forEach((t) => {
      const time = t.scheduledTime ? ` ${t.scheduledTime}` : '';
      lines.push(`• ${t.title}${time}`);
    });
    lines.push('');
  }

  if (upcomingTasks.length > 0) {
    lines.push(ru ? '⏰ Ближайшие дедлайны:' : '⏰ Upcoming:');
    upcomingTasks.slice(0, 5).forEach((t) => {
      const when = t.date ? ` (${t.date})` : '';
      lines.push(`• ${t.title}${when}`);
    });
  }

  return lines.join('\n').trim() || (ru ? 'Нет целей и задач на сегодня.' : 'No goals or tasks for today.');
}

/**
 * Sends text to the user in Telegram via our API.
 * Returns { ok: true } or { ok: false, error: string }.
 */
export async function sendToTelegram(
  telegramId: number,
  text: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('/api/send-telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegramId, text }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error || res.statusText };
    return data.ok ? { ok: true } : { ok: false, error: data.error || 'Unknown error' };
  } catch (e: any) {
    return { ok: false, error: e.message || 'Network error' };
  }
}
