import { Order } from '@/types';
import { fetchLiveMenu } from '@/lib/api';
import {
  BIRTHDAY_DISCOUNT_PERCENT,
  GIFT_ROLL_FROM,
  GIFT_ROLL_MAX_PRICE,
  getDeliveryFee,
  isRollCategory,
} from '@/lib/promos';

/**
 * RestIQ Online Orders API: sends site orders to the restaurant's POS terminals.
 * The key identifies the tenant and is a secret, so this module is server-only.
 */
const POS_ORDERS_URL = 'https://api.restiq.ge/functions/v1/online-orders';
const RESTIQ_API_KEY = process.env.RESTIQ_API_KEY || '';

const round2 = (value: number) => Math.round(value * 100) / 100;

export class OrderValidationError extends Error {}

/**
 * Re-price the order from the live menu so the browser can't change prices,
 * and recompute the gift roll, birthday discount, delivery fee and totals.
 */
export async function normalizeOrder(order: Order): Promise<Order> {
  const categories = await fetchLiveMenu();
  if (categories.length === 0) {
    // Menu is unreachable: keep the order (POS staff see the sum before confirming)
    console.warn('Live menu unavailable, order prices not verified:', order.id);
    return order;
  }

  const menuPrices = new Map<string, number>();
  const giftRollIds = new Set<string>();
  for (const category of categories) {
    for (const item of category.items) {
      const price = item.itemSizes[0]?.prices[0]?.price ?? 0;
      menuPrices.set(item.itemId, price);
      if (isRollCategory(category) && (GIFT_ROLL_MAX_PRICE === null || price <= GIFT_ROLL_MAX_PRICE)) {
        giftRollIds.add(item.itemId);
      }
    }
  }

  const paidItems = order.items.filter(item => !item.isGift);
  const giftItems = order.items.filter(item => item.isGift);

  const items = paidItems.map(item => {
    const price = menuPrices.get(item.itemId);
    if (price === undefined) throw new OrderValidationError(`Блюдо больше недоступно: ${item.name}`);
    const quantity = Math.floor(item.quantity);
    if (!(quantity > 0 && quantity <= 999)) throw new OrderValidationError(`Некорректное количество: ${item.name}`);
    return { ...item, price, quantity };
  });
  if (items.length === 0) throw new OrderValidationError('Корзина пуста');

  const subtotal = round2(items.reduce((sum, item) => sum + item.price * item.quantity, 0));

  // One gift roll, only from the threshold and only a roll
  const gift = giftItems[0];
  if (gift && subtotal >= GIFT_ROLL_FROM && giftRollIds.has(gift.itemId)) {
    items.push({ ...gift, price: 0, quantity: 1, isGift: true });
  }

  // The birthday itself is checked against a document on pickup; here only the amount
  const discount = order.discount && order.discount > 0 ? round2(subtotal * BIRTHDAY_DISCOUNT_PERCENT / 100) : 0;
  const deliveryFee = getDeliveryFee(order.deliveryType, subtotal);

  return {
    ...order,
    items,
    subtotal,
    discount: discount || undefined,
    deliveryFee,
    tax: Number(((subtotal - discount) * 0.18).toFixed(1)),
    total: round2(subtotal - discount + deliveryFee),
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

  // The API has no discount field and sums price × quantity itself,
  // so the birthday discount goes into the unit prices and the POS total matches what the customer pays
  const discountFactor = order.discount && order.subtotal > 0 ? 1 - order.discount / order.subtotal : 1;

  const items = order.items.map(item => {
    const itemId = Number(item.itemId);
    const comment = [
      item.isGift ? 'ПОДАРОК (акция от 100 GEL)' : '',
      item.modifiersDescription ? `соус: ${item.modifiersDescription}` : '',
    ].filter(Boolean).join(', ');
    return {
      ...(Number.isInteger(itemId) && itemId > 0 ? { item_id: itemId } : {}),
      name: item.name.slice(0, 200),
      price: round2(item.price * discountFactor),
      quantity: item.quantity,
      ...(comment ? { comment: comment.slice(0, 300) } : {}),
    };
  });

  // Without item_id the POS adds the line to the order comment as text
  if (order.deliveryType === 'delivery' && order.deliveryFee > 0) {
    items.push({ name: 'Доставка', price: order.deliveryFee, quantity: 1 });
  }

  const paymentLabel = order.paymentMethod === 'cash' ? 'наличными' : 'картой';
  const comment = [
    `Сайт, заказ #${order.orderNumber}`,
    `Оплата ${paymentLabel} при получении`,
    order.discount ? `Скидка ДР ${BIRTHDAY_DISCOUNT_PERCENT}% (−${order.discount} GEL) уже в ценах, проверить документ` : '',
    // Customer comment (the birthday line is already covered above)
    order.notes?.split('\n').filter(line => !line.startsWith('🎂')).join('\n'),
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
    // Online card payment on the site is not connected to a bank yet, so nothing is paid in advance:
    // never send is_paid / "online", or staff would be told not to take money
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
