import { NextResponse } from 'next/server';
import { requestOtp, syncBotUpdates, checkOtpStatus } from '@/lib/telegram';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const phone = body?.phone;
    const method = body?.method === 'sms' ? 'sms' : 'telegram';

    if (!phone || typeof phone !== 'string') {
      return NextResponse.json({
        success: false,
        error: 'Номер телефона обязателен'
      }, { status: 400 });
    }

    const result = await requestOtp(phone, method);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in send-otp:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Не удалось отправить код'
    }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const phone = url.searchParams.get('phone');
    if (!phone) {
      return NextResponse.json({ success: false, error: 'Phone param required' }, { status: 400 });
    }

    // Check updates from telegram bot
    await syncBotUpdates();
    const status = await checkOtpStatus(phone);

    return NextResponse.json({
      success: true,
      ...status
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
