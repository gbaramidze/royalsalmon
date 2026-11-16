/**
 * Shop-wide ordering rules and promotions (shared by the storefront, server routes and the bot).
 */

/** Courier delivery is temporarily switched off: orders are pickup-only. Set to true to bring it back. */
export const DELIVERY_ENABLED = false;

/** Delivery fee below the free-delivery threshold */
export const DELIVERY_FEE = 5;
/** Delivery is free from this subtotal (GEL) */
export const FREE_DELIVERY_FROM = 120;

/** One free roll from this subtotal (GEL) */
export const GIFT_ROLL_FROM = 100;
/** Most expensive roll the customer may pick as the gift (GEL); null = any roll */
export const GIFT_ROLL_MAX_PRICE: number | null = null;

/** Birthday discount: percent off the dishes */
export const BIRTHDAY_DISCOUNT_PERCENT = 10;
/** The discount works on the birthday and this many days after it */
export const BIRTHDAY_DAYS_AFTER = 3;

export function getDeliveryFee(deliveryType: 'delivery' | 'pickup', subtotal: number): number {
  if (deliveryType !== 'delivery' || subtotal <= 0) return 0;
  return subtotal < FREE_DELIVERY_FROM ? DELIVERY_FEE : 0;
}

/**
 * Whether `today` falls on the birthday (YYYY-MM-DD) or within BIRTHDAY_DAYS_AFTER days after it.
 * Handles birthdays near New Year and 29 February (celebrated on 28 February in other years).
 */
export function isBirthdayWindow(birthDate: string, today: Date = new Date()): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
  if (!match) return false;
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);

  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dayMs = 24 * 60 * 60 * 1000;

  // Check this year's and last year's birthday (a late-December birthday covers early January)
  for (const year of [today.getFullYear(), today.getFullYear() - 1]) {
    const isLeap = new Date(year, 1, 29).getMonth() === 1;
    const birthday = new Date(year, month, month === 1 && day === 29 && !isLeap ? 28 : day);
    const diffDays = Math.round((startOfToday.getTime() - birthday.getTime()) / dayMs);
    if (diffDays >= 0 && diffDays <= BIRTHDAY_DAYS_AFTER) return true;
  }
  return false;
}

export function getBirthdayDiscount(subtotal: number, birthDate: string, today: Date = new Date()): number {
  if (!birthDate || !isBirthdayWindow(birthDate, today)) return 0;
  return Math.round(subtotal * BIRTHDAY_DISCOUNT_PERCENT) / 100;
}

/** Categories the gift roll can be picked from (slug or name mentions rolls) */
export function isRollCategory(category: { slug: string; name: { ru: string; ka: string; en: string } }): boolean {
  return /roll|ролл|როლ/i.test(`${category.slug} ${category.name.en} ${category.name.ru}`);
}
