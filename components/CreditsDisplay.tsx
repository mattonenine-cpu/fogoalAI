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
    const title = lang === 'ru' ? 'Активна подписка' : 'Active subscription';
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
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-[800] px-3 py-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-glass)] shadow-xl whitespace-nowrap text-xs">
            <span className="text-[var(--text-secondary)]">{title}: </span>
            <span className="font-medium text-[var(--text-primary)]">{label}</span>
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
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-[800] px-3 py-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-glass)] shadow-xl text-xs min-w-[200px]">
          <p className="text-[var(--text-secondary)] font-medium mb-1">
            {lang === 'ru' ? 'До новой тысячи кредитов' : 'Until next 1,000 credits'}
          </p>
          <p className="font-bold text-[var(--text-primary)] tabular-nums">
            {timeLabel ? timeLabel.text : formatTimeUntilNextReset(safeCredits, lang).text}
          </p>
          <p className="text-[var(--text-secondary)] mt-1.5 text-[11px]">
            {lang === 'ru' ? 'Следующая выдача' : 'Next reset'}: {timeLabel ? timeLabel.nextDate : formatTimeUntilNextReset(safeCredits, lang).nextDate}
          </p>
          <p className="text-[var(--text-secondary)] mt-0.5 text-[11px]">
            {safeCredits.availableCredits} / {MONTHLY_CREDIT_ALLOWANCE} {lang === 'ru' ? 'кредитов' : 'credits'}
          </p>
        </div>
      )}
    </div>
  );
};

export default CreditsDisplay;
