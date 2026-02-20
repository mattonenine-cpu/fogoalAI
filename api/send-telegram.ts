/**
 * Sends a text message to a Telegram user (chat_id = telegram user id in private chat).
 * POST body: { telegramId: number, text: string }
 * Env: TELEGRAM_BOT_TOKEN
 */
declare const process: { env: { [key: string]: string | undefined } };

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return res.status(500).json({
      error: 'TELEGRAM_BOT_TOKEN is not set. Add it in Vercel → Settings → Environment Variables.',
    });
  }

  try {
    const { telegramId, text } = req.body || {};
    if (telegramId == null || typeof text !== 'string') {
      return res.status(400).json({ error: 'Body must include telegramId (number) and text (string).' });
    }
    const chatId = Number(telegramId);
    if (!Number.isFinite(chatId)) {
      return res.status(400).json({ error: 'telegramId must be a number.' });
    }

    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text.slice(0, 4096),
        disable_web_page_preview: true,
      }),
    });

    const data = await response.json();
    if (!data.ok) {
      console.error('Telegram API error:', data);
      return res.status(400).json({ error: data.description || 'Telegram API error', ok: false });
    }
    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error('send-telegram error:', err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}
