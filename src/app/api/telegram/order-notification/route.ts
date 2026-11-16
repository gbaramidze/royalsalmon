import { NextResponse } from 'next/server';
import { sendOrderNotification } from '@/lib/telegram';
import { saveOrder } from '@/lib/orders';
import { DELIVERY_ENABLED } from '@/lib/promos';
import { normalizeOrder, OrderValidationError, sendOrderToPos } from '@/lib/posOrders';
import { Order } from '@/types';
import { getWebAppUser } from '@/lib/telegramWebApp';

export const dynamic = 'force-dynamic';

/**
 * Place a site order: re-price it, send it to the restaurant POS (RestIQ),
 * keep it for the tracking page and confirm it to the customer in Telegram.
 */
export async function POST(req: Request) {
  try {
    const orderData = await req.json();

    if (!orderData?.id || !orderData?.orderNumber || !orderData?.customerPhone || !Array.isArray(orderData?.items)) {
      return NextResponse.json({
        success: false,
        error: 'Order data is missing required fields'
      }, { status: 400 });
    }

    if (!DELIVERY_ENABLED && orderData.deliveryType === 'delivery') {
      return NextResponse.json({
        success: false,
        error: 'Доставка временно недоступна, доступен только самовывоз'
      }, { status: 400 });
    }

    // Placed from the bot's Mini App: Telegram-signed user, confirmation goes straight to their chat
    const { telegramInitData, ...orderFields } = orderData;
    const telegramUser = typeof telegramInitData === 'string' ? getWebAppUser(telegramInitData) : null;

    const order: Order = { ...(await normalizeOrder(orderFields)), status: 'new' };
    if (telegramUser) {
      const tgLine = `Telegram: ${telegramUser.username ? '@' + telegramUser.username : 'id ' + telegramUser.id}`;
      order.notes = order.notes ? `${order.notes}\n${tgLine}` : tgLine;
    }

    // 1. POS: this is how the restaurant learns about the order
    const pos = await sendOrderToPos(order);

    // 2. Order store for the tracking page (a failure here must not lose the POS order)
    let saved = false;
    try {
      await saveOrder(order);
      saved = true;
    } catch (error) {
      console.error('Failed to save order:', error);
    }

    // The restaurant has the order if the POS took it; without a POS key, if it was saved
    const accepted = pos.ok || (Boolean(pos.skipped) && saved);
    if (!accepted) {
      return NextResponse.json({
        success: false,
        error: 'Не удалось передать заказ в ресторан. Попробуйте ещё раз или позвоните нам.',
        pos
      }, { status: 502 });
    }

    // 3. Customer confirmation in Telegram (best effort)
    let telegram: unknown = null;
    try {
      telegram = await sendOrderNotification(order, telegramUser?.id);
    } catch (error) {
      console.error('Failed to send Telegram order notification:', error);
    }

    return NextResponse.json({ success: true, order, pos, saved, telegram });
  } catch (error) {
    if (error instanceof OrderValidationError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    console.error('Error placing order:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
