import React, { useState } from 'react';
import { UserProfile, Language, TRANSLATIONS, AiPersona, UserSettings, EcosystemType, AppFontSize } from '../types';
import { authService } from '../services/authService';
import { CreditsService } from '../services/creditsService';
import { GlassCard } from './GlassCard';
import { X, Check, Globe, Bot, Layout, LogOut, User, SlidersHorizontal, Layers, Link2, Unlink } from 'lucide-react';

interface SettingsModalProps {
  user: UserProfile;
  lang: Language;
  onUpdate: (profile: UserProfile) => void;
  onLanguageChange: (lang: Language) => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ user, lang, onUpdate, onLanguageChange, onClose }) => {
  const t = TRANSLATIONS[lang] || TRANSLATIONS['en'];
  const [activeTab, setActiveTab] = useState<'interface' | 'ecosystems' | 'account'>('interface');
  const [promoCode, setPromoCode] = useState('');
  const [promoMessage, setPromoMessage] = useState('');

  const settings: UserSettings = user.settings || {
    aiPersona: 'balanced',
    aiDetailLevel: 'medium',
    visibleViews: ['dashboard', 'scheduler', 'smart_planner', 'chat', 'notes', 'sport', 'study', 'health', 'creativity'],
    fontSize: 'normal'
  };

  const updateLocalSettings = (newSettings: Partial<UserSettings>) => {
      onUpdate({ ...user, settings: { ...settings, ...newSettings } });
  };

  const handleLogout = async () => {
      if (confirm(t.logoutConfirm)) {
          await authService.logout();
          window.location.reload(); 
      }
  };

  const handleApplyPromoCode = () => {
    if (!promoCode.trim()) {
      setPromoMessage(lang === 'ru' ? 'Введите промокод' : 'Enter promo code');
      return;
    }

    const currentCredits = user.credits || CreditsService.initializeCredits();
    const updatedCredits = CreditsService.applyPromoCode(currentCredits, promoCode.trim());
    
    if (updatedCredits.hasUnlimitedAccess) {
      setPromoMessage(lang === 'ru' ? '🎉 Безлимитный доступ активирован!' : '🎉 Unlimited access activated!');
      onUpdate({ ...user, credits: updatedCredits });
      setPromoCode('');
    } else {
      setPromoMessage(lang === 'ru' ? '❌ Неверный промокод' : '❌ Invalid promo code');
    }
  };

  const menuItems = [
      { id: 'interface', icon: '🎨', label: lang === 'ru' ? 'ИНТЕРФЕЙС' : 'INTERFACE' },
      { id: 'ecosystems', icon: '⚛️', label: lang === 'ru' ? 'ЭКОСИСТЕМЫ' : 'ECOSYSTEMS' },
      { id: 'account', icon: '👤', label: lang === 'ru' ? 'АККАУНТ' : 'ACCOUNT' },
  ];

  return (
    <div className="fixed inset-0 z-[700] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4 sm:p-8 animate-fadeIn">
      <div className="w-full max-w-4xl h-[85vh] bg-[var(--bg-main)] border border-[var(--border-glass)] rounded-[44px] shadow-2xl flex flex-col overflow-hidden animate-fade-in-up">
        
        {/* Header */}
        <header className="p-8 border-b border-[var(--border-glass)] flex justify-between items-center bg-white/5">
            <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-600/20 flex items-center justify-center text-indigo-400 border border-indigo-500/30">
                    <Bot size={22} />
                </div>
                <h2 className="text-3xl font-serif font-black uppercase tracking-tighter text-[var(--text-primary)]">{lang === 'ru' ? 'НАСТРОЙКИ' : 'SETTINGS'}</h2>
            </div>
            <button onClick={onClose} className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"><X size={24} /></button>
        </header>

        <div className="flex-1 flex overflow-hidden">
            {/* Sidebar */}
            <aside className="w-20 sm:w-72 border-r border-[var(--border-glass)] flex flex-col p-4 gap-2 bg-white/2">
                {menuItems.map(item => (
                    <button 
                        key={item.id}
                        onClick={() => setActiveTab(item.id as any)}
                        className={`p-4 rounded-2xl flex items-center gap-4 transition-all group ${activeTab === item.id ? 'bg-[var(--bg-active)] text-[var(--bg-active-text)] shadow-xl scale-105' : 'text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)]'}`}
                    >
                        <span className="text-xl shrink-0">{item.icon}</span>
                        <span className="text-tiny font-black uppercase tracking-widest hidden sm:block truncate">{item.label}</span>
                    </button>
                ))}
            </aside>

            {/* Content Area */}
            <main className="flex-1 overflow-y-auto p-8 sm:p-12 space-y-12 scrollbar-hide">
                {activeTab === 'interface' && (
                    <div className="space-y-12 animate-fade-in-up">
                        <section className="space-y-6">
                            <h3 className="text-tiny font-black text-[var(--text-secondary)] uppercase tracking-widest">{lang === 'ru' ? 'ЯЗЫК' : 'LANGUAGE'}</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {[
                                    { id: 'en', code: 'US', label: 'English' },
                                    { id: 'ru', code: 'RU', label: 'Русский' }
                                ].map(l => (
                                    <button 
                                        key={l.id}
                                        onClick={() => onLanguageChange(l.id as any)}
                                        className={`p-5 rounded-[24px] border flex items-center justify-between transition-all ${lang === l.id ? 'bg-indigo-600/10 border-indigo-500/40 text-[var(--text-primary)]' : 'bg-white/2 border-[var(--border-glass)] text-[var(--text-secondary)]'}`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <span className="text-mini font-black opacity-30">{l.code}</span>
                                            <span className="text-sm font-bold">{l.label}</span>
                                        </div>
                                        {lang === l.id && <Check size={18} className="text-indigo-400" />}
                                    </button>
                                ))}
                            </div>
                        </section>

                        <section className="space-y-4">
                            <h3 className="text-tiny font-black text-[var(--text-secondary)] uppercase tracking-widest">{lang === 'ru' ? 'РАЗМЕР ШРИФТА' : 'FONT SIZE'}</h3>
                            <div className="flex bg-white/5 rounded-2xl p-1.5 border border-[var(--border-glass)] gap-1 overflow-x-auto">
                                {(['small', 'normal', 'medium', 'large', 'xlarge'] as AppFontSize[]).map(size => (
                                    <button key={size} onClick={() => updateLocalSettings({ fontSize: size })} className={`flex-1 min-w-[50px] h-14 rounded-xl flex items-center justify-center transition-all ${settings.fontSize === size ? 'bg-[var(--bg-active)] text-[var(--bg-active-text)] shadow-lg' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>
                                        <span style={{ fontSize: size === 'small' ? '12px' : size === 'normal' ? '14px' : size === 'medium' ? '16px' : size === 'large' ? '20px' : '24px' }} className="font-bold">Aa</span>
                                    </button>
                                ))}
                            </div>
                        </section>
                    </div>
                )}

                {activeTab === 'ecosystems' && (
                    <div className="space-y-8 animate-fade-in-up">
                        <section className="space-y-6">
                            <h3 className="text-tiny font-black text-[var(--text-secondary)] uppercase tracking-widest">{lang === 'ru' ? 'НИЖНЯЯ ПАНЕЛЬ' : 'BOTTOM NAVIGATION'}</h3>
                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { id: 'dashboard', emoji: '🏠', label: 'ГЛАВНАЯ' },
                                    { id: 'scheduler', emoji: '📅', label: 'ПЛАНЫ' },
                                    { id: 'chat', emoji: '💬', label: 'ИИ ЧАТ' },
                                    { id: 'notes', emoji: '📝', label: 'ЗАМЕТКИ' },
                                    { id: 'sport', emoji: '💪', label: 'SPORT' },
                                    { id: 'study', emoji: '📚', label: 'STUDY' },
                                    { id: 'health', emoji: '❤️', label: 'HEALTH' },
                                    { id: 'creativity', emoji: '🎨', label: 'CREA..' }
                                ].map(item => {
                                    const isVisible = settings.visibleViews.includes(item.id);
                                    return (
                                        <button 
                                            key={item.id}
                                            onClick={() => {
                                                const current = settings.visibleViews;
                                                const updated = isVisible ? current.filter(v => v !== item.id) : [...current, item.id];
                                                updateLocalSettings({ visibleViews: updated });
                                            }}
                                            className={`p-5 rounded-[28px] border transition-all flex items-center gap-4 ${isVisible ? 'bg-indigo-600/10 border-indigo-500/40 text-[var(--text-primary)]' : 'bg-white/2 border-[var(--border-glass)] text-[var(--text-secondary)] opacity-60 grayscale'}`}
                                        >
                                            <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center shrink-0 border border-white/5"><span className="text-xl">{item.emoji}</span></div>
                                            <div className="text-left overflow-hidden">
                                                <span className="text-xxs font-black uppercase tracking-tight block truncate">{item.label}</span>
                                                <div className="flex gap-1 mt-1">
                                                    <div className={`w-3 h-1 rounded-full ${isVisible ? 'bg-indigo-500' : 'bg-white/10'}`} />
                                                    <div className={`w-3 h-1 rounded-full ${isVisible ? 'bg-indigo-500' : 'bg-white/10'}`} />
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </section>
                    </div>
                )}

                {activeTab === 'account' && (
                    <div className="space-y-6 animate-fade-in-up">
                         <h3 className="text-tiny font-black text-[var(--text-secondary)] uppercase tracking-widest">{lang === 'ru' ? 'ПРОФИЛЬ' : 'PROFILE'}</h3>
                         <GlassCard className="p-8 border-[var(--border-glass)] bg-white/2 space-y-8 rounded-[40px]">
                            {/* Credits Info */}
                            <div className="space-y-4">
                                <h4 className="text-lg font-black text-[var(--text-primary)]">
                                    {lang === 'ru' ? 'Кредиты AI' : 'AI Credits'}
                                </h4>
                                {user.credits && (
                                    <div className="p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border-glass)]">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-sm text-[var(--text-secondary)]">
                                                {lang === 'ru' ? 'Доступно:' : 'Available:'}
                                            </span>
                                            <span className="text-lg font-bold text-[var(--text-primary)]">
                                                {user.credits.hasUnlimitedAccess 
                                                    ? (lang === 'ru' ? 'Безлимитно' : 'Unlimited')
                                                    : `${user.credits.availableCredits} / ${user.credits.totalCredits}`
                                                }
                                            </span>
                                        </div>
                                        {!user.credits.hasUnlimitedAccess && (
                                            <div className="text-xs text-[var(--text-secondary)]">
                                                {lang === 'ru' ? 'Использовано:' : 'Used:'} {user.credits.usedCredits}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Promo Code */}
                            <div className="space-y-4">
                                <h4 className="text-lg font-black text-[var(--text-primary)]">
                                    {lang === 'ru' ? 'Промокод' : 'Promo Code'}
                                </h4>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={promoCode}
                                        onChange={(e) => setPromoCode(e.target.value)}
                                        placeholder={lang === 'ru' ? 'Введите промокод...' : 'Enter promo code...'}
                                        className="flex-1 px-4 py-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-glass)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--theme-accent)]/20"
                                    />
                                    <button
                                        onClick={handleApplyPromoCode}
                                        className="px-6 py-3 rounded-xl bg-[var(--theme-accent)] text-white font-medium hover:bg-[var(--theme-accent)]/90 transition-colors"
                                    >
                                        {lang === 'ru' ? 'Применить' : 'Apply'}
                                    </button>
                                </div>
                                {promoMessage && (
                                    <div className={`text-sm p-3 rounded-xl ${
                                        promoMessage.includes('🎉') 
                                            ? 'bg-green-500/10 text-green-500 border border-green-500/20' 
                                            : 'bg-red-500/10 text-red-500 border border-red-500/20'
                                    }`}>
                                        {promoMessage}
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center gap-6">
                                <div className="w-20 h-20 rounded-[32px] bg-indigo-500/20 flex items-center justify-center text-4xl border border-indigo-500/30">👤</div>
                                <div>
                                    <h4 className="text-2xl font-black text-[var(--text-primary)]">{user.name || 'Explorer'}</h4>
                                    <p className="text-mini font-black uppercase tracking-widest opacity-30">{user.occupation || 'FoGoal User'}</p>
                                </div>
                            </div>
                            <button onClick={handleLogout} className="w-full p-6 rounded-[32px] bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center group active:scale-95 transition-all">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center"><LogOut size={20} /></div>
                                    <span className="font-black uppercase text-xs tracking-widest">{t.logout}</span>
                                </div>
                            </button>
                         </GlassCard>
                    </div>
                )}
            </main>
        </div>

        {/* Save Button */}
        <footer className="p-8 border-t border-[var(--border-glass)] bg-white/5 flex justify-center shrink-0">
            <button onClick={onClose} className="px-16 py-5 bg-[var(--bg-active)] text-[var(--bg-active-text)] rounded-full font-black uppercase tracking-widest text-[12px] shadow-2xl hover:scale-105 active:scale-95 transition-all">
                {lang === 'ru' ? 'СОХРАНИТЬ' : 'SAVE CHANGES'}
            </button>
        </footer>
      </div>
    </div>
  );
};

