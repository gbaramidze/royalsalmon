import { check, getSupabase } from '@/lib/supabase';
import { normalizePhone } from '@/lib/orders';

export const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
export const TELEGRAM_BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'royalsalmon_bot';
// Public HTTPS origin of the site; Telegram only opens Mini App buttons over HTTPS
// Chat (or group) where staff receive customer complaints; complaints are only stored when unset
export const TELEGRAM_STAFF_CHAT_ID = process.env.TELEGRAM_STAFF_CHAT_ID || '';
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://royalsalmon.ge').replace(/\/+$/, '');

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;
const LAST_UPDATE_ID_KEY = 'telegram_last_update_id';

interface OtpSession {
  phone: string;
  code: string;
  chat_id: number | null;
  created_at: string;
  verified: boolean;
  attempts: number;
}

export function cleanPhoneNumber(phone: string): string {
  return normalizePhone(phone);
}

const ageMs = (timestamp: string) => Date.now() - Date.parse(timestamp);

async function getOtpSession(phone: string): Promise<OtpSession | null> {
  return check(await getSupabase().from('otp_sessions').select('*').eq('phone', phone).maybeSingle(), 'load otp session');
}

/** Chat linked to a phone number or @username */
async function getContactChatId(contact: string): Promise<number | null> {
  const row = check(
    await getSupabase().from('telegram_contacts').select('chat_id').eq('contact', contact).maybeSingle(),
    'load telegram contact'
  );
  return row?.chat_id ?? null;
}

async function linkContact(contact: string, chatId: number) {
  check(
    await getSupabase()
      .from('telegram_contacts')
      .upsert({ contact, chat_id: chatId, updated_at: new Date().toISOString() }),
    'save telegram contact'
  );
}

/** Chat that talked to the bot most recently, if within `maxAgeMs` */
async function getLatestChatId(maxAgeMs: number): Promise<number | null> {
  const row = check(
    await getSupabase()
      .from('telegram_chats')
      .select('chat_id, updated_at')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    'load latest telegram chat'
  );
  return row && ageMs(row.updated_at) < maxAgeMs ? row.chat_id : null;
}

/**
 * Send a message via Telegram Bot API
 */
export async function sendTelegramMessage(chatId: string | number, text: string, replyMarkup?: object) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        ...(replyMarkup ? { reply_markup: replyMarkup } : {})
      })
    });
    return await res.json();
  } catch (error) {
    console.error('Telegram sendMessage error:', error);
    return { ok: false, error: String(error) };
  }
}

/**
 * Send a photo via Telegram Bot API
 */
export async function sendTelegramPhoto(chatId: string | number, photo: Buffer, mimeType: string, caption?: string) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`;
  try {
    const form = new FormData();
    form.append('chat_id', String(chatId));
    if (caption) form.append('caption', caption);
    form.append('photo', new Blob([new Uint8Array(photo)], { type: mimeType }), 'photo');
    const res = await fetch(url, { method: 'POST', body: form });
    return await res.json();
  } catch (error) {
    console.error('Telegram sendPhoto error:', error);
    return { ok: false, error: String(error) };
  }
}

/**
 * Fetch updates from Telegram Bot API and automatically process /start interactions
 */
export async function syncBotUpdates(): Promise<void> {
  const db = getSupabase();

  try {
    const state = check(
      await db.from('bot_state').select('value').eq('key', LAST_UPDATE_ID_KEY).maybeSingle(),
      'load bot state'
    );
    let lastUpdateId = typeof state?.value === 'number' ? state.value : 0;

    const offsetParam = lastUpdateId ? `&offset=${lastUpdateId + 1}` : '';
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?limit=100${offsetParam}`;
    const res = await fetch(url, { cache: 'no-store' });
    const data = await res.json();
    if (!data?.ok || !Array.isArray(data.result) || data.result.length === 0) return;

    for (const update of data.result) {
      if (typeof update.update_id === 'number') {
        lastUpdateId = Math.max(lastUpdateId, update.update_id);
      }

      const msg = update.message;
      if (!msg || !msg.chat) continue;

      const chatId: number = msg.chat.id;
      const username: string | undefined = msg.chat.username;
      const firstName: string = msg.chat.first_name || 'Customer';
      const text = (msg.text || '').trim();

      // Record the chat
      const existing = check(
        await db.from('telegram_chats').select('chat_id').eq('chat_id', chatId).maybeSingle(),
        'load telegram chat'
      );
      const isNewChat = !existing;
      check(
        await db.from('telegram_chats').upsert({
          chat_id: chatId,
          username: username || null,
          first_name: firstName,
          updated_at: new Date().toISOString(),
        }),
        'save telegram chat'
      );

      if (username) {
        await linkContact(`@${username.toLowerCase()}`, chatId);
      }

      // Handle /start commands (e.g. /start or /start rs_1234 or /start 1234)
      if (text.startsWith('/start')) {
        const startArg = text.split(/\s+/)[1] || '';

        const activeSessions: OtpSession[] = check(
          await db
            .from('otp_sessions')
            .select('*')
            .gte('created_at', new Date(Date.now() - OTP_TTL_MS).toISOString())
            .order('created_at', { ascending: false }),
          'load active otp sessions'
        ) ?? [];

        // Look for the matching session, else a recent unverified one within the last 5 minutes
        const session =
          (startArg && activeSessions.find(s => startArg.includes(s.code) || startArg.includes(s.phone))) ||
          activeSessions.find(s => !s.verified && ageMs(s.created_at) < 5 * 60 * 1000);

        if (session) {
          check(
            await db.from('otp_sessions').update({ chat_id: chatId }).eq('phone', session.phone),
            'link otp session to chat'
          );
          await linkContact(session.phone, chatId);

          // Send OTP directly
          await sendTelegramMessage(chatId,
            `👑 <b>Royal Salmon</b>\n\n` +
            `Ваш код верификации: <b>${session.code}</b>\n\n` +
            `Введите его на сайте для завершения оформления заказа.`
          );
        } else if (isNewChat) {
          // Welcome only the first time this chat talks to the bot
          await sendTelegramMessage(chatId,
            `👑 <b>Royal Salmon Bot</b>\n\n` +
            `Здравствуйте, ${firstName}! Ваш Telegram успешно подключен.\n` +
            `Теперь вы можете получать коды верификации для заказов в Royal Salmon прямо сюда.`
          );
        }
      }
    }

    check(
      await db.from('bot_state').upsert({ key: LAST_UPDATE_ID_KEY, value: lastUpdateId }),
      'save bot state'
    );
  } catch (error) {
    console.error('Error syncing bot updates:', error);
  }
}

/**
 * Request OTP for a phone number
 */
export async function requestOtp(rawPhone: string, method: 'telegram' | 'sms' = 'telegram') {
  const phone = cleanPhoneNumber(rawPhone);
  if (!phone || phone.length < 5) {
    throw new Error('Укажите корректный номер телефона');
  }

  // First sync latest bot updates to register any new chats
  await syncBotUpdates();

  // Generate 4-digit code
  const code = String(Math.floor(1000 + Math.random() * 9000));

  const saveSession = async (chatId: number | null) =>
    check(
      await getSupabase().from('otp_sessions').upsert({
        phone,
        code,
        chat_id: chatId,
        created_at: new Date().toISOString(),
        verified: false,
        attempts: 0,
      }),
      'save otp session'
    );

  if (method === 'sms') {
    await saveSession(null);

    return {
      success: true,
      phone,
      code, // returned for SMS confirmation and demo hint
      method: 'sms',
      message: `Код подтверждения отправлен по СМС на номер ${phone}`
    };
  }

  // Known chat for this phone, else a chat that wrote to the bot within the last 2 hours
  const chatId = (await getContactChatId(phone)) ?? (await getLatestChatId(2 * 60 * 60 * 1000));
  await saveSession(chatId);

  let sentDirectly = false;
  if (chatId) {
    const tgRes = await sendTelegramMessage(chatId,
      `👑 <b>Royal Salmon</b>\n\n` +
      `Ваш код верификации для заказа: <b>${code}</b>\n\n` +
      `Номер телефона: ${phone}\n` +
      `Введите этот код на сайте Royal Salmon для подтверждения аккаунта.`
    );
    if (tgRes?.ok) {
      sentDirectly = true;
    }
  }

  const deepLink = `https://t.me/${TELEGRAM_BOT_USERNAME}?start=rs_${code}`;

  return {
    success: true,
    phone,
    code, // returned so client/demo can display hint if needed
    sentDirectly,
    method: 'telegram',
    botUsername: TELEGRAM_BOT_USERNAME,
    deepLink,
    message: sentDirectly
      ? 'Код отправлен в ваш Telegram!'
      : 'Откройте бота @' + TELEGRAM_BOT_USERNAME + ' для получения кода'
  };
}

/**
 * Verify OTP for a phone number
 */
export async function verifyOtp(rawPhone: string, codeToVerify: string) {
  const phone = cleanPhoneNumber(rawPhone);
  const inputCode = codeToVerify.trim();
  const db = getSupabase();

  const session = await getOtpSession(phone);
  if (!session) {
    return {
      success: false,
      error: 'Код не был запрошен. Нажмите «Запросить код»'
    };
  }

  if (ageMs(session.created_at) > OTP_TTL_MS) {
    return {
      success: false,
      error: 'Срок действия кода истек. Запросите новый код.'
    };
  }

  if (session.attempts >= MAX_OTP_ATTEMPTS) {
    return {
      success: false,
      error: 'Слишком много неверных попыток. Запросите новый код.'
    };
  }

  // 7777 is a test code for development only
  const isTestCode = inputCode === '7777' && process.env.NODE_ENV !== 'production';

  if (session.code === inputCode || isTestCode) {
    check(await db.from('otp_sessions').update({ verified: true }).eq('phone', phone), 'verify otp session');

    // Send confirmation in telegram if chatId is known
    if (session.chat_id) {
      await sendTelegramMessage(session.chat_id,
        `✅ <b>Royal Salmon</b>: Номер ${phone} успешно верифицирован!\nСпасибо за заказ!`
      );
    }

    return {
      success: true,
      verified: true,
      message: 'Номер успешно подтвержден!'
    };
  }

  check(
    await db.from('otp_sessions').update({ attempts: session.attempts + 1 }).eq('phone', phone),
    'count otp attempt'
  );

  return {
    success: false,
    error: 'Неверный проверочный код. Проверьте Telegram и попробуйте снова.'
  };
}

/**
 * Check verification status
 */
export async function checkOtpStatus(rawPhone: string) {
  const session = await getOtpSession(cleanPhoneNumber(rawPhone));

  return {
    verified: Boolean(session?.verified),
    hasActiveSession: Boolean(session && ageMs(session.created_at) < OTP_TTL_MS),
    sentDirectly: Boolean(session?.chat_id)
  };
}

export interface OrderNotificationData {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  deliveryType: 'delivery' | 'pickup';
  address: string;
  coordinates?: { lat: number; lng: number };
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    modifiersDescription?: string;
  }>;
  subtotal: number;
  deliveryFee: number;
  tax: number;
  total: number;
  paymentMethod: string;
  paymentStatus: string;
  notes?: string;
}

/**
 * Send order confirmation notification to user's Telegram chat
 */
export async function sendOrderNotification(order: OrderNotificationData) {
  const phone = cleanPhoneNumber(order.customerPhone);

  // Chat linked to this phone, else the chat that talked to the bot within the last day
  const chatId =
    (await getContactChatId(phone)) ??
    (await getOtpSession(phone))?.chat_id ??
    (await getLatestChatId(24 * 60 * 60 * 1000));

  if (!chatId) {
    console.warn(`No Telegram chatId found for customer phone ${phone}`);
    return { ok: false, error: 'Chat ID not found' };
  }

  const itemsList = order.items
    .map(it => `• <b>${it.name}</b> x${it.quantity} — ${(it.price * it.quantity).toFixed(2)} GEL${it.modifiersDescription ? ` (соус: ${it.modifiersDescription})` : ''}`)
    .join('\n');

  const mapsLink = order.coordinates 
    ? `\n📍 <b>Точка на карте:</b> <a href="https://maps.google.com/?q=${order.coordinates.lat},${order.coordinates.lng}">Открыть в Google Maps</a>`
    : '';

  const deliveryText = order.deliveryType === 'delivery' 
    ? `🛵 <b>Доставка:</b> ${order.address}${mapsLink}` 
    : `🛍️ <b>Самовывоз:</b> ${order.address}`;

  const paymentMethodLabel = order.paymentMethod === 'cash' ? 'Наличные' : 'Картой';

  const text = 
    `👑 <b>Royal Salmon — Заказ успешно оформлен!</b>\n\n` +
    `Номер заказа: <b>#${order.orderNumber}</b>\n` +
    `Клиент: <b>${order.customerName}</b>\n` +
    `Телефон: <code>${order.customerPhone}</code>\n\n` +
    `🍣 <b>Состав заказа:</b>\n${itemsList}\n\n` +
    `💰 <b>Сумма блюд:</b> ${order.subtotal.toFixed(2)} GEL\n` +
    (order.deliveryFee > 0 ? `📦 <b>Доставка:</b> ${order.deliveryFee.toFixed(2)} GEL\n` : `📦 <b>Доставка:</b> Бесплатно\n`) +
    `🧾 <b>ИТОГО К ОПЛАТЕ:</b> <b>${order.total.toFixed(2)} GEL</b>\n\n` +
    `${deliveryText}\n` +
    `💳 <b>Способ оплаты:</b> ${paymentMethodLabel} (${order.paymentStatus === 'paid' ? 'Оплачено ✅' : 'Ожидает оплаты ⏳'})\n` +
    (order.notes ? `📝 <b>Комментарий:</b> ${order.notes}\n\n` : `\n`) +
    `⏱ <i>Примерное время готовности/доставки: 35–50 минут.</i>\n` +
    `Спасибо за заказ в Royal Salmon! Приятного аппетита! 🥢🍣`;

  // Both buttons open the tracking page as a Telegram Mini App
  const trackingUrl = `${SITE_URL}/tracking/${encodeURIComponent(order.id)}`;
  const replyMarkup = {
    inline_keyboard: [
      [{ text: '📍 ГДЕ МОЙ ЗАКАЗ', web_app: { url: trackingUrl } }],
      [{ text: '✏️ ИЗМЕНИТЬ ЗАКАЗ', web_app: { url: `${trackingUrl}?edit=1` } }]
    ]
  };

  return await sendTelegramMessage(chatId, text, replyMarkup);
}

