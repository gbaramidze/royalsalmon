import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import {
  addOrderComplaint,
  getOrder,
  MAX_COMPLAINTS_PER_ORDER,
  OrderComplaint,
  saveComplaintPhoto,
  toTrackingView,
} from '@/lib/orders';
import { sendTelegramMessage, sendTelegramPhoto, TELEGRAM_STAFF_CHAT_ID } from '@/lib/telegram';

export const dynamic = 'force-dynamic';

const MAX_PHOTOS = 3;
const MAX_PHOTO_BYTES = 6 * 1024 * 1024;
const MAX_DESCRIPTION_LENGTH = 1000;
const PHOTO_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const escapeHtml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Customer report about a delivered order: multipart form with `description`, `items` (indexes) and `photos`
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await getOrder(id);
  if (!order) {
    return NextResponse.json({ success: false, error: 'Заказ не найден' }, { status: 404 });
  }
  if (order.status !== 'completed') {
    return NextResponse.json({ success: false, error: 'Сообщить о проблеме можно после получения заказа' }, { status: 409 });
  }
  if (order.complaintsCount >= MAX_COMPLAINTS_PER_ORDER) {
    return NextResponse.json({ success: false, error: 'По этому заказу уже отправлено несколько обращений — позвоните нам' }, { status: 429 });
  }

  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ success: false, error: 'Некорректный запрос' }, { status: 400 });
  }

  const description = String(form.get('description') || '').trim().slice(0, MAX_DESCRIPTION_LENGTH);
  if (description.length < 5) {
    return NextResponse.json({ success: false, error: 'Опишите, что не так' }, { status: 400 });
  }

  // Positions are sent as indexes so only real items of this order can be flagged
  const itemNames = [...new Set(form.getAll('items').map(v => Number(v)))]
    .filter(i => Number.isInteger(i) && i >= 0 && i < order.items.length)
    .map(i => order.items[i].name);

  const files = form.getAll('photos').filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length > MAX_PHOTOS) {
    return NextResponse.json({ success: false, error: `Можно прикрепить не больше ${MAX_PHOTOS} фото` }, { status: 400 });
  }
  for (const file of files) {
    if (!PHOTO_EXTENSIONS[file.type]) {
      return NextResponse.json({ success: false, error: 'Фото должно быть в формате JPG, PNG или WebP' }, { status: 400 });
    }
    if (file.size > MAX_PHOTO_BYTES) {
      return NextResponse.json({ success: false, error: 'Фото слишком большое (до 6 МБ)' }, { status: 400 });
    }
  }

  const complaintId = randomUUID();
  const photos: Array<{ content: Buffer; type: string; path: string }> = [];
  for (const [index, file] of files.entries()) {
    const content = Buffer.from(await file.arrayBuffer());
    const photoPath = await saveComplaintPhoto(complaintId, index, PHOTO_EXTENSIONS[file.type], file.type, content);
    photos.push({ content, type: file.type, path: photoPath });
  }

  const complaint: OrderComplaint = {
    id: complaintId,
    createdAt: new Date().toISOString(),
    items: itemNames,
    description,
    photos: photos.map(p => p.path),
  };
  const updated = await addOrderComplaint(id, complaint);
  if (!updated) {
    return NextResponse.json({ success: false, error: 'Заказ не найден' }, { status: 404 });
  }

  // Forward to the staff chat when one is configured
  if (TELEGRAM_STAFF_CHAT_ID) {
    await sendTelegramMessage(
      TELEGRAM_STAFF_CHAT_ID,
      `⚠️ <b>Жалоба по заказу #${escapeHtml(order.orderNumber)}</b>\n\n` +
      `Клиент: <b>${escapeHtml(order.customerName)}</b>\n` +
      `Телефон: <code>${escapeHtml(order.customerPhone)}</code>\n` +
      (itemNames.length ? `Позиции:\n${itemNames.map(n => `• ${escapeHtml(n)}`).join('\n')}\n` : '') +
      `\n📝 ${escapeHtml(description)}` +
      (photos.length ? `\n\n📷 Фото: ${photos.length}` : '')
    );
    for (const photo of photos) {
      await sendTelegramPhoto(TELEGRAM_STAFF_CHAT_ID, photo.content, photo.type, `Заказ #${order.orderNumber}`);
    }
  }

  return NextResponse.json({ success: true, order: toTrackingView(updated) });
}
