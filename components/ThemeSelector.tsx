
import React from 'react';
import { AppTheme } from '../types';
import { Palette } from 'lucide-react';

interface ThemeSelectorProps {
  currentTheme: AppTheme;
  onSelect: (theme: AppTheme) => void;
  className?: string;
}

export const THEMES: { id: AppTheme; color: string; label: string }[] = [
  { id: 'dark', color: '#09090b', label: 'Dark Void' },
  { id: 'white', color: '#FFFFFF', label: 'Clean White' },
  { id: 'ice', color: '#D6E6F3', label: 'Ice Blue' },
];

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({ currentTheme, onSelect, className = '' }) => {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <div className={`relative z-50 ${className}`}>
        <button 
            onClick={() => setIsOpen(!isOpen)}
            className="w-10 h-10 rounded-full glass-liquid flex items-center justify-center text-[var(--text-primary)] hover:bg-white/10 transition-all active:scale-90"
        >
            <Palette size={16} />
        </button>
        
        {isOpen && (
            <div className="absolute top-12 right-0 glass-liquid border border-[var(--border-glass)] rounded-3xl p-3 flex flex-col gap-2 shadow-xl min-w-[140px] animate-fade-in-up z-[9999]">
                <p className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest px-2 mb-1">Theme Palette</p>
                {THEMES.map(theme => (
                    <button
                        key={theme.id}
                        onClick={() => { onSelect(theme.id); setIsOpen(false); }}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-all ${currentTheme === theme.id ? 'bg-[var(--text-primary)] text-[var(--bg-main)]' : 'hover:bg-black/5 text-[var(--text-primary)]'}`}
                    >
                        <div className="w-5 h-5 rounded-full border border-black/10 shadow-sm" style={{ backgroundColor: theme.color }} />
                        <span className="text-[10px] font-black uppercase tracking-wider">
                            {theme.label}
                        </span>
                    </button>
                ))}
            </div>
        )}
    </div>
  );
};
