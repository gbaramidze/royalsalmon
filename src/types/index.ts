export type Language = 'ru' | 'ka' | 'en';

export interface NutritionInfo {
  fats: number;
  salt: number | null;
  carbs: number;
  sugar: number | null;
  energy: number;
  proteins: number;
  storeIds?: number[];
  saturatedFattyAcid: number | null;
}

export interface ModifierItem {
  id: string;
  sku?: string;
  name: {
    ru: string;
    ka: string;
    en: string;
  };
  price: number;
  image?: string;
}

export interface ModifierGroup {
  id: string;
  name: {
    ru: string;
    ka: string;
    en: string;
  };
  minQuantity: number;
  maxQuantity: number;
  freeQuantity: number;
  isDefault?: boolean;
  modifiers: ModifierItem[];
}

export interface ItemSize {
  sku: string;
  prices: Array<{
    price: number;
    storeId?: number;
    organizationId?: string;
  }>;
  sizeId?: string | null;
  isHidden?: boolean;
  sizeName?: string;
  isDefault?: boolean;
  nutritions: NutritionInfo[];
  buttonImage?: {
    src: string;
  } | null;
  measureUnitType?: string;
  portionWeightGrams: number;
  nutritionPerHundredGrams?: NutritionInfo | null;
  itemModifierGroups?: ModifierGroup[];
}

export interface MenuItem {
  sku: string;
  name: {
    ru: string;
    ka: string;
    en: string;
  };
  slug: string;
  itemId: string;
  categorySlug: string;
  labels: string[];
  isHidden?: boolean;
  allergens: string[];
  itemSizes: ItemSize[];
  isCompound?: boolean;
  description: {
    ru: string;
    ka: string;
    en: string;
  };
  rating?: number;
  ratingCount?: number;
  taxCategory?: {
    id: string;
    name: string;
    percentage: number;
  };
}

export interface ItemCategory {
  id: string;
  name: {
    ru: string;
    ka: string;
    en: string;
  };
  slug: string;
  items: MenuItem[];
}

export interface CartItem {
  item: MenuItem;
  sizeIndex: number;
  quantity: number;
  selectedModifiers: {
    [groupId: string]: ModifierItem[];
  };
  unitPrice: number;
  totalPrice: number;
}

export type OrderStatus = 'new' | 'preparing' | 'in_delivery' | 'completed' | 'cancelled';
export type PaymentMethod = 'card_online' | 'cash';
export type PaymentStatus = 'pending' | 'paid' | 'failed';

export interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  deliveryType: 'delivery' | 'pickup';
  address: string;
  coordinates?: { lat: number; lng: number };
  apartment?: string;
  entrance?: string;
  floor?: string;
  intercom?: string;
  items: Array<{
    itemId: string;
    name: string;
    quantity: number;
    price: number;
    modifiersDescription?: string;
  }>;
  subtotal: number;
  deliveryFee: number;
  tax: number;
  total: number;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  createdAt: string;
  notes?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  ordersCount: number;
  totalSpent: number;
  lastOrderDate: string;
  tier: 'Standard' | 'Silver' | 'Gold' | 'VIP';
}
