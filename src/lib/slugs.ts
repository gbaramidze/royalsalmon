import { MenuItem } from '@/types';

const CYRILLIC_TO_LATIN: Record<string, string> = {
  'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e',
  'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'i', 'к': 'k', 'л': 'l', 'м': 'm',
  'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
  'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch',
  'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
};

const GEORGIAN_TO_LATIN: Record<string, string> = {
  'ა': 'a', 'ბ': 'b', 'გ': 'g', 'დ': 'd', 'ე': 'e', 'ვ': 'v', 'ზ': 'z',
  'თ': 't', 'ი': 'i', 'კ': 'k', 'ლ': 'l', 'მ': 'm', 'ნ': 'n', 'ო': 'o',
  'პ': 'p', 'ჟ': 'zh', 'რ': 'r', 'ს': 's', 'ტ': 't', 'უ': 'u', 'ფ': 'p',
  'ქ': 'k', 'ღ': 'gh', 'ყ': 'q', 'შ': 'sh', 'ჩ': 'ch', 'ც': 'ts', 'ძ': 'dz',
  'წ': 'ts', 'ჭ': 'ch', 'ხ': 'kh', 'ჯ': 'j', 'ჰ': 'h'
};

export function transliterateToSlug(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .split('')
    .map(char => CYRILLIC_TO_LATIN[char] || GEORGIAN_TO_LATIN[char] || char)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Creates a product slug in format: {id}-{transliteratedName}-
 * e.g. 8844-malenkii-pir-
 */
export function createProductSlug(item: MenuItem): string {
  const rawId = item.sku || item.itemId || '';
  // Extract numerical or compact alphanumeric ID
  const cleanId = rawId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10);
  
  const nameToUse = item.name.ru || item.name.en || item.name.ka || '';
  const slugifiedName = transliterateToSlug(nameToUse);

  if (cleanId && slugifiedName) {
    return `${cleanId}-${slugifiedName}-`;
  }
  if (slugifiedName) {
    return `${slugifiedName}-`;
  }
  if (cleanId) {
    return `${cleanId}-`;
  }
  return item.slug || 'product';
}

/**
 * Matches a URL product slug with a MenuItem
 */
export function matchProductBySlug(items: MenuItem[], slug: string): MenuItem | undefined {
  if (!slug) return undefined;
  const normalizedSlug = slug.toLowerCase().replace(/^-+|-+$/g, '');

  // 1. Direct slug match or created slug match
  for (const item of items) {
    const itemSlug = createProductSlug(item).toLowerCase().replace(/^-+|-+$/g, '');
    if (itemSlug === normalizedSlug || item.slug === normalizedSlug) {
      return item;
    }
  }

  // 2. Check if prefix before first dash matches sku or itemId
  const prefix = normalizedSlug.split('-')[0];
  if (prefix) {
    for (const item of items) {
      const cleanSku = (item.sku || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      const cleanItemId = (item.itemId || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      if ((cleanSku && cleanSku === prefix) || (cleanItemId && cleanItemId.startsWith(prefix))) {
        return item;
      }
    }
  }

  // 3. Substring match
  for (const item of items) {
    const itemSlug = createProductSlug(item).toLowerCase();
    if (itemSlug.includes(normalizedSlug) || normalizedSlug.includes(itemSlug)) {
      return item;
    }
  }

  return undefined;
}
