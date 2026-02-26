import React, { useState, useRef, useEffect } from 'react';
import { CreditsSystem } from '../types';
import { CreditsService } from '../services/creditsService';

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

export const CreditsDisplay: React.FC<CreditsDisplayProps> = ({ credits, lang }) => {
  const [showPopover, setShowPopover] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showPopover) return;
    const close = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setShowPopover(false);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [showPopover]);

  const isUnlimited = credits && CreditsService.isSubscriptionActive(credits);

  if (!credits) return null;

  if (isUnlimited) {
    const label = getSubscriptionLabel(credits, lang);
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
    <div className="px-3 py-1.5 rounded-full bg-[var(--bg-card)] border border-[var(--border-glass)]">
      <span className="text-sm font-medium text-[var(--text-primary)]">
        {credits.availableCredits}
      </span>
    </div>
  );
};
