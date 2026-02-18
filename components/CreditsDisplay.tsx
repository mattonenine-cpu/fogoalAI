import React from 'react';
import { CreditsSystem } from '../types';

interface CreditsDisplayProps {
  credits: CreditsSystem | undefined;
  lang: 'en' | 'ru';
}

export const CreditsDisplay: React.FC<CreditsDisplayProps> = ({ credits, lang }) => {
  if (!credits || credits.hasUnlimitedAccess) {
    return (
      <div className="px-3 py-1.5 rounded-full bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30">
        <span className="text-sm font-medium text-yellow-500">
          {lang === 'ru' ? 'Безлимит' : 'Unlimited'}
        </span>
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
