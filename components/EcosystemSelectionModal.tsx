import React, { useState } from 'react';
import { EcosystemConfig, EcosystemType, UserProfile } from '../types';
import { X, Check } from 'lucide-react';

interface EcosystemSelectionModalProps {
  currentEcosystems: EcosystemConfig[];
  onConfirm: (selectedEcosystems: EcosystemConfig[]) => void;
  onClose: () => void;
  lang: 'en' | 'ru';
}

const ECOSYSTEM_OPTIONS: { type: EcosystemType; label: string; icon: string; description: { ru: string; en: string } }[] = [
  {
    type: 'sport',
    label: 'Sport',
    icon: '⚽',
    description: { ru: 'Фитнес и физическая активность', en: 'Fitness and physical activities' }
  },
  {
    type: 'study',
    label: 'Study',
    icon: '📚',
    description: { ru: 'Обучение и образование', en: 'Learning and education' }
  },
  {
    type: 'health',
    label: 'Health',
    icon: '❤️',
    description: { ru: 'Мониторинг здоровья и wellness', en: 'Health monitoring and wellness' }
  }
];

export const EcosystemSelectionModal: React.FC<EcosystemSelectionModalProps> = ({
  currentEcosystems,
  onConfirm,
  onClose,
  lang
}) => {
  const [selectedEcosystems, setSelectedEcosystems] = useState<EcosystemType[]>(
    currentEcosystems.filter(e => e.enabled).map(e => e.type)
  );

  const toggleEcosystem = (type: EcosystemType) => {
    setSelectedEcosystems(prev => 
      prev.includes(type) 
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const handleConfirm = () => {
    const updatedEcosystems: EcosystemConfig[] = ECOSYSTEM_OPTIONS.map(option => ({
      type: option.type,
      label: option.label,
      icon: option.icon,
      enabled: selectedEcosystems.includes(option.type),
      justification: option.description[lang]
    }));

    onConfirm(updatedEcosystems);
  };

  const t = {
    title: lang === 'ru' ? 'Выберите экосистемы' : 'Select Ecosystems',
    subtitle: lang === 'ru' ? 'Какие мини-приложения вы хотите видеть на нижней панели?' : 'Which mini-apps do you want to see on the bottom panel?',
    confirm: lang === 'ru' ? 'Подтвердить' : 'Confirm',
    skip: lang === 'ru' ? 'Пропустить' : 'Skip'
  };

  return (
    <div className="fixed inset-0 z-[800] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-[var(--bg-main)] border border-[var(--border-glass)] rounded-[32px] shadow-2xl p-6 max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-[var(--text-primary)]">{t.title}</h2>
            <p className="text-sm text-[var(--text-secondary)] mt-1">{t.subtitle}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[var(--bg-card)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Ecosystem Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {ECOSYSTEM_OPTIONS.map(option => {
            const isSelected = selectedEcosystems.includes(option.type);
            return (
              <button
                key={option.type}
                onClick={() => toggleEcosystem(option.type)}
                className={`p-4 rounded-xl border transition-all text-left ${
                  isSelected
                    ? 'bg-[var(--theme-accent)]/10 border-[var(--theme-accent)]/40 text-[var(--text-primary)]'
                    : 'bg-[var(--bg-card)] border-[var(--border-glass)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="text-2xl">{option.icon}</div>
                  <div className="flex-1">
                    <div className="font-semibold text-[var(--text-primary)]">{option.label}</div>
                    <div className="text-sm text-[var(--text-secondary)] mt-1">
                      {option.description[lang]}
                    </div>
                  </div>
                  {isSelected && (
                    <div className="w-5 h-5 rounded-full bg-[var(--theme-accent)] flex items-center justify-center">
                      <Check size={12} className="text-white" />
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleConfirm}
            className="flex-1 py-3 px-6 rounded-xl bg-[var(--theme-accent)] text-white font-medium hover:bg-[var(--theme-accent)]/90 transition-colors"
          >
            {t.confirm}
          </button>
          <button
            onClick={onClose}
            className="py-3 px-6 rounded-xl bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            {t.skip}
          </button>
        </div>
      </div>
    </div>
  );
};
