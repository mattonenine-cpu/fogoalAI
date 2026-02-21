
import React, { useState } from 'react';
import { UserProfile, Language, TRANSLATIONS, AiPersona, UserSettings, EcosystemType, AppFontSize } from '../types';
import { authService } from '../services/authService';
import { GlassCard } from './GlassCard';
import { X, Check, Globe, Bot, Layout, LogOut, User, SlidersHorizontal, Layers, Link2, Unlink, Bell, ChevronDown, ChevronUp } from 'lucide-react';

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
  const [showReminderSettings, setShowReminderSettings] = useState(false);
  const [reminderTime, setReminderTime] = useState(user.telegramReminderTime ?? '09:00');
  const [reminderFrequency, setReminderFrequency] = useState<'daily' | 'weekdays' | 'weekends'>(user.telegramReminderFrequency ?? 'daily');
  const [reminderEnabled, setReminderEnabled] = useState(!!user.telegramReminderEnabled);

  React.useEffect(() => {
    setReminderTime(user.telegramReminderTime ?? '09:00');
    setReminderFrequency(user.telegramReminderFrequency ?? 'daily');
    setReminderEnabled(!!user.telegramReminderEnabled);
  }, [user.telegramReminderTime, user.telegramReminderFrequency, user.telegramReminderEnabled]);

  const settings: UserSettings = user.settings || {
    aiPersona: 'balanced',
    aiDetailLevel: 'medium',
    visibleViews: ['dashboard', 'scheduler', 'chat', 'notes'],
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
                            <div className="flex items-center gap-6">
                                <div className="w-20 h-20 rounded-[32px] bg-indigo-500/20 flex items-center justify-center text-4xl border border-indigo-500/30">👤</div>
                                <div>
                                    <h4 className="text-2xl font-black text-[var(--text-primary)]">{user.name || 'Explorer'}</h4>
                                    <p className="text-mini font-black uppercase tracking-widest opacity-30">{user.occupation || 'FoGoal User'}</p>
                                </div>
                            </div>

                            {user.telegramId && (
                                <section className="space-y-3">
                                    <h4 className="text-tiny font-black text-[var(--text-secondary)] uppercase tracking-widest">{lang === 'ru' ? 'НАПОМИНАНИЯ В TELEGRAM' : 'TELEGRAM REMINDERS'}</h4>
                                    <button
                                        type="button"
                                        onClick={() => setShowReminderSettings(!showReminderSettings)}
                                        className="w-full p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-[var(--text-primary)] flex items-center justify-between hover:bg-indigo-500/20 transition-colors"
                                    >
                                        <span className="flex items-center gap-2">
                                            <Bell size={20} className="text-indigo-400" />
                                            {lang === 'ru' ? 'Настроить напоминания' : 'Set up reminders'}
                                        </span>
                                        {showReminderSettings ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                    </button>
                                    {showReminderSettings && (
                                        <div className="p-5 rounded-2xl bg-white/5 border border-[var(--border-glass)] space-y-4 animate-fade-in-up">
                                            <label className="flex items-center justify-between gap-4 cursor-pointer">
                                                <span className="text-sm text-[var(--text-primary)]">{lang === 'ru' ? 'Включить напоминания' : 'Enable reminders'}</span>
                                                <button
                                                    type="button"
                                                    role="switch"
                                                    aria-checked={reminderEnabled}
                                                    onClick={() => setReminderEnabled(!reminderEnabled)}
                                                    className={`relative w-12 h-7 rounded-full transition-colors ${reminderEnabled ? 'bg-indigo-500' : 'bg-white/10'}`}
                                                >
                                                    <span className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${reminderEnabled ? 'left-7 translate-x-[-100%]' : 'left-1'}`} />
                                                </button>
                                            </label>
                                            <div>
                                                <label className="text-tiny font-black text-[var(--text-secondary)] uppercase tracking-widest block mb-2">{lang === 'ru' ? 'Время' : 'Time'}</label>
                                                <input
                                                    type="time"
                                                    value={reminderTime}
                                                    onChange={(e) => setReminderTime(e.target.value)}
                                                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-[var(--border-glass)] text-[var(--text-primary)] focus:outline-none focus:border-indigo-500/50"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-tiny font-black text-[var(--text-secondary)] uppercase tracking-widest block mb-2">{lang === 'ru' ? 'Регулярность' : 'Frequency'}</label>
                                                <div className="flex flex-wrap gap-2">
                                                    {(['daily', 'weekdays', 'weekends'] as const).map((freq) => (
                                                        <button
                                                            key={freq}
                                                            type="button"
                                                            onClick={() => setReminderFrequency(freq)}
                                                            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${reminderFrequency === freq ? 'bg-indigo-500 text-white' : 'bg-white/5 text-[var(--text-secondary)] hover:bg-white/10'}`}
                                                        >
                                                            {lang === 'ru' ? (freq === 'daily' ? 'Каждый день' : freq === 'weekdays' ? 'Будни' : 'Выходные') : (freq === 'daily' ? 'Daily' : freq === 'weekdays' ? 'Weekdays' : 'Weekends')}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const updated = { ...user, telegramReminderEnabled: reminderEnabled, telegramReminderTime: reminderTime, telegramReminderFrequency: reminderFrequency };
                                                    onUpdate(updated);
                                                    const base = typeof window !== 'undefined' ? window.location.origin : '';
                                                    if (user.telegramId && base) {
                                                        fetch(`${base}/api/register-reminder`, {
                                                            method: 'POST',
                                                            headers: { 'Content-Type': 'application/json' },
                                                            body: JSON.stringify({ telegramId: user.telegramId, time: reminderTime, frequency: reminderFrequency, enabled: reminderEnabled })
                                                        }).catch(() => {});
                                                    }
                                                    setShowReminderSettings(false);
                                                }}
                                                className="w-full py-3 rounded-xl bg-indigo-500 text-white font-bold text-sm"
                                            >
                                                {lang === 'ru' ? 'Сохранить' : 'Save'}
                                            </button>
                                        </div>
                                    )}

                                    {user.telegramReminderEnabled && user.telegramReminderTime && (
                                        <p className="text-mini text-[var(--text-secondary)]">
                                            {lang === 'ru' ? `Напоминания: ${user.telegramReminderTime}, ${user.telegramReminderFrequency === 'daily' ? 'каждый день' : user.telegramReminderFrequency === 'weekdays' ? 'будни' : 'выходные'}` : `Reminders: ${user.telegramReminderTime}, ${user.telegramReminderFrequency}`}
                                        </p>
                                    )}
                                </section>
                            )}

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
