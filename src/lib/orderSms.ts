// Customer SMS about an order: placed, on its way / ready for pickup, cancelled.
// Best effort: a failed SMS is logged and never fails the order flow.
import { Order } from '@/types';
import { formatGeorgianPhone, sendSms } from '@/lib/sms';

export type OrderSmsEvent = 'placed' | 'on_the_way' | 'cancelled';

type OrderSmsData = Pick<Order, 'id' | 'orderNumber' | 'customerPhone' | 'deliveryType' | 'total'> & {
  etaMinutes?: number;
};

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://royalsalmon.ge').replace(/\/+$/, '');

export function orderSmsText(event: OrderSmsEvent, order: OrderSmsData): string {
  const num = `#${order.orderNumber}`;
  const trackingUrl = `${SITE_URL}/tracking/${encodeURIComponent(order.id)}`;
  switch (event) {
    case 'placed':
      return `Royal Salmon: заказ ${num} принят, ${order.total.toFixed(2)} GEL. Статус: ${trackingUrl}`;
    case 'on_the_way':
      return order.deliveryType === 'pickup'
        ? `Royal Salmon: заказ ${num} готов, можно забирать!`
        : `Royal Salmon: курьер выехал с заказом ${num}` +
            (order.etaMinutes ? `, ~${order.etaMinutes} мин.` : '.') +
            ` ${trackingUrl}`;
    case 'cancelled':
      return `Royal Salmon: заказ ${num} отменён. Вопросы по телефону ресторана.`;
  }
}

export async function sendOrderSms(event: OrderSmsEvent, order: OrderSmsData): Promise<boolean> {
  // Foreign numbers: no SMS, the customer still has the tracking page and Telegram
  if (!formatGeorgianPhone(order.customerPhone)) return false;
  try {
    const res = await sendSms(order.customerPhone, orderSmsText(event, order));
    if (!res.success) console.error(`Order SMS "${event}" failed for #${order.orderNumber}:`, res.error);
    return res.success;
  } catch (error) {
    console.error(`Order SMS "${event}" error for #${order.orderNumber}:`, error);
    return false;
  }
}
