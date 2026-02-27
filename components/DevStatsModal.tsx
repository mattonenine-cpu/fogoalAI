import React, { useState, useEffect } from 'react';
import { UserProfile, UsageStats, Language, getDefaultUsageStats } from '../types';
import { GlassCard, GlassInput } from './GlassCard';
import { X, BarChart3, LayoutGrid, Zap, MessageCircle, Target, Calendar, Users, Loader2, ChevronDown, ChevronUp, TrendingUp, PieChart } from 'lucide-react';

const DEV_STATS_PROMO_CODE = 'FOGOAL_DEV_2025';
const SESSION_KEY = 'focu_dev_stats_unlocked';

interface DevStatsModalProps {
  user: UserProfile;
  lang: Language;
  onClose: () => void;
}

interface UsageStatsRow {
  opens: Record<string, number>;
  lastOpenedAt: Record<string, string>;
  ecosystem: {
    sport: { workoutsCompleted: number; coachMessages: number };
    study: { examsCreated: number; quizzesCompleted: number; ticketsParsed: number };
    health: { logsSaved: number };
    work: { progressLogs: number; expertChatMessages: number };
  };
  totalChatMessages: number;
  totalTasksCompleted: number;
  totalGoalsCompleted: number;
}

interface AdminStatsResponse {
  ok: boolean;
  error?: string;
  totalUsers?: number;
  aggregated?: UsageStatsRow;
  users?: { username: string; usageStats: UsageStatsRow }[];
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

function StatsContent({
  stats,
  isRu,
  isAggregate,
  totalUsers,
}: { stats: UsageStatsRow | UsageStats; isRu: boolean; isAggregate?: boolean; totalUsers?: number }) {
  const opens = stats.opens || {};
  const ecosystem = stats.ecosystem || { sport: { workoutsCompleted: 0, coachMessages: 0 }, study: { examsCreated: 0, quizzesCompleted: 0, ticketsParsed: 0 }, health: { logsSaved: 0 }, work: { progressLogs: 0, expertChatMessages: 0 } };
  const lastOpenedAt = 'lastOpenedAt' in stats ? (stats as UsageStatsRow).lastOpenedAt : {};

  return (
    <>
      {isAggregate && totalUsers != null && (
        <div className="mb-4 flex items-center justify-between rounded-2xl bg-[var(--theme-accent)]/15 border border-[var(--theme-accent)]/30 px-4 py-3">
          <span className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Users size={20} className="text-[var(--theme-accent)]" />
            {isRu ? 'Всего пользователей' : 'Total users'}
          </span>
          <span className="text-xl font-black text-[var(--theme-accent)] tabular-nums">{totalUsers}</span>
        </div>
      )}

      <GlassCard className="bg-[var(--bg-card)] border border-[var(--border-glass)] rounded-2xl p-4">
        <h3 className="text-xs font-black text-[var(--text-secondary)] uppercase tracking-widest mb-3 flex items-center gap-2">
          <LayoutGrid size={14} /> {isRu ? 'Открытия разделов' : 'Section opens'}
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {(Object.entries(opens) as [string, number][]).map(([key, count]) => {
            const label = OPEN_LABELS[key] || { en: key, ru: key, emoji: '•' };
            return (
              <div key={key} className="flex items-center justify-between py-2 px-3 rounded-xl bg-white/5 border border-white/5">
                <span className="text-sm font-bold text-[var(--text-primary)]">{label.emoji} {isRu ? label.ru : label.en}</span>
                <span className="text-sm font-black text-[var(--theme-accent)] tabular-nums">{count ?? 0}</span>
              </div>
            );
          })}
        </div>
      </GlassCard>

      {!isAggregate && Object.keys(lastOpenedAt).length > 0 && (
        <GlassCard className="bg-[var(--bg-card)] border border-[var(--border-glass)] rounded-2xl p-4">
          <h3 className="text-xs font-black text-[var(--text-secondary)] uppercase tracking-widest mb-3 flex items-center gap-2">
            <Calendar size={14} /> {isRu ? 'Последнее открытие' : 'Last opened'}
          </h3>
          <div className="space-y-1.5">
            {(Object.entries(lastOpenedAt) as [string, string][]).map(([key, date]) => {
              const label = OPEN_LABELS[key] || { en: key, ru: key, emoji: '•' };
              return (
                <div key={key} className="flex items-center justify-between py-1.5 text-xs">
                  <span className="text-[var(--text-secondary)]">{label.emoji} {isRu ? label.ru : label.en}</span>
                  <span className="text-[var(--text-primary)] font-medium tabular-nums">{formatDate(date)}</span>
                </div>
              );
            })}
          </div>
        </GlassCard>
      )}

      <GlassCard className="bg-[var(--bg-card)] border border-[var(--border-glass)] rounded-2xl p-4">
        <h3 className="text-xs font-black text-[var(--text-secondary)] uppercase tracking-widest mb-3 flex items-center gap-2">
          <Zap size={14} /> {isRu ? 'Экосистемы' : 'Ecosystems'}
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/20">
            <p className="text-[10px] font-black text-orange-400 uppercase mb-1">Sport</p>
            <p className="text-xs text-[var(--text-primary)]">{isRu ? 'Тренировки' : 'Workouts'}: <strong>{ecosystem.sport?.workoutsCompleted ?? 0}</strong></p>
            <p className="text-xs text-[var(--text-primary)]">{isRu ? 'Сообщ. тренеру' : 'Coach msgs'}: <strong>{ecosystem.sport?.coachMessages ?? 0}</strong></p>
          </div>
          <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
            <p className="text-[10px] font-black text-indigo-400 uppercase mb-1">Study</p>
            <p className="text-xs text-[var(--text-primary)]">{isRu ? 'Экзамены' : 'Exams'}: <strong>{ecosystem.study?.examsCreated ?? 0}</strong></p>
            <p className="text-xs text-[var(--text-primary)]">{isRu ? 'Квизы' : 'Quizzes'}: <strong>{ecosystem.study?.quizzesCompleted ?? 0}</strong></p>
            <p className="text-xs text-[var(--text-primary)]">{isRu ? 'Билеты' : 'Tickets'}: <strong>{ecosystem.study?.ticketsParsed ?? 0}</strong></p>
          </div>
          <div className="p-3 rounded-xl bg-pink-500/10 border border-pink-500/20">
            <p className="text-[10px] font-black text-pink-400 uppercase mb-1">Health</p>
            <p className="text-xs text-[var(--text-primary)]">{isRu ? 'Дневники' : 'Logs'}: <strong>{ecosystem.health?.logsSaved ?? 0}</strong></p>
          </div>
        </div>
      </GlassCard>

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
    </>
  );
}

export const DevStatsModal: React.FC<DevStatsModalProps> = ({ user, lang, onClose }) => {
  const [unlocked, setUnlocked] = useState(() => {
    if (typeof sessionStorage === 'undefined') return false;
    return sessionStorage.getItem(SESSION_KEY) === '1';
  });
  const [codeInput, setCodeInput] = useState('');
  const [codeError, setCodeError] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AdminStatsResponse | null>(null);
  const [showUserList, setShowUserList] = useState(false);

  const isRu = lang === 'ru';

  const fetchAllStats = async () => {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch('/api/admin-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promoCode: DEV_STATS_PROMO_CODE }),
      });
      const json: AdminStatsResponse = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        setError(json.error || res.statusText || (isRu ? 'Ошибка загрузки' : 'Load error'));
        return;
      }
      setData(json);
    } catch (e: any) {
      setError(e?.message || (isRu ? 'Ошибка сети' : 'Network error'));
    } finally {
      setLoading(false);
    }
  };

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
    fetchAllStats();
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
            {isRu ? 'Введите промокод разработчика для просмотра статистики всех пользователей.' : 'Enter developer promo code to view all users statistics.'}
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
              {isRu ? 'Статистика всех пользователей' : 'All users statistics'}
            </h2>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => fetchAllStats()} disabled={loading} className="p-2 rounded-full hover:bg-white/10 text-[var(--text-secondary)] disabled:opacity-50" title={isRu ? 'Обновить' : 'Refresh'}>
              <Loader2 size={20} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={handleClose} className="p-2 rounded-full hover:bg-white/10 text-[var(--text-secondary)]">
              <X size={22} />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-5 scrollbar-hide">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="animate-spin text-[var(--theme-accent)]" size={40} />
              <p className="mt-3 text-sm text-[var(--text-secondary)]">{isRu ? 'Загрузка из Supabase...' : 'Loading from Supabase...'}</p>
            </div>
          )}

          {error && !loading && (
            <div className="rounded-2xl bg-rose-500/15 border border-rose-500/30 p-4 text-rose-400 text-sm">
              {error}
              <button onClick={fetchAllStats} className="mt-2 block text-xs underline">{isRu ? 'Повторить' : 'Retry'}</button>
            </div>
          )}

          {data?.ok && data.aggregated && !loading && (
            <>
              <StatsContent stats={data.aggregated} isRu={isRu} isAggregate totalUsers={data.totalUsers ?? 0} />

              {/* Интересная аналитика для создателей */}
              {data.totalUsers != null && data.totalUsers > 0 && (
                <GlassCard className="bg-[var(--bg-card)] border border-[var(--border-glass)] rounded-2xl p-4">
                  <h3 className="text-xs font-black text-[var(--text-secondary)] uppercase tracking-widest mb-3 flex items-center gap-2">
                    <TrendingUp size={14} /> {isRu ? 'Для создателей' : 'Creator insights'}
                  </h3>
                  <div className="space-y-3">
                    {(() => {
                      const agg = data.aggregated!;
                      const total = data.totalUsers;
                      const opens = agg.opens || {};
                      const maxOpenKey = (Object.entries(opens) as [string, number][]).reduce((a, b) => (b[1] > a[1] ? b : a), ['dashboard', 0])[0];
                      const maxLabel = OPEN_LABELS[maxOpenKey] ? (isRu ? OPEN_LABELS[maxOpenKey].ru : OPEN_LABELS[maxOpenKey].en) : maxOpenKey;
                      const activeCount = data.users?.filter((u: { username: string; usageStats: UsageStatsRow }) => {
                        const s = u.usageStats;
                        const sum = (s.totalChatMessages ?? 0) + (s.totalGoalsCompleted ?? 0) + (s.ecosystem?.sport?.workoutsCompleted ?? 0) + (s.ecosystem?.study?.quizzesCompleted ?? 0) + (s.ecosystem?.study?.examsCreated ?? 0) + (s.ecosystem?.health?.logsSaved ?? 0);
                        return sum > 0;
                      }).length ?? 0;
                      const avgWorkouts = total ? ((agg.ecosystem?.sport?.workoutsCompleted ?? 0) / total).toFixed(1) : '0';
                      const avgExams = total ? ((agg.ecosystem?.study?.examsCreated ?? 0) / total).toFixed(1) : '0';
                      const avgChat = total ? ((agg.totalChatMessages ?? 0) / total).toFixed(1) : '0';
                      return (
                        <>
                          <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-white/5 border border-white/5">
                            <span className="text-sm text-[var(--text-primary)]">{isRu ? 'Самый популярный раздел' : 'Most used section'}</span>
                            <span className="text-sm font-black text-[var(--theme-accent)]">{maxLabel}</span>
                          </div>
                          <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-white/5 border border-white/5">
                            <span className="text-sm text-[var(--text-primary)]">{isRu ? 'Активных пользователей' : 'Active users'}</span>
                            <span className="text-sm font-black text-emerald-500 tabular-nums">{activeCount} / {total}</span>
                          </div>
                          <div className="grid grid-cols-1 gap-2 pt-1">
                            <p className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-wider">{isRu ? 'В среднем на пользователя' : 'Avg per user'}</p>
                            <div className="flex flex-wrap gap-2">
                              <span className="px-2.5 py-1 rounded-lg bg-orange-500/15 text-orange-400 text-xs font-bold">{isRu ? 'Тренировки' : 'Workouts'}: {avgWorkouts}</span>
                              <span className="px-2.5 py-1 rounded-lg bg-indigo-500/15 text-indigo-400 text-xs font-bold">{isRu ? 'Экзамены' : 'Exams'}: {avgExams}</span>
                              <span className="px-2.5 py-1 rounded-lg bg-[var(--theme-accent)]/15 text-[var(--theme-accent)] text-xs font-bold">{isRu ? 'Сообщения в чат' : 'Chat'}: {avgChat}</span>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </GlassCard>
              )}

              <div className="pt-2">
                <button
                  onClick={() => setShowUserList(!showUserList)}
                  className="w-full flex items-center justify-between py-3 px-4 rounded-2xl bg-white/5 border border-[var(--border-glass)] text-[var(--text-primary)] font-bold text-sm"
                >
                  <span className="flex items-center gap-2">
                    <Users size={18} />
                    {isRu ? 'По пользователям' : 'Per user'} ({data.users?.length ?? 0})
                  </span>
                  {showUserList ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>
                {showUserList && data.users && data.users.length > 0 && (
                  <div className="mt-2 space-y-2 max-h-[280px] overflow-y-auto scrollbar-hide">
                    {data.users.map((u) => (
                      <details key={u.username} className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-glass)] overflow-hidden">
                        <summary className="px-4 py-2.5 text-sm font-bold text-[var(--text-primary)] cursor-pointer list-none flex items-center justify-between">
                          <span className="truncate">{u.username}</span>
                          <span className="text-xs text-[var(--text-secondary)] tabular-nums">
                            Σ {(u.usageStats.totalChatMessages ?? 0) + (u.usageStats.totalGoalsCompleted ?? 0) + (u.usageStats.ecosystem?.sport?.workoutsCompleted ?? 0) + (u.usageStats.ecosystem?.study?.quizzesCompleted ?? 0)}
                          </span>
                        </summary>
                        <div className="px-4 pb-3 pt-1 border-t border-[var(--border-glass)]">
                          <StatsContent stats={u.usageStats} isRu={isRu} />
                        </div>
                      </details>
                    ))}
                  </div>
                )}
              </div>

              <p className="text-[10px] text-[var(--text-secondary)] text-center pb-2">
                {isRu ? 'Данные из Supabase (user_data.profile.usageStats)' : 'Data from Supabase (user_data.profile.usageStats)'}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
