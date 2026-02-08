
import React from 'react';
import { Language } from '../types';
import { GlassCard, GlassButton } from './GlassCard';
import { Globe } from 'lucide-react';

interface LanguageSelectorProps {
  onSelect: (lang: Language) => void;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({ onSelect }) => {
  const languages: { id: Language; label: string; code: string }[] = [
    { id: 'en', label: 'English', code: 'US' },
    { id: 'ru', label: 'Русский', code: 'RU' }
  ];

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#0f172a] to-black animate-fadeIn">
      <GlassCard className="w-full max-w-sm text-center py-12 px-8 border-white/10 bg-white/5">
        <div className="mx-auto w-20 h-20 bg-indigo-500/20 rounded-full flex items-center justify-center backdrop-blur-md border border-indigo-500/30 mb-8 shadow-[0_0_30px_rgba(99,102,241,0.3)]">
          <Globe className="w-10 h-10 text-indigo-400" />
        </div>
        
        <h1 className="text-3xl font-bold text-white mb-3">Choose Language</h1>
        <p className="text-slate-400 mb-10 text-sm">Select your preferred language to start.</p>

        <div className="grid gap-4">
          {languages.map((lang) => (
            <GlassButton 
              key={lang.id}
              onClick={() => onSelect(lang.id)} 
              variant="secondary"
              className="w-full justify-between px-8 py-5 bg-white/10 hover:bg-white/20 border border-white/10 group transition-all duration-300 shadow-lg hover:shadow-indigo-500/20 hover:scale-[1.02]"
            >
              <span className="flex items-center gap-4">
                <span className="text-lg font-black text-white/30 tracking-tighter group-hover:text-white/50 transition-colors">{lang.code}</span>
                <span className="font-bold text-lg text-white tracking-wide">{lang.label}</span>
              </span>
              <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)] opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0" />
            </GlassButton>
          ))}
        </div>
      </GlassCard>
    </div>
  );
};
