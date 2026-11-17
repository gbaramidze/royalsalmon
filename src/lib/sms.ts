// SMS sending through smsoffice.ge (same provider as FitHouse).
// Env: SMSOFFICE_API_KEY (required), SMS_SENDER_NAME (defaults to RoyalSalmon, must be registered at smsoffice.ge).

const SMSOFFICE_URL = 'https://smsoffice.ge/api/v2/send/';
const DEFAULT_SENDER = 'RoyalSalmon';

export type SmsResult = { success: true } | { success: false; error: string };

/** Georgian number in 995XXXXXXXXX form, or null when it is not one */
export function formatGeorgianPhone(rawPhone: string): string | null {
  const digits = rawPhone.replace(/\D/g, '');
  if (digits.length === 9 && digits.startsWith('5')) return '995' + digits;
  if (digits.length === 12 && digits.startsWith('995')) return digits;
  return null;
}

export async function sendSms(rawPhone: string, content: string): Promise<SmsResult> {
  const apiKey = process.env.SMSOFFICE_API_KEY?.trim();
  if (!apiKey) return { success: false, error: 'SMSOFFICE_API_KEY is not configured' };

  const destination = formatGeorgianPhone(rawPhone);
  if (!destination) return { success: false, error: 'Unsupported phone number' };

  const params = new URLSearchParams({
    key: apiKey,
    destination,
    sender: process.env.SMS_SENDER_NAME?.trim() || DEFAULT_SENDER,
    content,
    urgent: 'true',
  });

  try {
    const res = await fetch(`${SMSOFFICE_URL}?${params}`, { cache: 'no-store' });
    const text = await res.text();
    let parsed: { Success?: boolean; Message?: string; ErrorCode?: number } | null = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      // non-JSON body, reported below
    }
    if (parsed?.Success === true) return { success: true };
    const error = parsed?.Message || `HTTP ${res.status}: ${text.slice(0, 200)}`;
    console.error('smsoffice send failed:', { destination, errorCode: parsed?.ErrorCode, error });
    return { success: false, error };
  } catch (err) {
    console.error('smsoffice request error:', err);
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
