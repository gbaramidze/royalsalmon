import crypto from 'crypto';
import { NextResponse } from 'next/server';

export const ADMIN_PASSWORD_HEADER = 'x-admin-password';

/**
 * Admin endpoints expose customer data, so they require ADMIN_PASSWORD.
 * Returns an error response to send back, or null when the request may proceed.
 */
export function requireAdmin(req: Request): NextResponse | null {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    return NextResponse.json({ success: false, error: 'ADMIN_PASSWORD is not set on the server' }, { status: 503 });
  }

  const expected = crypto.createHash('sha256').update(password).digest();
  const given = crypto.createHash('sha256').update(req.headers.get(ADMIN_PASSWORD_HEADER) || '').digest();
  if (!crypto.timingSafeEqual(expected, given)) {
    return NextResponse.json({ success: false, error: 'Неверный пароль администратора' }, { status: 401 });
  }
  return null;
}
