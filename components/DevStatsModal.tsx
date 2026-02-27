import React, { useState } from 'react';
import { UserProfile, UsageStats, Language, getDefaultUsageStats } from '../types';
import { GlassCard, GlassInput } from './GlassCard';
import { X, BarChart3, LayoutGrid, Zap, MessageCircle, Target, Calendar } from 'lucide-react';

const DEV_STATS_PROMO_CODE = 'FOGOAL_DEV_2025';
const SESSION_KEY = 'focu_dev_stats_unlocked';

interface DevStatsModalProps {
  user: UserProfile;
  lang: Language;
  onClose: () => void;
}

const formatDate = (iso?: string) => {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
};

const OPEN_LABELS: Record<string, { en: string; ru: string; emoji: string }> = {
  dashboard: { en: 'Dashboard', ru: 'Дашборд', emoji: '🏠' },
  scheduler: { en: 'Scheduler', ru: 'Планировщик', emoji: '📅' },
  smart_planner: { en: 'Smart Planner', ru: 'Смарт-планнер', emoji: '🧩' },
  chat: { en: 'Chat', ru: 'Чат', emoji: '💬' },
  notes: { en: 'Notes', ru: 'Заметки', emoji: '📝' },
  sport: { en: 'Sport', ru: 'Спорт', emoji: '💪' },
  study: { en: 'Study', ru: 'Учёба', emoji: '📚' },
  health: { en: 'Health', ru: 'Здоровье', emoji: '❤️' },
};

export const DevStatsModal: React.FC<DevStatsModalProps> = ({ user, lang, onClose }) => {
  const [unlocked, setUnlocked] = useState(() => {
    if (typeof sessionStorage === 'undefined') return false;
    return sessionStorage.getItem(SESSION_KEY) === '1';
  });
  const [codeInput, setCodeInput] = useState('');
  const [codeError, setCodeError] = useState('');

  const stats: UsageStats = user.usageStats || getDefaultUsageStats();
  const isRu = lang === 'ru';

  const handleUnlock = () => {
    const trimmed = codeInput.trim();
    if (trimmed !== DEV_STATS_PROMO_CODE) {
      setCodeError(isRu ? 'Неверный код' : 'Invalid code');
      return;
    }
    sessionStorage.setItem(SESSION_KEY, '1');
    setUnlocked(true);
    setCodeError('');
    setCodeInput('');
  };

  const handleClose = () => {
    onClose();
  };

  if (!unlocked) {
    return (
      <div className="fixed inset-0 z-[900] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-[var(--bg-main)] border border-[var(--border-glass)] rounded-[32px] shadow-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-black text-[var(--text-primary)] uppercase tracking-tight">
              {isRu ? 'Код доступа' : 'Access code'}
            </h2>
            <button onClick={handleClose} className="p-2 rounded-full hover:bg-white/10 text-[var(--text-secondary)]">
              <X size={20} />
            </button>
          </div>
          <p className="text-xs text-[var(--text-secondary)] mb-4">
            {isRu ? 'Введите промокод разработчика для просмотра статистики.' : 'Enter developer promo code to view statistics.'}
          </p>
          <GlassInput
            type="password"
            placeholder={isRu ? 'Промокод' : 'Promo code'}
            value={codeInput}
            onChange={(e) => { setCodeInput(e.target.value); setCodeError(''); }}
            onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
            className="mb-2"
          />
          {codeError ? <p className="text-xs text-rose-500 mb-2">{codeError}</p> : null}
          <button onClick={handleUnlock} className="w-full py-3 rounded-2xl bg-[var(--bg-active)] text-[var(--bg-active-text)] font-black text-xs uppercase tracking-widest">
            {isRu ? 'Открыть' : 'Open'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[900] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4">
      <div className="w-full max-w-lg max-h-[90vh] bg-[var(--bg-main)] border border-[var(--border-glass)] rounded-[32px] shadow-2xl overflow-hidden flex flex-col">
        <header className="shrink-0 p-4 border-b border-[var(--border-glass)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="text-[var(--theme-accent)]" size={24} />
            <h2 className="text-xl font-black text-[var(--text-primary)] uppercase tracking-tight">
              {isRu ? 'Полная статистика' : 'Full statistics'}
            </h2>
          </div>
          <button onClick={handleClose} className="p-2 rounded-full hover:bg-white/10 text-[var(--text-secondary)]">
            <X size={22} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-5 scrollbar-hide">
          {/* Opens */}
          <GlassCard className="bg-[var(--bg-card)] border border-[var(--border-glass)] rounded-2xl p-4">
            <h3 className="text-xs font-black text-[var(--text-secondary)] uppercase tracking-widest mb-3 flex items-center gap-2">
              <LayoutGrid size={14} /> {isRu ? 'Открытия разделов' : 'Section opens'}
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(stats.opens) as [keyof typeof stats.opens, number][]).map(([key, count]) => {
                const label = OPEN_LABELS[key] || { en: key, ru: key, emoji: '•' };
                return (
                  <div key={key} className="flex items-center justify-between py-2 px-3 rounded-xl bg-white/5 border border-white/5">
                    <span className="text-sm font-bold text-[var(--text-primary)]">{label.emoji} {isRu ? label.ru : label.en}</span>
                    <span className="text-sm font-black text-[var(--theme-accent)] tabular-nums">{count}</span>
                  </div>
                );
              })}
            </div>
          </GlassCard>

          {/* Last opened */}
          <GlassCard className="bg-[var(--bg-card)] border border-[var(--border-glass)] rounded-2xl p-4">
            <h3 className="text-xs font-black text-[var(--text-secondary)] uppercase tracking-widest mb-3 flex items-center gap-2">
              <Calendar size={14} /> {isRu ? 'Последнее открытие' : 'Last opened'}
            </h3>
            <div className="space-y-1.5">
              {(Object.entries(stats.lastOpenedAt) as [string, string | undefined][]).map(([key, date]) => {
                const label = OPEN_LABELS[key] || { en: key, ru: key, emoji: '•' };
                return (
                  <div key={key} className="flex items-center justify-between py-1.5 text-xs">
                    <span className="text-[var(--text-secondary)]">{label.emoji} {isRu ? label.ru : label.en}</span>
                    <span className="text-[var(--text-primary)] font-medium tabular-nums">{formatDate(date)}</span>
                  </div>
                );
              })}
              {Object.keys(stats.lastOpenedAt).length === 0 && (
                <p className="text-xs text-[var(--text-secondary)] py-2">{isRu ? 'Нет данных' : 'No data'}</p>
              )}
            </div>
          </GlassCard>

          {/* Ecosystem */}
          <GlassCard className="bg-[var(--bg-card)] border border-[var(--border-glass)] rounded-2xl p-4">
            <h3 className="text-xs font-black text-[var(--text-secondary)] uppercase tracking-widest mb-3 flex items-center gap-2">
              <Zap size={14} /> {isRu ? 'Экосистемы' : 'Ecosystems'}
            </h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/20">
                  <p className="text-[10px] font-black text-orange-400 uppercase mb-1">Sport</p>
                  <p className="text-xs text-[var(--text-primary)]">{isRu ? 'Тренировки' : 'Workouts'}: <strong>{stats.ecosystem.sport.workoutsCompleted ?? 0}</strong></p>
                  <p className="text-xs text-[var(--text-primary)]">{isRu ? 'Сообщ. тренеру' : 'Coach msgs'}: <strong>{stats.ecosystem.sport.coachMessages ?? 0}</strong></p>
                </div>
                <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                  <p className="text-[10px] font-black text-indigo-400 uppercase mb-1">Study</p>
                  <p className="text-xs text-[var(--text-primary)]">{isRu ? 'Экзамены' : 'Exams'}: <strong>{stats.ecosystem.study.examsCreated ?? 0}</strong></p>
                  <p className="text-xs text-[var(--text-primary)]">{isRu ? 'Квизы' : 'Quizzes'}: <strong>{stats.ecosystem.study.quizzesCompleted ?? 0}</strong></p>
                  <p className="text-xs text-[var(--text-primary)]">{isRu ? 'Билеты' : 'Tickets'}: <strong>{stats.ecosystem.study.ticketsParsed ?? 0}</strong></p>
                </div>
                <div className="p-3 rounded-xl bg-pink-500/10 border border-pink-500/20">
                  <p className="text-[10px] font-black text-pink-400 uppercase mb-1">Health</p>
                  <p className="text-xs text-[var(--text-primary)]">{isRu ? 'Дневники' : 'Logs'}: <strong>{stats.ecosystem.health.logsSaved ?? 0}</strong></p>
                </div>
                <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/20">
                  <p className="text-[10px] font-black text-sky-400 uppercase mb-1">Work</p>
                  <p className="text-xs text-[var(--text-primary)]">{isRu ? 'Логи прогресса' : 'Progress logs'}: <strong>{stats.ecosystem.work.progressLogs ?? 0}</strong></p>
                  <p className="text-xs text-[var(--text-primary)]">{isRu ? 'Чат с экспертом' : 'Expert chat'}: <strong>{stats.ecosystem.work.expertChatMessages ?? 0}</strong></p>
                </div>
              </div>
            </div>
          </GlassCard>

          {/* Totals */}
          <GlassCard className="bg-[var(--bg-card)] border border-[var(--border-glass)] rounded-2xl p-4">
            <h3 className="text-xs font-black text-[var(--text-secondary)] uppercase tracking-widest mb-3 flex items-center gap-2">
              <Target size={14} /> {isRu ? 'Общее' : 'Totals'}
            </h3>
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10">
                <MessageCircle size={18} className="text-[var(--theme-accent)]" />
                <span className="text-sm text-[var(--text-primary)]">{isRu ? 'Сообщения в чат' : 'Chat messages'}</span>
                <span className="text-sm font-black text-[var(--theme-accent)] tabular-nums">{stats.totalChatMessages ?? 0}</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10">
                <Target size={18} className="text-emerald-500" />
                <span className="text-sm text-[var(--text-primary)]">{isRu ? 'Целей достигнуто' : 'Goals completed'}</span>
                <span className="text-sm font-black text-emerald-500 tabular-nums">{stats.totalGoalsCompleted ?? 0}</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10">
                <BarChart3 size={18} className="text-amber-500" />
                <span className="text-sm text-[var(--text-primary)]">{isRu ? 'Задач выполнено' : 'Tasks completed'}</span>
                <span className="text-sm font-black text-amber-500 tabular-nums">{stats.totalTasksCompleted ?? 0}</span>
              </div>
            </div>
          </GlassCard>

          <p className="text-[10px] text-[var(--text-secondary)] text-center pb-2">
            {isRu ? 'Данные синхронизируются с Supabase (user_data.profile.usageStats)' : 'Data syncs to Supabase (user_data.profile.usageStats)'}
          </p>
        </div>
      </div>
    </div>
  );
};
