import React from 'react';
import { CreditsSystem } from '../types';
import { CreditsService } from '../services/creditsService';
import { Coins, Zap } from 'lucide-react';

interface CreditsDisplayProps {
  credits: CreditsSystem | undefined;
  lang: 'en' | 'ru';
}

export const CreditsDisplay: React.FC<CreditsDisplayProps> = ({ credits, lang }) => {
  if (!credits || credits.hasUnlimitedAccess) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30">
        <Zap className="w-4 h-4 text-yellow-500" />
        <span className="text-sm font-medium text-yellow-500">
          {lang === 'ru' ? 'Безлимитный' : 'Unlimited'}
        </span>
      </div>
    );
  }

  const status = CreditsService.getCreditsStatus(credits);
  const percentageColor = 
    status.percentage > 50 ? 'text-green-500' :
    status.percentage > 20 ? 'text-yellow-500' : 'text-red-500';

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--bg-card)] border border-[var(--border-glass)]">
      <Coins className="w-4 h-4 text-[var(--text-secondary)]" />
      <div className="flex flex-col">
        <span className="text-sm font-medium text-[var(--text-primary)]">
          {status.available} / {status.total}
        </span>
        <div className="flex items-center gap-1">
          <div className="w-12 h-1.5 bg-[var(--border-glass)] rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-300 ${percentageColor}`}
              style={{ width: `${status.percentage}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
