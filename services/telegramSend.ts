import type { UserProfile, Task, Goal, Language, TelegramReminderSettings } from '../types';
import { getLocalISODate } from './geminiService';

/** Полезные варианты «за сколько минут до задачи» для напоминаний */
export const REMINDER_LEAD_OPTIONS = [
  { value: 5, labelRu: '5 мин', labelEn: '5 min' },
  { value: 15, labelRu: '15 мин', labelEn: '15 min' },
  { value: 30, labelRu: '30 мин', labelEn: '30 min' },
  { value: 60, labelRu: '1 ч', labelEn: '1 h' },
  { value: 120, labelRu: '2 ч', labelEn: '2 h' },
] as const;

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
    const raw = await res.text();
    let data: { ok?: boolean; error?: string } = {};
    if (raw.trim()) {
      try {
        data = JSON.parse(raw);
      } catch {
        data = { error: res.status === 404 ? 'API not found. Deploy with TELEGRAM_BOT_TOKEN on Vercel.' : raw.slice(0, 100) };
      }
    } else {
      data = { error: res.statusText || `HTTP ${res.status}. Check Vercel env TELEGRAM_BOT_TOKEN and redeploy.` };
    }
    if (!res.ok) return { ok: false, error: data.error || res.statusText };
    return data.ok ? { ok: true } : { ok: false, error: data.error || 'Unknown error' };
  } catch (e: any) {
    return { ok: false, error: e.message || 'Network error' };
  }
}

/**
 * Синхронизирует настройки напоминаний и текущие задачи/цели с сервером для крон-напоминаний.
 * Вызывается после сохранения настроек и при отправке в Telegram.
 */
export async function syncReminderSettingsToServer(
  telegramId: number,
  settings: TelegramReminderSettings,
  tasks: Task[],
  profile: UserProfile,
  lang: Language
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('/api/telegram-reminders-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        telegramId,
        reminderFrequency: settings.frequency,
        reminderLeadMinutes: settings.leadMinutes,
        tasks: tasks.map((t) => ({
          id: t.id,
          title: t.title,
          date: t.date,
          scheduledTime: t.scheduledTime,
          completed: t.completed,
        })),
        goals: (profile.goals || []).map((g) => ({
          id: g.id,
          title: g.title,
          progress: g.progress,
          target: g.target,
          completed: g.completed,
        })),
        lang,
        timezoneOffset: -new Date().getTimezoneOffset(),
      }),
    });
    const raw = await res.text();
    let data: { ok?: boolean; error?: string } = {};
    if (raw.trim()) {
      try {
        data = JSON.parse(raw);
      } catch {
        data = { error: raw.slice(0, 200) };
      }
    }
    if (!res.ok) return { ok: false, error: data.error || res.statusText };
    return data.ok ? { ok: true } : { ok: false, error: data.error };
  } catch (e: any) {
    return { ok: false, error: e.message || 'Network error' };
  }
}

/**
 * Формирует текст напоминания о ближайших задачах (для per_task).
 */
export function buildTaskReminderText(
  tasks: { title: string; scheduledTime?: string; date?: string }[],
  lang: Language
): string {
  const ru = lang === 'ru';
  const lines = ru ? ['⏰ Напоминание о задачах:', ''] : ['⏰ Task reminders:', ''];
  tasks.slice(0, 10).forEach((t) => {
    const time = t.scheduledTime ? ` ${t.scheduledTime}` : '';
    const date = t.date ? ` (${t.date})` : '';
    lines.push(`• ${t.title}${time}${date}`);
  });
  return lines.join('\n');
}

