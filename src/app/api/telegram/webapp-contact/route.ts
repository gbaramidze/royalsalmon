import { NextResponse } from 'next/server';
import { getSharedContact, getWebAppUser } from '@/lib/telegramWebApp';
import { linkContact } from '@/lib/telegram';

export const dynamic = 'force-dynamic';

/**
 * Mini App phone check: instead of an OTP code the customer shares their Telegram contact.
 * Body: { initData, contact } — both strings come from Telegram.WebApp and are signed by Telegram.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const user = getWebAppUser(String(body?.initData || ''));
    if (!user) {
      return NextResponse.json({ success: false, error: 'Не удалось проверить данные Telegram' }, { status: 401 });
    }

    const phone = getSharedContact(String(body?.contact || ''), user.id);
    if (!phone) {
      return NextResponse.json({ success: false, error: 'Не удалось проверить номер из Telegram' }, { status: 400 });
    }

    // Order confirmations for this phone go to this chat (private chat id = user id)
    try {
      await linkContact(phone, user.id);
      if (user.username) await linkContact(`@${user.username.toLowerCase()}`, user.id);
    } catch (error) {
      console.error('Failed to link Telegram contact:', error);
    }

    return NextResponse.json({ success: true, verified: true, phone, name: user.firstName });
  } catch (error) {
    console.error('Error in webapp-contact:', error);
    return NextResponse.json({ success: false, error: 'Ошибка проверки номера' }, { status: 500 });
  }
}
