import React, { useEffect, useRef } from 'react';
import { getTelegramCallbackUrl, getTelegramBotName } from '../services/telegramAuth';

type Mode = 'link' | 'login';

interface TelegramAuthWidgetProps {
  mode: Mode;
  onCancel?: () => void;
  lang?: 'en' | 'ru';
}

export const TelegramAuthWidget: React.FC<TelegramAuthWidgetProps> = ({ mode, onCancel, lang = 'ru' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const botName = getTelegramBotName();
  const authUrl = getTelegramCallbackUrl(mode);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', botName || '');
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-auth-url', authUrl || '');
    script.setAttribute('data-request-access', 'write');

    container.innerHTML = '';
    container.appendChild(script);

    return () => {
      script.remove();
    };
  }, [mode, botName, authUrl]);

  return (
    <div className="flex flex-col items-center justify-center gap-6 p-8">
      <p className="text-[var(--text-secondary)] text-center text-sm">
        {mode === 'link'
          ? (lang === 'ru' ? 'Нажмите кнопку ниже, чтобы привязать аккаунт Telegram.' : 'Click the button below to link your Telegram account.')
          : (lang === 'ru' ? 'Войдите через Telegram, чтобы сохранять прогресс на всех устройствах.' : 'Log in with Telegram to sync progress across devices.')}
      </p>
      <div ref={containerRef} className="min-h-[44px]" />
      
      <div className="text-center">
        <p className="text-[10px] text-[var(--text-secondary)] mb-2">If the widget doesn't work, open the bot in Telegram:</p>
        <a
          href={`https://t.me/${botName}?start=${mode === 'link' ? 'link' : 'login'}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block px-4 py-2 bg-[var(--bg-card)] rounded text-sm text-[var(--text-primary)] border border-[var(--border-glass)]"
        >
          Open in Telegram
        </a>
      </div>
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-sm underline"
        >
          {lang === 'ru' ? 'Отмена' : 'Cancel'}
        </button>
      )}
    </div>
  );
};
