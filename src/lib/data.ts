import { ItemCategory, ModifierGroup } from '@/types';

export const defaultSauceModifierGroup: ModifierGroup = {
  id: "mod_grp_sauce",
  name: {
    ru: "Добавь 1 соус бесплатно",
    ka: "დაამატეთ 1 სოუსი უფასოდ",
    en: "Add 1 Free Sauce"
  },
  minQuantity: 0,
  maxQuantity: 1,
  freeQuantity: 1,
  isDefault: true,
  modifiers: [
    {
      id: "mod_spicy",
      sku: "1001",
      name: {
        ru: "Соус Спайси",
        ka: "სპაისი სოუსი",
        en: "Spicy Sauce"
      },
      price: 0,
      image: "https://api.restiq.ge/storage/v1/object/public/images/teatro/sauce_spicy.jpg"
    },
    {
      id: "mod_sweet_chili",
      sku: "1002",
      name: {
        ru: "Свит Чили",
        ka: "სვიტ ჩილი",
        en: "Sweet Chili"
      },
      price: 0,
      image: "https://api.restiq.ge/storage/v1/object/public/images/teatro/sauce_sweet_chili.jpg"
    },
    {
      id: "mod_unagi",
      sku: "1003",
      name: {
        ru: "Соус Унаги",
        ka: "უნაგი სოუსი",
        en: "Unagi Sauce"
      },
      price: 0,
      image: "https://api.restiq.ge/storage/v1/object/public/images/teatro/sauce_unagi.jpg"
    },
    {
      id: "mod_soy",
      sku: "1004",
      name: {
        ru: "Соевый соус",
        ka: "სოიოს სოუსი",
        en: "Soy Sauce"
      },
      price: 0,
      image: "https://api.restiq.ge/storage/v1/object/public/images/teatro/sauce_soy.jpg"
    }
  ]
};

// Initial categories start empty; live categories are fetched directly from RestIQ API URL
export const initialCategories: ItemCategory[] = [];
