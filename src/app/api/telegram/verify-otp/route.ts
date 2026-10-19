import { NextResponse } from 'next/server';
import { verifyOtp } from '@/lib/telegram';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const phone = body?.phone;
    const code = body?.code;

    if (!phone || !code) {
      return NextResponse.json({
        success: false,
        error: 'Номер телефона и проверочный код обязательны'
      }, { status: 400 });
    }

    const result = await verifyOtp(phone, code);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in verify-otp:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка валидации кода'
    }, { status: 500 });
  }
}
