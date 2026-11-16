import { Order } from '@/types';
import { fetchLiveMenu } from '@/lib/api';
import { GIFT_ROLL_FROM, getDeliveryFee } from '@/lib/promos';

/**
 * RestIQ Online Orders API: sends site orders to the restaurant's POS terminals.
 * The key identifies the tenant and is a secret, so this module is server-only.
 */
const POS_ORDERS_URL = 'https://api.restiq.ge/functions/v1/online-orders';
const RESTIQ_API_KEY = process.env.RESTIQ_API_KEY || '';

const round2 = (value: number) => Math.round(value * 100) / 100;

/** Line added to the order when it qualifies for the gift roll (the restaurant picks the roll) */
export const GIFT_NOTE = `🎁 Подарок: 1 ролл на выбор ресторана (заказ от ${GIFT_ROLL_FROM} GEL)`;

export class OrderValidationError extends Error {}

/**
 * Re-price the order from the live menu so the browser can't change prices,
 * recompute the delivery fee and totals, and mark the gift roll.
 * Nothing is paid on the site yet, so the order is always "pending" payment.
 */
export async function normalizeOrder(order: Order): Promise<Order> {
  const categories = await fetchLiveMenu();
  const menuPrices = new Map<string, number>();
  for (const category of categories) {
    for (const item of category.items) {
      menuPrices.set(item.itemId, item.itemSizes[0]?.prices[0]?.price ?? 0);
    }
  }
  if (menuPrices.size === 0) {
    // Menu is unreachable: keep the browser prices (POS staff see the sum before confirming)
    console.warn('Live menu unavailable, order prices not verified:', order.id);
  }

  const items = order.items.map(item => {
    const quantity = Math.floor(item.quantity);
    if (!(quantity > 0 && quantity <= 999)) throw new OrderValidationError(`Некорректное количество: ${item.name}`);
    if (menuPrices.size === 0) return { ...item, quantity };
    const price = menuPrices.get(item.itemId);
    if (price === undefined) throw new OrderValidationError(`Блюдо больше недоступно: ${item.name}`);
    return { ...item, price, quantity };
  });
  if (items.length === 0) throw new OrderValidationError('Корзина пуста');

  const subtotal = round2(items.reduce((sum, item) => sum + item.price * item.quantity, 0));
  const deliveryFee = getDeliveryFee(order.deliveryType, subtotal);
  const customerNotes = (order.notes || '').trim();

  return {
    ...order,
    items,
    subtotal,
    deliveryFee,
    tax: Number((subtotal * 0.18).toFixed(1)),
    total: round2(subtotal + deliveryFee),
    paymentStatus: 'pending',
    notes: [customerNotes, subtotal >= GIFT_ROLL_FROM ? GIFT_NOTE : ''].filter(Boolean).join('\n') || undefined,
  };
}

export interface PosOrderResult {
  ok: boolean;
  skipped?: boolean;
  orderId?: string;
  status?: string;
  total?: number;
  duplicate?: boolean;
  error?: string;
}

/** Send the order to the POS "Online orders" list. Safe to retry: `external_id` is the site order id. */
export async function sendOrderToPos(order: Order): Promise<PosOrderResult> {
  if (!RESTIQ_API_KEY) {
    console.error('RESTIQ_API_KEY is not set: order not sent to POS', order.id);
    return { ok: false, skipped: true, error: 'RESTIQ_API_KEY is not set' };
  }

  const items = order.items.map(item => {
    const itemId = Number(item.itemId);
    return {
      ...(Number.isInteger(itemId) && itemId > 0 ? { item_id: itemId } : {}),
      name: item.name.slice(0, 200),
      price: item.price,
      quantity: item.quantity,
      ...(item.modifiersDescription ? { comment: `соус: ${item.modifiersDescription}`.slice(0, 300) } : {}),
    };
  });

  // Without item_id the POS adds the line to the order comment as text
  if (order.deliveryType === 'delivery' && order.deliveryFee > 0) {
    items.push({ name: 'Доставка', price: order.deliveryFee, quantity: 1 });
  }

  const comment = [
    `Сайт, заказ #${order.orderNumber}`,
    'Оплата при получении',
    order.notes,
  ].filter(Boolean).join('. ');

  const body = {
    external_id: order.id,
    order_type: order.deliveryType,
    customer: {
      name: order.customerName.slice(0, 120),
      phone: order.customerPhone.slice(0, 32),
      ...(order.deliveryType === 'delivery' ? { address: order.address.slice(0, 300) } : {}),
    },
    comment: comment.slice(0, 500),
    // Online card payment isn't connected to a bank yet: never send is_paid / "online",
    // or the POS would accept the order as paid and staff would be told not to take money
    payment_type: order.paymentMethod === 'cash' ? 'cash' : 'card',
    is_paid: false,
    items,
  };

  try {
    const res = await fetch(POS_ORDERS_URL, {
      method: 'POST',
      headers: { 'x-api-key': RESTIQ_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error('POS online-orders error:', res.status, data);
      return { ok: false, error: data?.error || `HTTP ${res.status}` };
    }
    return { ok: true, orderId: data.order_id, status: data.status, total: data.total, duplicate: Boolean(data.duplicate) };
  } catch (error) {
    console.error('POS online-orders request failed:', error);
    return { ok: false, error: String(error) };
  }
}
