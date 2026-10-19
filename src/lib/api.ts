import { ItemCategory, MenuItem } from '@/types';

export const RESTIQ_API_URL = 'https://api.restiq.ge/functions/v1/qr-menu?tenant_id=ec788ee8-f3c3-45c8-a402-ee13ef4b49ed';

export const NO_PHOTO_IMAGE = '/images/no-photo.svg';

/**
 * Direct Live API Fetcher
 * Strictly fetches and parses live data from:
 * https://api.restiq.ge/functions/v1/qr-menu?tenant_id=ec788ee8-f3c3-45c8-a402-ee13ef4b49ed
 * If an item does not have a photo in the API, it uses NO_PHOTO_IMAGE.
 */
export async function fetchLiveMenu(): Promise<ItemCategory[]> {
  try {
    const res = await fetch(RESTIQ_API_URL, {
      next: { revalidate: 30 }
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch RestIQ API, status: ${res.status}`);
    }

    const data = await res.json();
    const rawCategories = data?.result?.itemCategories;

    if (!Array.isArray(rawCategories)) {
      throw new Error('Invalid RestIQ API payload format: itemCategories missing');
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return rawCategories.map((rawCat: any) => {
      const catName = String(rawCat.name || rawCat.slug || 'Category');
      const catSlug = String(rawCat.slug || rawCat.name || 'cat')
        .toLowerCase()
        .replace(/\s+/g, '-');

      const items: MenuItem[] = Array.isArray(rawCat.items)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? rawCat.items.map((rawItem: any) => {
            const id = String(rawItem.itemId || rawItem.sku || rawItem.id);
            const itemName = String(rawItem.name || 'Item');
            const itemDesc = String(rawItem.description || '');
            const rawSize = rawItem.itemSizes?.[0] || {};
            const price = Number(rawSize.prices?.[0]?.price ?? 0);
            const rawWeight = rawSize.portionWeightGrams ?? 
                              rawSize.portion_weight_grams ?? 
                              rawItem.portionWeightGrams ?? 
                              rawItem.portion_weight_grams ?? 
                              rawSize.weight ?? 
                              rawItem.weight ?? 
                              0;
            const weight = Math.round(Number(rawWeight) || 0);

            // Raw buttonImage from RestIQ API, fallback to the single NO_PHOTO_IMAGE if null
            const liveImg = rawSize.buttonImage?.src || rawSize.buttonImage?.url || null;
            const finalImage = liveImg || NO_PHOTO_IMAGE;

            return {
              sku: String(rawItem.sku || id),
              itemId: id,
              slug: String(rawItem.slug || itemName).toLowerCase().replace(/\s+/g, '-'),
              categorySlug: catSlug,
              labels: Array.isArray(rawItem.labels) ? rawItem.labels : [],
              rating: 0,
              ratingCount: 0,
              name: {
                ru: itemName,
                ka: itemName,
                en: itemName
              },
              description: {
                ru: itemDesc,
                ka: itemDesc,
                en: itemDesc
              },
              allergens: Array.isArray(rawItem.allergens) ? rawItem.allergens : [],
              itemSizes: [
                {
                  sku: String(rawSize.sku || rawItem.sku || id),
                  portionWeightGrams: weight,
                  prices: [{ price }],
                  isDefault: true,
                  buttonImage: { src: finalImage },
                  nutritions: Array.isArray(rawSize.nutritions) ? rawSize.nutritions : [],
                  nutritionPerHundredGrams: rawSize.nutritionPerHundredGrams || null,
                  itemModifierGroups: Array.isArray(rawSize.itemModifierGroups) ? rawSize.itemModifierGroups : []
                }
              ]
            };
          })
        : [];

      return {
        id: String(rawCat.id || catSlug),
        name: {
          ru: catName,
          ka: catName,
          en: catName
        },
        slug: catSlug,
        items
      };
    });
  } catch (error) {
    console.error('Error fetching live RestIQ menu:', error);
    return [];
  }
}
