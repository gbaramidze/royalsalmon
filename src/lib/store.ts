import { Customer, Order, OrderStatus, PaymentMethod, PaymentStatus } from '@/types';

// Initial realistic orders to populate Sales & CRM reports
export const initialOrders: Order[] = [
  {
    id: "ord_101",
    orderNumber: "RS-8421",
    customerName: "გიორგი ბერიძე (Giorgi)",
    customerPhone: "+995 599 12 34 56",
    deliveryType: "delivery",
    address: "ბათუმი, რუსთაველის ქ. 24, ბინა 12",
    items: [
      { itemId: "3001", name: "Королевский Сет Император", quantity: 1, price: 135, modifiersDescription: "Соус Спайси" },
      { itemId: "1994", name: "Креветки в панировке", quantity: 1, price: 60, modifiersDescription: "Свит Чили" }
    ],
    subtotal: 195,
    deliveryFee: 5,
    tax: 30.5,
    total: 200,
    status: "in_delivery",
    paymentMethod: "card_online",
    paymentStatus: "paid",
    createdAt: "2026-10-13T10:15:00Z",
    notes: "Домофон 12В, 3 этаж"
  },
  {
    id: "ord_102",
    orderNumber: "RS-8422",
    customerName: "Анастасия Смирнова",
    customerPhone: "+995 577 98 76 54",
    deliveryType: "pickup",
    address: "Самовывоз: Батуми, Джавахишвили, 9",
    items: [
      { itemId: "2101", name: "Филадельфия Роял с лососем", quantity: 2, price: 48, modifiersDescription: "Соевый соус x2" },
      { itemId: "909", name: "Европейская сырная тарелка", quantity: 1, price: 70 }
    ],
    subtotal: 166,
    deliveryFee: 0,
    tax: 25.3,
    total: 166,
    status: "preparing",
    paymentMethod: "card_online",
    paymentStatus: "paid",
    createdAt: "2026-10-13T10:28:00Z",
    notes: "Заберу в 11:30"
  },
  {
    id: "ord_103",
    orderNumber: "RS-8423",
    customerName: "David Miller",
    customerPhone: "+995 555 43 21 00",
    deliveryType: "delivery",
    address: "Batumi, Gorgiladze St 88, apt 45",
    items: [
      { itemId: "1995", name: "Креветки в пряном масле", quantity: 1, price: 60, modifiersDescription: "Соус Унаги" },
      { itemId: "1344", name: "Винная тарелка", quantity: 1, price: 60 }
    ],
    subtotal: 120,
    deliveryFee: 5,
    tax: 19.0,
    total: 125,
    status: "new",
    paymentMethod: "card_online",
    paymentStatus: "paid",
    createdAt: "2026-10-13T10:35:00Z"
  },
  {
    id: "ord_104",
    orderNumber: "RS-8419",
    customerName: "ლევან კალანდაძე (Levan)",
    customerPhone: "+995 591 22 33 44",
    deliveryType: "delivery",
    address: "ბათუმი, მემედ აბაშიძის 10",
    items: [
      { itemId: "3001", name: "Королевский Сет Император", quantity: 2, price: 135 }
    ],
    subtotal: 270,
    deliveryFee: 0,
    tax: 41.2,
    total: 270,
    status: "completed",
    paymentMethod: "card_online",
    paymentStatus: "paid",
    createdAt: "2026-10-13T09:05:00Z"
  },
  {
    id: "ord_105",
    orderNumber: "RS-8418",
    customerName: "Мария Иванова",
    customerPhone: "+995 598 77 66 55",
    deliveryType: "delivery",
    address: "Батуми, Химшиашвили 1",
    items: [
      { itemId: "2101", name: "Филадельфия Роял с лососем", quantity: 1, price: 48 },
      { itemId: "1340", name: "Дыня и арбуз", quantity: 1, price: 50 }
    ],
    subtotal: 98,
    deliveryFee: 5,
    tax: 15.7,
    total: 103,
    status: "completed",
    paymentMethod: "cash",
    paymentStatus: "paid",
    createdAt: "2026-10-12T19:40:00Z"
  }
];

// Initial CRM Customers List
export const initialCustomers: Customer[] = [
  {
    id: "cust_1",
    name: "გიორგი ბერიძე (Giorgi Beridze)",
    phone: "+995 599 12 34 56",
    email: "giorgi.b@gmail.com",
    ordersCount: 14,
    totalSpent: 1840,
    lastOrderDate: "2026-10-13",
    tier: "VIP"
  },
  {
    id: "cust_2",
    name: "Анастасия Смирнова",
    phone: "+995 577 98 76 54",
    email: "anastasia.sm@yandex.ru",
    ordersCount: 8,
    totalSpent: 960,
    lastOrderDate: "2026-10-13",
    tier: "Gold"
  },
  {
    id: "cust_3",
    name: "ლევან კალანდაძე (Levan Kalandadze)",
    phone: "+995 591 22 33 44",
    email: "levan.k@gmail.com",
    ordersCount: 6,
    totalSpent: 790,
    lastOrderDate: "2026-10-13",
    tier: "Silver"
  },
  {
    id: "cust_4",
    name: "David Miller",
    phone: "+995 555 43 21 00",
    email: "d.miller@outlook.com",
    ordersCount: 3,
    totalSpent: 365,
    lastOrderDate: "2026-10-13",
    tier: "Standard"
  },
  {
    id: "cust_5",
    name: "Мария Иванова",
    phone: "+995 598 77 66 55",
    email: "masha.iv@mail.ru",
    ordersCount: 5,
    totalSpent: 510,
    lastOrderDate: "2026-10-12",
    tier: "Silver"
  }
];

// 7-day sales breakdown for charts
export const initialDailySales = [
  { day: "Пн (07.10)", revenue: 840, orders: 9 },
  { day: "Вт (08.10)", revenue: 1120, orders: 12 },
  { day: "Ср (09.10)", revenue: 980, orders: 11 },
  { day: "Чт (10.10)", revenue: 1350, orders: 15 },
  { day: "Пт (11.10)", revenue: 2100, orders: 23 },
  { day: "Сб (12.10)", revenue: 2750, orders: 29 },
  { day: "Вс (13.10)", revenue: 1864, orders: 18 }
];
