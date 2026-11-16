import { createHmac, timingSafeEqual } from 'crypto';
import { TELEGRAM_BOT_TOKEN } from '@/lib/telegram';

/**
 * Server-side checks for data handed to the site by the Telegram Mini App.
 * Telegram signs it with the bot token, so a valid hash proves it came from Telegram for this bot.
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */

/** initData older than this is rejected (the Mini App was opened too long ago) */
const MAX_AGE_SECONDS = 24 * 60 * 60;

export interface TelegramWebAppUser {
  id: number;
  firstName: string;
  username?: string;
}

/** Parsed fields of a correctly signed, fresh Telegram payload; null otherwise */
function validateSigned(raw: string): URLSearchParams | null {
  if (!raw || !TELEGRAM_BOT_TOKEN) return null;
  const params = new URLSearchParams(raw);
  const hash = params.get('hash');
  if (!hash || !/^[0-9a-f]{64}$/.test(hash)) return null;

  const dataCheckString = [...params.entries()]
    .filter(([key]) => key !== 'hash')
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secret = createHmac('sha256', 'WebAppData').update(TELEGRAM_BOT_TOKEN).digest();
  const expected = createHmac('sha256', secret).update(dataCheckString).digest();
  if (!timingSafeEqual(expected, Buffer.from(hash, 'hex'))) return null;

  const authDate = Number(params.get('auth_date'));
  if (!authDate || Date.now() / 1000 - authDate > MAX_AGE_SECONDS) return null;

  return params;
}

function parseJson<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

/** The Telegram user who opened the Mini App (`Telegram.WebApp.initData`) */
export function getWebAppUser(initData: string): TelegramWebAppUser | null {
  const params = validateSigned(initData);
  const user = parseJson<{ id?: number; first_name?: string; username?: string }>(params?.get('user') ?? null);
  if (!user?.id) return null;
  return { id: user.id, firstName: user.first_name || '', username: user.username };
}

/**
 * Phone number the user shared with `Telegram.WebApp.requestContact` (the signed `response` string).
 * Returned with a leading "+"; null if the signature is wrong or the contact isn't this user's own.
 */
export function getSharedContact(contactResponse: string, userId: number): string | null {
  const params = validateSigned(contactResponse);
  const contact = parseJson<{ phone_number?: string; user_id?: number }>(params?.get('contact') ?? null);
  if (!contact?.phone_number || contact.user_id !== userId) return null;
  const digits = contact.phone_number.replace(/[^\d]/g, '');
  return digits ? `+${digits}` : null;
}
