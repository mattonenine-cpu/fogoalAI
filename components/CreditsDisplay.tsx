import React, { useState, useRef, useEffect } from 'react';
import { CreditsSystem } from '../types';
import { CreditsService, MONTHLY_CREDIT_ALLOWANCE } from '../services/creditsService';

interface CreditsDisplayProps {
  credits: CreditsSystem | undefined;
  lang: 'en' | 'ru';
}

function getSubscriptionLabel(credits: CreditsSystem, lang: 'en' | 'ru'): string {
  if (!credits?.subscriptionType) return lang === 'ru' ? 'Безлимит' : 'Unlimited';
  if (credits.subscriptionType === 'unlimited') return lang === 'ru' ? 'Безлимит' : 'Unlimited';
  if (credits.subscriptionExpiresAt) {
    const date = new Date(credits.subscriptionExpiresAt).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US');
    return credits.subscriptionType === 'month'
      ? (lang === 'ru' ? `На месяц до ${date}` : `1 month until ${date}`)
      : (lang === 'ru' ? `На неделю до ${date}` : `1 week until ${date}`);
  }
  return credits.subscriptionType === 'month'
    ? (lang === 'ru' ? 'На месяц' : '1 month')
    : (lang === 'ru' ? 'На неделю' : '1 week');
}

function formatTimeUntilNextReset(credits: CreditsSystem, lang: 'en' | 'ru'): { text: string; nextDate: string } {
  const ms = CreditsService.getMsUntilNextReset(credits);
  const nextDate = CreditsService.getNextResetDate(credits);
  const nextDateStr = nextDate.toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' });

  if (ms <= 0) {
    return {
      text: lang === 'ru' ? 'Уже сегодня' : 'Today',
      nextDate: nextDateStr
    };
  }

  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  const parts: string[] = [];
  if (days > 0) parts.push(lang === 'ru' ? `${days} дн.` : `${days}d`);
  if (hours > 0) parts.push(lang === 'ru' ? `${hours} ч.` : `${hours}h`);
  if (minutes >= 0 && (days === 0 || parts.length < 2)) parts.push(lang === 'ru' ? `${minutes} мин.` : `${minutes}m`);

  const text = parts.length > 0 ? parts.join(' ') : (lang === 'ru' ? 'Меньше минуты' : 'Less than a minute');
  return { text, nextDate: nextDateStr };
}

export const CreditsDisplay: React.FC<CreditsDisplayProps> = ({ credits, lang }) => {
  const [showPopover, setShowPopover] = useState(false);
  const [timeLabel, setTimeLabel] = useState<{ text: string; nextDate: string } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showPopover) return;
    const close = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setShowPopover(false);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [showPopover]);

  // Обновлять подпись «осталось до выдачи» раз в минуту, когда открыт попап
  useEffect(() => {
    if (!showPopover) return;
    const safeCredits = credits && typeof credits?.availableCredits === 'number' && typeof credits?.totalCredits === 'number'
      ? credits
      : CreditsService.initializeCredits();
    const update = () => setTimeLabel(formatTimeUntilNextReset(safeCredits, lang));
    update();
    const t = setInterval(update, 60 * 1000);
    return () => clearInterval(t);
  }, [showPopover, credits?.lastResetDate, lang]);

  // Всегда показывать блок: если credits нет или поля некорректны — используем дефолт (на некоторых устройствах после синка профиль приходит без credits)
  const safeCredits: CreditsSystem = credits && typeof credits.availableCredits === 'number' && typeof credits.totalCredits === 'number'
    ? credits
    : CreditsService.initializeCredits();

  const isUnlimited = CreditsService.isSubscriptionActive(safeCredits);

  if (isUnlimited) {
    const label = getSubscriptionLabel(safeCredits, lang);
    return (
      <div ref={wrapRef} className="relative inline-block">
        <button
          type="button"
          onClick={() => setShowPopover((v) => !v)}
          className="px-3 py-1.5 rounded-full bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 cursor-pointer hover:from-yellow-500/30 hover:to-orange-500/30 transition-colors"
        >
          <span className="text-sm font-medium text-yellow-500">
            {lang === 'ru' ? 'Безлимит' : 'Unlimited'}
          </span>
        </button>
        {showPopover && (
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-[800] w-[240px] rounded-2xl border border-[var(--border-glass)] shadow-2xl overflow-hidden bg-[var(--bg-main)]">
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rotate-45 border-l border-t border-[var(--border-glass)] bg-[var(--bg-main)]" />
            <div className="relative px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                {lang === 'ru' ? 'Активна подписка' : 'Active subscription'}
              </p>
              <p className="text-sm font-semibold text-[var(--text-primary)] mt-1">{label}</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="relative inline-block shrink-0 min-w-0">
      <button
        type="button"
        onClick={() => setShowPopover((v) => !v)}
        className="px-3 py-1.5 rounded-full bg-[var(--bg-card)] border border-[var(--border-glass)] hover:border-[var(--theme-accent)]/30 transition-colors cursor-pointer"
      >
        <span className="text-sm font-medium text-[var(--text-primary)] tabular-nums">
          {Number(safeCredits.availableCredits) ?? 0}
        </span>
      </button>
      {showPopover && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-[800] w-[280px] rounded-2xl border border-[var(--border-glass)] shadow-2xl overflow-hidden bg-[var(--bg-main)]">
          {/* Стрелка к кнопке */}
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rotate-45 border-l border-t border-[var(--border-glass)] bg-[var(--bg-main)]" />
          <div className="relative px-4 py-4 space-y-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              {lang === 'ru' ? 'До новой тысячи кредитов' : 'Until next 1,000 credits'}
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-[var(--theme-accent)] tabular-nums">
                {timeLabel ? timeLabel.text : formatTimeUntilNextReset(safeCredits, lang).text}
              </span>
            </div>
            <div className="pt-2 border-t border-[var(--border-glass)]">
              <p className="text-xs text-[var(--text-secondary)]">
                {lang === 'ru' ? 'Следующая выдача' : 'Next reset'}
              </p>
              <p className="text-sm font-semibold text-[var(--text-primary)] mt-0.5">
                {timeLabel ? timeLabel.nextDate : formatTimeUntilNextReset(safeCredits, lang).nextDate}
              </p>
            </div>
            <div className="pt-2 border-t border-[var(--border-glass)] flex justify-between items-center">
              <span className="text-xs text-[var(--text-secondary)]">
                {lang === 'ru' ? 'Баланс' : 'Balance'}
              </span>
              <span className="text-sm font-bold text-[var(--text-primary)] tabular-nums">
                {safeCredits.availableCredits} / {MONTHLY_CREDIT_ALLOWANCE}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreditsDisplay;
