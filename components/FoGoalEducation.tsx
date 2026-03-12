import React, { useState } from 'react';
import { Language, TRANSLATIONS } from '../types';
import { Mascot } from './Mascot';
import { Logo } from './Logo';

interface FoGoalEducationProps {
  lang: Language;
  onFinish: () => void;
}

const STEP_COUNT = 4;

export const FoGoalEducation: React.FC<FoGoalEducationProps> = ({ lang, onFinish }) => {
  const t = TRANSLATIONS[lang] || TRANSLATIONS['en'];
  const [step, setStep] = useState(1);

  const handleNext = () => {
    if (step < STEP_COUNT) {
      setStep(step + 1);
    } else {
      onFinish();
    }
  };

  const handleSkip = () => {
    onFinish();
  };

  const titles: string[] = [
    t.eduTitle1,
    t.eduTitle2,
    t.eduTitle3,
    t.eduTitle4,
  ];

  const subtitles: string[] = [
    t.eduSubtitle1,
    t.eduSubtitle2,
    t.eduSubtitle3,
    t.eduSubtitle4,
  ];

  const renderPills = () => {
    if (step === 2) {
      return (
        <div className="flex flex-wrap gap-1.5 justify-center mt-3">
          {['🏠 Dashboard', '📅 Scheduler', '🧩 Smart Planner'].map(label => (
            <span
              key={label}
              className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[9px] font-semibold text-[var(--text-secondary)]"
            >
              {label}
            </span>
          ))}
        </div>
      );
    }
    if (step === 3) {
      return (
        <div className="flex flex-wrap gap-1.5 justify-center mt-3">
          {['💪 Sport', '📚 Study', '❤️ Health'].map(label => (
            <span
              key={label}
              className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[9px] font-semibold text-[var(--text-secondary)]"
            >
              {label}
            </span>
          ))}
        </div>
      );
    }
    if (step === 4) {
      return (
        <div className="flex flex-wrap gap-1.5 justify-center mt-3">
          {['💬 FoGoal', '📝 Notes'].map(label => (
            <span
              key={label}
              className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[9px] font-semibold text-[var(--text-secondary)]"
            >
              {label}
            </span>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="fixed inset-0 z-[650] flex items-center justify-center px-4 pointer-events-auto">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-2xl" />

      <div className="relative w-full max-w-sm">
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 opacity-80">
          <Logo height={36} />
        </div>

        <div className="relative rounded-[40px] bg-[var(--bg-card)] border border-[var(--border-glass)] shadow-[0_22px_60px_rgba(0,0,0,0.6)] overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-24 -left-10 w-40 h-40 bg-[var(--theme-accent)]/30 blur-3xl" />
            <div className="absolute -bottom-20 right-0 w-44 h-44 bg-white/10 blur-3xl" />
          </div>

          <div className="relative px-6 pt-5 pb-5 flex flex-col gap-4">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Mascot size={40} mood="Good" level={1} />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)]">
                  FoGoal Guide
                </span>
              </div>

              <button
                type="button"
                onClick={handleSkip}
                className="text-[9px] font-bold uppercase tracking-[0.18em] text-[var(--text-secondary)] hover:text-[var(--text-primary)] px-2 py-1 rounded-full bg-black/5 border border-white/10"
              >
                {t.eduSkipAll}
              </button>
            </div>

            <div className="mt-1 text-center">
              <h2 className="text-[18px] font-black tracking-tight text-[var(--text-primary)] mb-2">
                {titles[step - 1]}
              </h2>
              <p className="text-[12px] leading-snug text-[var(--text-secondary)] max-w-xs mx-auto">
                {subtitles[step - 1]}
              </p>
              {renderPills()}
            </div>

            <div className="flex items-center justify-between mt-4">
              <div className="flex gap-1.5">
                {Array.from({ length: STEP_COUNT }).map((_, index) => {
                  const current = index + 1;
                  const active = current === step;
                  return (
                    <div
                      key={current}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        active ? 'w-6 bg-[var(--bg-active)]' : 'w-2 bg-white/15'
                      }`}
                    />
                  );
                })}
              </div>

              <button
                type="button"
                onClick={handleNext}
                className="px-4 py-2 rounded-full bg-[var(--bg-active)] text-[var(--bg-active-text)] text-[11px] font-black uppercase tracking-[0.18em] shadow-lg active:scale-95 transition-transform"
              >
                {step === STEP_COUNT ? t.eduDone : t.eduNext}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FoGoalEducation;

