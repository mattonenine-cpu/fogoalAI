import type { TelegramAuthPayload } from './authService';

/** Имя бота для Telegram Login Widget. Задайте VITE_TELEGRAM_BOT в .env (без @). */
const BOT_NAME = typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_TELEGRAM_BOT || 'FoGoalBot';

/**
 * Читает параметры Telegram из URL (callback после Telegram Login Widget).
 */
export function parseTelegramCallbackFromUrl(): (TelegramAuthPayload & { link?: boolean }) | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  const first_name = params.get('first_name');
  if (!id || !first_name) return null;
  const payload: TelegramAuthPayload & { link?: boolean } = {
    id: Number(id),
    first_name,
    last_name: params.get('last_name') || undefined,
    username: params.get('username') || undefined,
    photo_url: params.get('photo_url') || undefined,
    auth_date: params.get('auth_date') ? Number(params.get('auth_date')) : undefined,
    hash: params.get('hash') || undefined
  };
  if (params.get('link') === '1') payload.link = true;
  return payload;
}

/**
 * Пользователь из Telegram Web App (приложение открыто внутри Telegram).
 */
export function getTelegramUserFromWebApp(): TelegramAuthPayload | null {
  const w = (window as any).Telegram?.WebApp?.initDataUnsafe?.user;
  if (!w) return null;
  return {
    id: w.id,
    first_name: w.first_name || '',
    last_name: w.last_name,
    username: w.username,
    photo_url: w.photo_url
  };
}

/**
 * URL для редиректа после авторизации в виджете (link=1 для привязки, без — для входа).
 */
export function getTelegramCallbackUrl(mode: 'link' | 'login'): string {
  const origin = typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '';
  return mode === 'link' ? `${origin}?link=1` : origin;
}

export function getTelegramBotName(): string {
  return BOT_NAME;
}
