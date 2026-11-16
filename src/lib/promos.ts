/**
 * Shop-wide ordering rules and promotions (shared by the storefront, server routes and the bot).
 */

/** Courier delivery is temporarily switched off: orders are pickup-only. Set to true to bring it back. */
export const DELIVERY_ENABLED = false;

/** Online card payment isn't connected to a bank yet: shown as "coming soon", customers pay on pickup */
export const CARD_PAYMENT_ENABLED = false;

/** Delivery fee below the free-delivery threshold */
export const DELIVERY_FEE = 5;
/** Delivery is free from this subtotal (GEL) */
export const FREE_DELIVERY_FROM = 120;

/** One free roll from this subtotal (GEL); the restaurant picks which roll */
export const GIFT_ROLL_FROM = 100;

/** Birthday discount: percent off, given by staff on pickup against an ID */
export const BIRTHDAY_DISCOUNT_PERCENT = 10;
/** The discount works on the birthday and this many days after it */
export const BIRTHDAY_DAYS_AFTER = 3;

/**
 * "Sauces and extras" (chopsticks, wasabi, soy sauce, sauces): not included in the dish price,
 * so they're offered in the cart instead of the catalog.
 */
export function isExtrasCategory(category: { slug: string; name: { ru: string; en: string } }): boolean {
  return /sauce|extra|соус|добав/i.test(`${category.slug} ${category.name.en} ${category.name.ru}`);
}

export function getDeliveryFee(deliveryType: 'delivery' | 'pickup', subtotal: number): number {
  if (deliveryType !== 'delivery' || subtotal <= 0) return 0;
  return subtotal < FREE_DELIVERY_FROM ? DELIVERY_FEE : 0;
}
