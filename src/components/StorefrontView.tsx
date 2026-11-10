'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { ItemCategory, Language, MenuItem, ModifierItem, Order, PaymentMethod } from '@/types';
import { initialOrders } from '@/lib/store';
import { getTranslation } from '@/lib/i18n';
import { NO_PHOTO_IMAGE } from '@/lib/api';
import { createProductSlug, matchProductBySlug } from '@/lib/slugs';
import { 
  ShoppingBag, 
  MapPin, 
  Star, 
  ChevronDown, 
  ChevronUp, 
  X, 
  Plus, 
  Minus, 
  Check,
  CreditCard,
  Search,
  Send,
  Phone,
  MessageSquare,
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  Navigation,
  Home
} from 'lucide-react';
import { RoyalSalmonLogo } from '@/components/RoyalSalmonLogo';
import { PaymentBadges, VisaLogo, MastercardLogo } from '@/components/PaymentLogos';
import AddressMapPicker from '@/components/AddressMapPicker';

interface StorefrontViewProps {
  initialCategories: ItemCategory[];
}

export default function StorefrontView({ initialCategories }: StorefrontViewProps) {
  const [lang, setLang] = useState<Language>('ru');
  const [deliveryMode, setDeliveryMode] = useState<'delivery' | 'pickup'>('delivery');
  const [address, setAddress] = useState<string>('Батуми, ул. Джавахишвили, 9');
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [tempAddress, setTempAddress] = useState(address);
  const [tempCoordinates, setTempCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [announcementVisible, setAnnouncementVisible] = useState(true);

  // Search state & Scroll-direction visibility
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(true);
  const isSearchVisibleRef = useRef(true);
  const isTransitioningRef = useRef(false);
  const lastScrollYRef = useRef(0);
  const scrollDistanceRef = useRef(0);
  const activeCategoryRef = useRef(initialCategories[0]?.slug || 'sets');
  const isProgrammaticScrollRef = useRef(false);
  const programmaticScrollTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Categories pre-loaded on the server side
  const [categories, setCategories] = useState<ItemCategory[]>(initialCategories);
  const [activeCategory, setActiveCategory] = useState<string>(initialCategories[0]?.slug || 'sets');
  const [selectedProduct, setSelectedProduct] = useState<MenuItem | null>(null);
  const selectedProductRef = useRef<MenuItem | null>(null);
  selectedProductRef.current = selectedProduct;
  const [selectedModifier, setSelectedModifier] = useState<ModifierItem | null>(null);
  const [isNutritionOpen, setIsNutritionOpen] = useState(true);

  // Cart: itemId -> { item, quantity, modifier }
  const [cart, setCart] = useState<Record<string, { item: MenuItem; quantity: number; modifier?: ModifierItem }>>({});
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  // Checkout inputs & 2-Step Wizard State
  const [checkoutStep, setCheckoutStep] = useState<1 | 2>(1);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerComment, setCustomerComment] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryCoordinates, setDeliveryCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [apartment, setApartment] = useState('');
  const [entrance, setEntrance] = useState('');
  const [floor, setFloor] = useState('');
  const [intercom, setIntercom] = useState('');
  const [isMapVisible, setIsMapVisible] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card_online');
  const [isPaying, setIsPaying] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null);

  // Verification State (SMS / Telegram)
  const [verificationMethod, setVerificationMethod] = useState<'telegram' | 'sms'>('sms');
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);
  const [otpCode, setOtpCodeState] = useState('');
  // Latest code, readable before React re-renders (focus moves to the next box synchronously)
  const otpCodeRef = useRef('');
  const setOtpCode = (code: string) => {
    otpCodeRef.current = code;
    setOtpCodeState(code);
  };
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpHintCode, setOtpHintCode] = useState<string | null>(null);
  const [telegramDeepLink, setTelegramDeepLink] = useState('');

  // Drawer Menu & Info Modals
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeInfoModal, setActiveInfoModal] = useState<'bonuses' | 'promos' | 'delivery' | 'faq' | 'contacts' | null>(null);

  // Category refs for scrollspy
  const categoryNavRef = useRef<HTMLDivElement>(null);
  const chipRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const t = (key: Parameters<typeof getTranslation>[1], params?: Record<string, string | number>) => 
    getTranslation(lang, key, params);

  // Client-side fallback if server-side fetch was empty
  useEffect(() => {
    if (categories.length === 0) {
      let isMounted = true;
      fetch('/api/menu')
        .then(res => res.json())
        .then(data => {
          if (isMounted && data?.categories?.length > 0) {
            setCategories(data.categories);
            setActiveCategory(data.categories[0].slug);
          }
        })
        .catch(err => console.error('Error fetching menu on client fallback:', err));
      return () => {
        isMounted = false;
      };
    }
  }, [categories.length]);

  // Initialize orders in localStorage if needed
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('rs_orders');
      if (!stored) {
        localStorage.setItem('rs_orders', JSON.stringify(initialOrders));
      }
    }
  }, []);

  // Restore saved customer profile (written after a completed order with a verified phone)
  useEffect(() => {
    try {
      const raw = localStorage.getItem('rs_customer_profile');
      if (!raw) return;
      const p = JSON.parse(raw);
      if (!p?.phone) return;

      setCustomerPhone(p.phone);
      setIsPhoneVerified(true);
      if (p.verificationMethod === 'sms' || p.verificationMethod === 'telegram') setVerificationMethod(p.verificationMethod);
      if (p.name) setCustomerName(p.name);
      if (p.deliveryAddress) {
        setDeliveryAddress(p.deliveryAddress);
        setAddress(p.deliveryAddress);
        setTempAddress(p.deliveryAddress);
      }
      if (p.coordinates && typeof p.coordinates.lat === 'number' && typeof p.coordinates.lng === 'number') {
        setDeliveryCoordinates(p.coordinates);
      }
      if (p.apartment) setApartment(p.apartment);
      if (p.entrance) setEntrance(p.entrance);
      if (p.floor) setFloor(p.floor);
      if (p.intercom) setIntercom(p.intercom);
      if (p.paymentMethod === 'card_online' || p.paymentMethod === 'cash') setPaymentMethod(p.paymentMethod);
    } catch (err) {
      console.warn('Failed to restore customer profile:', err);
    }
  }, []);

  // Show search on scroll UP, hide on scroll DOWN (with hysteresis & transition cooldown)
  useEffect(() => {
    let ticking = false;

    const handleScrollDirection = () => {
      if (ticking) return;
      ticking = true;

      window.requestAnimationFrame(() => {
        const currentScrollY = window.scrollY;
        const prevScrollY = lastScrollYRef.current;
        const delta = currentScrollY - prevScrollY;
        lastScrollYRef.current = currentScrollY;

        // If in animation/layout cooldown after visibility change, ignore layout shifts
        if (isTransitioningRef.current) {
          ticking = false;
          return;
        }

        // When near top of page (hero/banner area), search is always visible
        if (currentScrollY <= 260) {
          if (!isSearchVisibleRef.current) {
            isSearchVisibleRef.current = true;
            setIsSearchVisible(true);
            isTransitioningRef.current = true;
            setTimeout(() => {
              isTransitioningRef.current = false;
              lastScrollYRef.current = window.scrollY;
              scrollDistanceRef.current = 0;
            }, 320);
          }
          scrollDistanceRef.current = 0;
          ticking = false;
          return;
        }

        // If user entered a search query, keep search visible
        if (searchQuery.trim().length > 0) {
          if (!isSearchVisibleRef.current) {
            isSearchVisibleRef.current = true;
            setIsSearchVisible(true);
          }
          ticking = false;
          return;
        }

        // Directional accumulation with hysteresis
        if (delta > 0) {
          // Scrolling DOWN
          if (scrollDistanceRef.current < 0) scrollDistanceRef.current = 0;
          scrollDistanceRef.current += delta;

          // Only hide if currently visible and scrolled down significantly (> 50px)
          if (scrollDistanceRef.current > 50 && isSearchVisibleRef.current) {
            isSearchVisibleRef.current = false;
            setIsSearchVisible(false);
            isTransitioningRef.current = true;
            scrollDistanceRef.current = 0;
            setTimeout(() => {
              isTransitioningRef.current = false;
              lastScrollYRef.current = window.scrollY;
              scrollDistanceRef.current = 0;
            }, 320);
          }
        } else if (delta < 0) {
          // Scrolling UP
          if (scrollDistanceRef.current > 0) scrollDistanceRef.current = 0;
          scrollDistanceRef.current += delta; // negative

          // Only show if currently hidden and scrolled up significantly (< -35px)
          if (scrollDistanceRef.current < -35 && !isSearchVisibleRef.current) {
            isSearchVisibleRef.current = true;
            setIsSearchVisible(true);
            isTransitioningRef.current = true;
            scrollDistanceRef.current = 0;
            setTimeout(() => {
              isTransitioningRef.current = false;
              lastScrollYRef.current = window.scrollY;
              scrollDistanceRef.current = 0;
            }, 320);
          }
        }

        ticking = false;
      });
    };

    window.addEventListener('scroll', handleScrollDirection, { passive: true });
    return () => window.removeEventListener('scroll', handleScrollDirection);
  }, [searchQuery]);

  // Real-time search filter across categories and products
  const displayCategories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return categories;

    return categories
      .map(cat => {
        const matchingItems = cat.items.filter(item => {
          const nameRu = (item.name.ru || '').toLowerCase();
          const nameKa = (item.name.ka || '').toLowerCase();
          const nameEn = (item.name.en || '').toLowerCase();
          const descRu = (item.description.ru || '').toLowerCase();
          const descKa = (item.description.ka || '').toLowerCase();
          const descEn = (item.description.en || '').toLowerCase();
          return nameRu.includes(q) || nameKa.includes(q) || nameEn.includes(q) ||
                 descRu.includes(q) || descKa.includes(q) || descEn.includes(q);
        });

        return {
          ...cat,
          items: matchingItems
        };
      })
      .filter(cat => cat.items.length > 0);
  }, [categories, searchQuery]);

  // Cancel programmatic scroll lock if user manually touches screen or scrolls wheel
  useEffect(() => {
    const handleUserInteraction = () => {
      if (isProgrammaticScrollRef.current) {
        isProgrammaticScrollRef.current = false;
        if (programmaticScrollTimerRef.current) {
          clearTimeout(programmaticScrollTimerRef.current);
        }
      }
    };

    window.addEventListener('wheel', handleUserInteraction, { passive: true });
    window.addEventListener('touchstart', handleUserInteraction, { passive: true });
    return () => {
      window.removeEventListener('wheel', handleUserInteraction);
      window.removeEventListener('touchstart', handleUserInteraction);
    };
  }, []);

  // Deep-linking from initial URL and browser popstate (Back/Forward)
  useEffect(() => {
    if (typeof window === 'undefined' || categories.length === 0) return;

    const syncFromUrl = () => {
      const pathname = window.location.pathname;
      const segments = pathname.split('/').filter(Boolean);

      // Check format: /:category/product/:productSlug
      if (segments.length >= 3 && segments[1] === 'product') {
        const catSlug = segments[0];
        const prodSlug = segments[2];

        const cat = categories.find(c => c.slug === catSlug);
        if (cat) {
          activeCategoryRef.current = catSlug;
          setActiveCategory(catSlug);
        }

        const matched = matchProductBySlug(cat?.items || [], prodSlug) ||
                        matchProductBySlug(categories.flatMap(c => c.items), prodSlug);
        if (matched) {
          setSelectedProduct(matched);
          selectedProductRef.current = matched;
        }
      } else if (segments.length === 1) {
        // Format: /:category
        const catSlug = segments[0];
        const cat = categories.find(c => c.slug === catSlug);
        if (cat) {
          activeCategoryRef.current = catSlug;
          setActiveCategory(catSlug);
        }
      }
    };

    // Run once on initial load
    syncFromUrl();

    // Listen to popstate (back/forward)
    const handlePopState = () => {
      const pathname = window.location.pathname;
      const segments = pathname.split('/').filter(Boolean);

      if (segments.length >= 3 && segments[1] === 'product') {
        const prodSlug = segments[2];
        const matched = matchProductBySlug(categories.flatMap(c => c.items), prodSlug);
        if (matched) {
          setSelectedProduct(matched);
          selectedProductRef.current = matched;
        }
      } else {
        if (selectedProductRef.current) {
          setSelectedProduct(null);
          selectedProductRef.current = null;
          setSelectedModifier(null);
        }
        if (segments.length === 1) {
          const catSlug = segments[0];
          if (categories.some(c => c.slug === catSlug)) {
            activeCategoryRef.current = catSlug;
            setActiveCategory(catSlug);
          }
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [categories]);

  // Scrollspy: track which category is in view and highlight/scroll chip & update URL
  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (isProgrammaticScrollRef.current) return;

      if (!ticking) {
        window.requestAnimationFrame(() => {
          if (isProgrammaticScrollRef.current) {
            ticking = false;
            return;
          }
          const headerOffset = isSearchVisible ? 220 : 160;
          const scrollPos = window.scrollY + headerOffset;

          // If scrolled near top, update URL to '/' if no product is open
          if (window.scrollY < 160 && typeof window !== 'undefined' && !selectedProductRef.current) {
            if (window.location.pathname !== '/' && !window.location.pathname.includes('/product/')) {
              window.history.replaceState(null, '', '/');
            }
          }

          for (let i = displayCategories.length - 1; i >= 0; i--) {
            const cat = displayCategories[i];
            const el = document.getElementById(`section-${cat.slug}`);
            if (el) {
              const top = el.offsetTop;
              if (scrollPos >= top) {
                // Only update and scroll category chips if active category has CHANGED!
                if (activeCategoryRef.current !== cat.slug) {
                  activeCategoryRef.current = cat.slug;
                  setActiveCategory(cat.slug);

                  // Update browser URL during scroll
                  if (typeof window !== 'undefined' && !selectedProductRef.current) {
                    const newPath = `/${cat.slug}`;
                    if (window.location.pathname !== newPath) {
                      window.history.replaceState(null, '', newPath);
                    }
                  }

                  const chip = chipRefs.current[cat.slug];
                  if (chip && categoryNavRef.current) {
                    const nav = categoryNavRef.current;
                    const chipLeft = chip.offsetLeft;
                    const chipWidth = chip.offsetWidth;
                    const navWidth = nav.offsetWidth;
                    nav.scrollTo({
                      left: chipLeft - navWidth / 2 + chipWidth / 2,
                      behavior: 'smooth'
                    });
                  }
                }
                break;
              }
            }
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [displayCategories, isSearchVisible]);

  // Lock background body scroll when bottomSheet or any modal is open
  useEffect(() => {
    const isAnyModalOpen = Boolean(selectedProduct || isCartOpen || isCheckoutOpen || isAddressModalOpen || confirmedOrder || isDrawerOpen || activeInfoModal);
    if (isAnyModalOpen) {
      const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
      document.body.classList.add('modal-open');
      document.documentElement.classList.add('modal-open');
      if (scrollBarWidth > 0) {
        document.body.style.paddingRight = `${scrollBarWidth}px`;
      }
    } else {
      document.body.classList.remove('modal-open');
      document.documentElement.classList.remove('modal-open');
      document.body.style.paddingRight = '';
    }
    return () => {
      document.body.classList.remove('modal-open');
      document.documentElement.classList.remove('modal-open');
      document.body.style.paddingRight = '';
    };
  }, [selectedProduct, isCartOpen, isCheckoutOpen, isAddressModalOpen, confirmedOrder, isDrawerOpen, activeInfoModal]);

  const scrollToCategory = (slug: string) => {
    // 1. Lock programmatic scroll immediately so intermediate categories cannot activate
    isProgrammaticScrollRef.current = true;
    if (programmaticScrollTimerRef.current) {
      clearTimeout(programmaticScrollTimerRef.current);
    }

    // 2. Set active category immediately
    activeCategoryRef.current = slug;
    setActiveCategory(slug);

    // Update browser URL immediately
    if (typeof window !== 'undefined' && !selectedProductRef.current) {
      const newPath = `/${slug}`;
      if (window.location.pathname !== newPath) {
        window.history.replaceState(null, '', newPath);
      }
    }

    // 3. Center the clicked chip in category navigation immediately
    const chip = chipRefs.current[slug];
    if (chip && categoryNavRef.current) {
      const nav = categoryNavRef.current;
      const chipLeft = chip.offsetLeft;
      const chipWidth = chip.offsetWidth;
      const navWidth = nav.offsetWidth;
      nav.scrollTo({
        left: chipLeft - navWidth / 2 + chipWidth / 2,
        behavior: 'smooth'
      });
    }

    // 4. Smooth scroll to target section in catalog
    const el = document.getElementById(`section-${slug}`);
    if (el) {
      const offset = isSearchVisible ? 180 : 130;
      const elementPosition = el.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;

      window.scrollTo({
        top: Math.max(0, offsetPosition),
        behavior: 'smooth'
      });
    }

    // 5. Unlock scrollspy only after smooth scrolling finishes
    programmaticScrollTimerRef.current = setTimeout(() => {
      isProgrammaticScrollRef.current = false;
    }, 1000);
  };

  // Cart calculations
  const cartEntries = Object.values(cart);
  const cartItemsCount = cartEntries.reduce((acc, c) => acc + c.quantity, 0);
  const subtotal = cartEntries.reduce((acc, c) => acc + c.quantity * c.item.itemSizes[0].prices[0].price, 0);
  const deliveryFee = deliveryMode === 'delivery' && subtotal < 100 && subtotal > 0 ? 5 : 0;
  const total = subtotal + deliveryFee;

  const handleOpenProduct = (item: MenuItem) => {
    setSelectedProduct(item);
    selectedProductRef.current = item;
    setSelectedModifier(null);
    setIsNutritionOpen(true);

    if (typeof window !== 'undefined') {
      const catSlug = item.categorySlug || activeCategoryRef.current || 'sets';
      const productSlug = createProductSlug(item);
      const newPath = `/${catSlug}/product/${productSlug}`;
      if (window.location.pathname !== newPath) {
        window.history.pushState({ modal: true, productId: item.itemId }, '', newPath);
      }
    }
  };

  const handleCloseProduct = () => {
    setSelectedProduct(null);
    selectedProductRef.current = null;
    setSelectedModifier(null);

    if (typeof window !== 'undefined') {
      const catSlug = activeCategoryRef.current || 'sets';
      const newPath = `/${catSlug}`;
      if (window.location.pathname !== newPath) {
        window.history.replaceState(null, '', newPath);
      }
    }
  };

  const handlePriceClick = (item: MenuItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const size = item.itemSizes[0];
    const hasModifiers = Boolean(
      size?.itemModifierGroups &&
      size.itemModifierGroups.length > 0 &&
      size.itemModifierGroups.some(g => Array.isArray(g.modifiers) && g.modifiers.length > 0)
    );

    if (hasModifiers) {
      handleOpenProduct(item);
    } else {
      const id = item.itemId;
      setCart(prev => ({
        ...prev,
        [id]: {
          item,
          quantity: (prev[id]?.quantity || 0) + 1
        }
      }));
    }
  };

  const handleAddToCartFromModal = () => {
    if (!selectedProduct) return;
    const id = selectedProduct.itemId;
    setCart(prev => ({
      ...prev,
      [id]: {
        item: selectedProduct,
        quantity: (prev[id]?.quantity || 0) + 1,
        modifier: selectedModifier || undefined
      }
    }));
    handleCloseProduct();
  };

  const handleUpdateQty = (id: string, delta: number) => {
    setCart(prev => {
      const current = prev[id];
      if (!current) return prev;
      const newQty = current.quantity + delta;
      if (newQty <= 0) {
        const next = { ...prev };
        delete next[id];
        return next;
      }
      return {
        ...prev,
        [id]: { ...current, quantity: newQty }
      };
    });
  };

  const handleSendOtp = async (overrideMethod?: 'telegram' | 'sms') => {
    const methodToUse = overrideMethod || verificationMethod;
    if (!customerPhone.trim() || customerPhone.trim().length < 6) {
      alert(lang === 'ru' ? 'Сначала укажите номер телефона' : 'Please enter phone number first');
      return;
    }
    setIsSendingOtp(true);
    setOtpError(null);
    setOtpHintCode(null);
    try {
      const res = await fetch('/api/telegram/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: customerPhone.trim(), method: methodToUse })
      });
      const data = await res.json();
      if (data?.success) {
        setIsOtpSent(true);
        if (data.deepLink) setTelegramDeepLink(data.deepLink);
        if (data.code) setOtpHintCode(data.code);
      } else {
        setOtpError(data?.error || (lang === 'ru' ? 'Не удалось отправить код' : 'Failed to send code'));
      }
    } catch {
      setOtpError(lang === 'ru' ? 'Ошибка соединения с сервером' : 'Connection error');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otpCode.length < 4) return;
    setIsVerifyingOtp(true);
    setOtpError(null);
    try {
      const res = await fetch('/api/telegram/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: customerPhone.trim(), code: otpCode })
      });
      const data = await res.json();
      if (data?.success && data?.verified) {
        setIsPhoneVerified(true);
        setIsOtpSent(false);
        setCheckoutStep(2);
      } else {
        setOtpError(data?.error || (lang === 'ru' ? 'Неверный проверочный код' : 'Invalid code'));
      }
    } catch {
      setOtpError(lang === 'ru' ? 'Ошибка проверки кода' : 'Verification error');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const focusOtpDigit = (index: number) => {
    const el = otpInputRefs.current[Math.max(0, Math.min(3, index))];
    el?.focus();
    el?.select();
  };

  const handleOtpDigitChange = (index: number, rawValue: string, replaceAll = false) => {
    const otpCode = otpCodeRef.current;
    const digits = rawValue.replace(/\D/g, '');
    setOtpError(null);

    if (!digits) {
      // Digit cleared (e.g. mobile keyboards that don't emit a Backspace keydown)
      if (!replaceAll) setOtpCode(otpCode.slice(0, index) + otpCode.slice(index + 1));
      return;
    }

    // One typed digit replaces the box; several digits (paste / SMS autofill) fill onwards
    const next = replaceAll
      ? digits.slice(0, 4)
      : (otpCode.slice(0, index) + digits + otpCode.slice(index + digits.length)).slice(0, 4);
    setOtpCode(next);
    focusOtpDigit(replaceAll ? next.length : index + digits.length);
  };

  const handleOtpDigitKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    const otpCode = otpCodeRef.current;
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (otpCode[index]) {
        setOtpCode(otpCode.slice(0, index) + otpCode.slice(index + 1));
      } else if (index > 0) {
        setOtpCode(otpCode.slice(0, index - 1) + otpCode.slice(index));
        focusOtpDigit(index - 1);
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      focusOtpDigit(index - 1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      focusOtpDigit(Math.min(index + 1, otpCode.length));
    } else if (e.key === 'Enter') {
      handleVerifyOtp();
    }
  };

  const handleProcessBankPayment = () => {
    if (!customerPhone.trim() || !isPhoneVerified) {
      setCheckoutStep(1);
      alert(lang === 'ru' ? 'Сначала подтвердите номер телефона на шаге 1' : 'Please verify phone number on Step 1 first');
      return;
    }

    if (!customerName.trim()) {
      alert(lang === 'ru' ? 'Пожалуйста, укажите имя' : 'Please enter your name');
      return;
    }

    if (deliveryMode === 'delivery' && !deliveryAddress.trim() && !deliveryCoordinates) {
      alert(lang === 'ru' ? 'Пожалуйста, укажите адрес доставки или точку на карте' : 'Please enter delivery address or pick on map');
      return;
    }

    setIsPaying(true);

    setTimeout(() => {
      const newOrderNum = `RS-${Math.floor(1000 + Math.random() * 9000)}`;

      const fullAddressParts = [
        deliveryAddress.trim() || (deliveryCoordinates ? 'Батуми (точка на карте)' : address),
        apartment.trim() ? `${lang === 'ru' ? 'кв./офис' : 'apt'} ${apartment.trim()}` : '',
        entrance.trim() ? `${lang === 'ru' ? 'подъезд' : 'ent'} ${entrance.trim()}` : '',
        floor.trim() ? `${lang === 'ru' ? 'этаж' : 'fl'} ${floor.trim()}` : '',
        intercom.trim() ? `${lang === 'ru' ? 'домофон' : 'intercom'} ${intercom.trim()}` : '',
      ].filter(Boolean);

      const computedAddress = deliveryMode === 'delivery' 
        ? fullAddressParts.join(', ') 
        : t('pickupAddress');

      const newOrder: Order = {
        id: crypto.randomUUID(),
        orderNumber: newOrderNum,
        customerName,
        customerPhone,
        deliveryType: deliveryMode,
        address: computedAddress,
        coordinates: deliveryCoordinates || undefined,
        apartment: apartment.trim() || undefined,
        entrance: entrance.trim() || undefined,
        floor: floor.trim() || undefined,
        intercom: intercom.trim() || undefined,
        items: cartEntries.map(c => ({
          itemId: c.item.itemId,
          name: c.item.name[lang] || c.item.name.en,
          quantity: c.quantity,
          price: c.item.itemSizes[0].prices[0].price,
          modifiersDescription: c.modifier ? (c.modifier.name[lang] || c.modifier.name.en) : undefined
        })),
        subtotal,
        deliveryFee,
        tax: Number((subtotal * 0.18).toFixed(1)),
        total,
        status: 'new',
        paymentMethod,
        paymentStatus: paymentMethod === 'cash' ? 'pending' : 'paid',
        createdAt: new Date().toISOString(),
        notes: customerComment
      };

      if (typeof window !== 'undefined') {
        const existing: Order[] = JSON.parse(localStorage.getItem('rs_orders') || '[]');
        localStorage.setItem('rs_orders', JSON.stringify([newOrder, ...existing]));

        // Remember the customer so the next checkout is pre-filled
        try {
          const prev = JSON.parse(localStorage.getItem('rs_customer_profile') || '{}');
          const isDelivery = deliveryMode === 'delivery';
          localStorage.setItem('rs_customer_profile', JSON.stringify({
            ...prev,
            name: customerName.trim(),
            phone: customerPhone.trim(),
            verificationMethod,
            paymentMethod,
            // Pickup orders keep the previously saved delivery address
            ...(isDelivery ? {
              deliveryAddress: deliveryAddress.trim(),
              coordinates: deliveryCoordinates,
              apartment: apartment.trim(),
              entrance: entrance.trim(),
              floor: floor.trim(),
              intercom: intercom.trim(),
            } : {}),
          }));
        } catch (err) {
          console.warn('Failed to save customer profile:', err);
        }
      }

      // Send order notification to Telegram
      fetch('/api/telegram/order-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newOrder)
      }).catch(err => {
        console.error('Failed to send Telegram order notification:', err);
      });

      setIsPaying(false);
      setIsCheckoutOpen(false);
      setIsCartOpen(false);
      setCart({});
      setConfirmedOrder(newOrder);
    }, 1100);
  };

  return (
    <div className="app-viewport-shell">

      {/* 1. Announcement Banner */}
      {announcementVisible && (
        <div className="announcement-bar">
          <div className="announcement-bar__text">
            <span>⚠️</span>
            <span>{t('announcement')}</span>
          </div>
          <button 
            className="announcement-bar__close" 
            onClick={() => setAnnouncementVisible(false)}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
      )}

      {/* Topbar: Phone on Left, Language Switcher on Right */}
      <div className="site-topbar">
        <div className="site-topbar__inner">
          <div className="site-topbar__left">
            <a href="tel:+995550505454" className="topbar-phone-link">
              <Phone size={13} className="topbar-phone-icon" />
              <span className="topbar-phone-number">+995 550 505 454</span>
            </a>
            <span className="topbar-divider">•</span>
            <span className="topbar-hours">
              {lang === 'ru' ? 'Батуми • 11:00 – 23:00' : lang === 'ka' ? 'ბათუმი • 11:00 – 23:00' : 'Batumi • 11:00 – 23:00'}
            </span>
          </div>

          <div className="site-topbar__right">
            <div className="lang-switcher">
              <button 
                className={`lang-btn ${lang === 'ru' ? 'active' : ''}`}
                onClick={() => setLang('ru')}
                aria-label="Русский"
              >
                RU
              </button>
              <button 
                className={`lang-btn ${lang === 'ka' ? 'active' : ''}`}
                onClick={() => setLang('ka')}
                aria-label="ქართული"
              >
                GE
              </button>
              <button 
                className={`lang-btn ${lang === 'en' ? 'active' : ''}`}
                onClick={() => setLang('en')}
                aria-label="English"
              >
                EN
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Responsive Header (Mobile & Desktop) */}
      <header className="app-header">
        <div className="app-header__inner">
          <div className="app-header__left">
            {/* Hamburger Menu Button beside Crown Logo */}
            <button 
              className="header__menu-btn" 
              onClick={() => setIsDrawerOpen(true)}
              aria-label={t('menuNavigation')}
              id="header-menu-btn"
              title={t('menuNavigation')}
            >
              <span></span>
              <span></span>
              <span></span>
            </button>

            <Link href="/" className="logo-brand" aria-label="Royal Salmon">
              <RoyalSalmonLogo height={32} />
            </Link>

            {/* Desktop Navigation Links */}
            <nav className="app-header__desktop-nav">
              {categories.map(cat => (
                <a 
                  key={cat.id}
                  href={`#section-${cat.slug}`} 
                  className="desktop-nav-link" 
                  onClick={(e) => { e.preventDefault(); scrollToCategory(cat.slug); }}
                >
                  {cat.name[lang] || cat.name.en}
                </a>
              ))}
            </nav>
          </div>

          <div className="app-header__actions">
            {/* Cart Button with Total Sum & Badge */}
            <button className="cart-icon-btn" onClick={() => setIsCartOpen(true)} aria-label="Open cart">
              <ShoppingBag size={18} />
              <span>{subtotal} GEL</span>
              {cartItemsCount > 0 && (
                <span className="cart-badge">{cartItemsCount}</span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="site-container">

        {/* 3. Delivery / Pickup Tabs & Address Selector */}
        <div className="order-settings-row">
          <div className="delivery-tabs-container">
            <button 
              className={`delivery-tab-btn ${deliveryMode === 'delivery' ? 'active' : ''}`}
              onClick={() => setDeliveryMode('delivery')}
            >
              {t('delivery')}
            </button>
            <button 
              className={`delivery-tab-btn ${deliveryMode === 'pickup' ? 'active' : ''}`}
              onClick={() => setDeliveryMode('pickup')}
            >
              {t('pickup')}
            </button>
          </div>

          <div className="location-bar" onClick={() => setIsAddressModalOpen(true)}>
            <div className="location-bar__text">
              <MapPin size={16} color="var(--color-primary)" />
              <span>{deliveryMode === 'delivery' ? address : t('pickupAddress')}</span>
            </div>
            <button className="location-bar__btn">{t('change')}</button>
          </div>
        </div>

        {/* 4. Promo Banner */}
        <div className="promo-slider">
          <div className="promo-card">
            <div>
              <span className="promo-tag">{t('bannerTag')}</span>
              <div className="promo-title">{t('bannerTitle')}</div>
              <div className="promo-desc">{t('bannerSubtitle')}</div>
            </div>
            <div style={{ fontSize: 44, opacity: 0.9 }}>🍣</div>
          </div>
        </div>

        {/* 5. Sticky Category Chips with Scrollspy & Collapsible Search */}
        <div className="categories-nav-sticky-wrapper">
          {/* Search bar directly above categories: hides on scroll down, shows on scroll up */}
          <div className={`catalog-search-wrapper ${!isSearchVisible ? 'hidden' : ''}`}>
            <div className="catalog-search-box">
              <Search size={18} className="catalog-search-icon" />
              <input 
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={t('searchPlaceholder')}
                className="catalog-search-input"
              />
              {searchQuery && (
                <button 
                  type="button" 
                  className="catalog-search-clear"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          <nav className="categories-nav" ref={categoryNavRef}>
            {displayCategories.map(cat => {
              const isActive = activeCategory === cat.slug;
              return (
                <button 
                  key={cat.id}
                  ref={el => { chipRefs.current[cat.slug] = el; }}
                  className={`category-chip-btn ${isActive ? 'active' : ''}`}
                  onClick={() => scrollToCategory(cat.slug)}
                >
                  {cat.name[lang] || cat.name.en}
                </button>
              );
            })}
          </nav>
        </div>

        {/* 6. Product Sections (Grouped by Category with Scrollspy IDs) */}
        <main style={{ paddingBottom: 60 }}>
          {categories.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 42, marginBottom: 12 }}>🍣</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)', marginBottom: 6 }}>Загрузка меню из RestIQ API...</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>api.restiq.ge</div>
            </div>
          ) : displayCategories.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 44, marginBottom: 12 }}>🔍</div>
              <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-main)', marginBottom: 6 }}>
                {t('noSearchResults')} «{searchQuery}»
              </div>
              <button 
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  marginTop: 14,
                  padding: '10px 22px',
                  borderRadius: 'var(--radius-full)',
                  background: 'var(--color-primary)',
                  color: '#fff',
                  border: 'none',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                {t('clearSearch')}
              </button>
            </div>
          ) : (
            displayCategories.map(cat => (
              <section 
                key={cat.id} 
                id={`section-${cat.slug}`} 
                className="category-section-block"
              >
                <h2 className="catalog-section-heading">
                  {cat.name[lang] || cat.name.en}
                </h2>

                <div className="products-grid">
                  {cat.items.map(item => {
                    const size = item.itemSizes[0];
                    const price = size.prices[0].price;
                    const inCart = cart[item.itemId]?.quantity || 0;
                    const imageSrc = size.buttonImage?.src || NO_PHOTO_IMAGE;

                    return (
                      <article 
                        key={item.itemId} 
                        className="product-item-card"
                        onClick={() => handleOpenProduct(item)}
                      >
                        <div className="product-thumb-wrap">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img 
                            src={imageSrc} 
                            alt={item.name[lang] || item.name.en}
                            className="product-thumb-img"
                            loading="lazy"
                            decoding="async"
                          />
                          {typeof item.rating === 'number' && item.rating > 0 && (
                            <div className="rating-badge">
                              <Star size={11} fill="#FFB300" color="#FFB300" />
                              <span>{item.rating}</span>
                            </div>
                          )}
                          {size.portionWeightGrams > 0 && (
                            <div className="product-thumb-weight-badge">
                              {t('portionWeight', { w: size.portionWeightGrams })}
                            </div>
                          )}
                          {item.labels?.[0] && (
                            <div className="label-badge">{item.labels[0]}</div>
                          )}
                        </div>

                        <div className="product-details">
                          <h3 className="product-heading">{item.name[lang] || item.name.en}</h3>
                          {size.portionWeightGrams > 0 && (
                            <div className="product-weight-text">{t('portionWeight', { w: size.portionWeightGrams })}</div>
                          )}

                          <div style={{ marginTop: 'auto' }}>
                            {inCart > 0 ? (
                              <div className="product-counter-bar" onClick={e => e.stopPropagation()}>
                                <button className="counter-action-btn" onClick={() => handleUpdateQty(item.itemId, -1)}>
                                  <Minus size={14} />
                                </button>
                                <span>{inCart}</span>
                                <button className="counter-action-btn" onClick={() => handleUpdateQty(item.itemId, 1)}>
                                  <Plus size={14} />
                                </button>
                              </div>
                            ) : (
                              <button 
                                className="product-cta-btn" 
                                onClick={e => handlePriceClick(item, e)}
                              >
                                {price} GEL
                              </button>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))
          )}
        </main>

        {/* 6. Site Footer */}
        <footer className="site-footer">
          <div className="site-footer__container">
            {/* Brand block with drawn Royal Salmon logo */}
            <div className="site-footer__brand-block">
              <div className="footer-logo-row" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
                <RoyalSalmonLogo height={38} />
                <div className="footer-brand-subtitle">
                  {lang === 'ru' ? 'Премиальная доставка суши в Батуми' : lang === 'ka' ? 'პრემიუმ სუშის მიტანა ბათუმში' : 'Premium Sushi Delivery in Batumi'}
                </div>
              </div>

              <p className="footer-brand-desc">
                {lang === 'ru' 
                  ? 'Свежайший лосось, авторские роллы и сеты ресторанного уровня. Быстрая бережная доставка по всему Батуми и удобный самовывоз.' 
                  : lang === 'ka'
                  ? 'უახლესი ორაგული, საავტორო როლები და პრემიუმ სეტები. სწრაფი მიტანა მთელ ბათუმში.'
                  : 'Fresh salmon, signature rolls and chef sushi sets. Prompt delivery across Batumi and quick pickup.'}
              </p>

              <div className="footer-contacts">
                <a href="tel:+995550505454" className="footer-contact-link">
                  <Phone size={14} /> +995 550 505 454
                </a>
                <span className="footer-dot">•</span>
                <span className="footer-address">
                  <MapPin size={14} /> {lang === 'ru' ? 'Батуми, ул. Джавахишвили, 9' : lang === 'ka' ? 'ბათუმი, ჯავახიშვილის ქ. 9' : 'Batumi, Javakhishvili str. 9'}
                </span>
              </div>
            </div>

            {/* Payment security (Mastercard & Visa) */}
            <div className="site-footer__payments-block">
              <div className="footer-section-title">
                {lang === 'ru' ? 'Принимаем к оплате' : lang === 'ka' ? 'გადახდის მეთოდები' : 'Payment Methods'}
              </div>
              <div className="footer-payment-badges">
                <VisaLogo />
                <MastercardLogo />
              </div>
              <div className="footer-security-text">
                🔒 {lang === 'ru' 
                  ? 'Безопасные онлайн-платежи картами Visa и Mastercard через защищенные шлюзы Bank of Georgia и TBC Bank (PCI DSS, 3-D Secure).' 
                  : lang === 'ka'
                  ? 'უსაფრთხო გადახდები Visa და Mastercard ბარათებით (PCI DSS).'
                  : 'Secure card payments with Visa and Mastercard via Bank of Georgia and TBC Bank gateways (PCI DSS certified).'}
              </div>
            </div>

            {/* Legal Links (Privacy & Terms) */}
            <div className="site-footer__legal-block">
              <div className="footer-section-title">
                {lang === 'ru' ? 'Правила и информация' : lang === 'ka' ? 'ინფორმაცია და წესები' : 'Legal & Info'}
              </div>
              <ul className="footer-links-list">
                <li>
                  <Link href="/privacy" className="footer-link">
                    {lang === 'ru' ? 'Политика конфиденциальности' : lang === 'ka' ? 'კონფიდენციალურობის პოლიტიკა' : 'Privacy Policy'}
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="footer-link">
                    {lang === 'ru' ? 'Пользовательское соглашение' : lang === 'ka' ? 'წესები და პირობები' : 'Terms & Conditions'}
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="site-footer__bottom">
            <div>
              © {new Date().getFullYear()} Royal Salmon Batumi. {lang === 'ru' ? 'Все права защищены.' : lang === 'ka' ? 'ყველა უფლება დაცულია.' : 'All rights reserved.'}
            </div>
            <div className="footer-bottom-links">
              <Link href="/privacy">Privacy Policy</Link>
              <span>•</span>
              <Link href="/terms">Terms & Conditions</Link>
            </div>
          </div>
        </footer>

      </div>

      {/* 7. Sticky Bottom Cart Bar (Mobile View) */}
      {cartItemsCount > 0 && (
        <div className="sticky-bottom-bar-wrapper">
          <button className="sticky-bottom-cart-btn" onClick={() => setIsCartOpen(true)}>
            <span>{t('checkoutButton')} ({cartItemsCount})</span>
            <span>{total} GEL ➔</span>
          </button>
        </div>
      )}

      {/* ==========================================================================
          Product Detail Modal (Compact Image on Mobile & 2-Column on Desktop)
         ========================================================================== */}
      {selectedProduct && (
        <div 
          className="modal-backdrop-layer" 
          onClick={handleCloseProduct}
          onTouchMove={e => {
            if (e.target === e.currentTarget) e.preventDefault();
          }}
        >
          <div className="bottom-sheet-card product-detail-sheet" onClick={e => e.stopPropagation()}>
            <div className="bottom-sheet__drag-handle" />
            <button className="bottom-sheet__close" onClick={handleCloseProduct} aria-label="Close">
              <X size={20} strokeWidth={2.2} />
            </button>

            <div className="desktop-modal-split">
              {/* Left Column on Desktop / Top on Mobile (Photo or No-Photo placeholder) */}
              <div className="desktop-modal-left">
                <div className="bottom-sheet__header">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img 
                    src={selectedProduct.itemSizes[0].buttonImage?.src || NO_PHOTO_IMAGE} 
                    alt={selectedProduct.name[lang] || selectedProduct.name.en}
                    className="bottom-sheet__img"
                    loading="lazy"
                    decoding="async"
                  />
                  {selectedProduct.itemSizes[0].portionWeightGrams > 0 && (
                    <div className="bottom-sheet__weight-badge">
                      {t('portionWeight', { w: selectedProduct.itemSizes[0].portionWeightGrams })}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column on Desktop / Content on Mobile */}
              <div className="desktop-modal-right">
                <div className="bottom-sheet__body">
                  {typeof selectedProduct.rating === 'number' && selectedProduct.rating > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontSize: 13, fontWeight: 700 }}>
                      <Star size={14} fill="#FFB300" color="#FFB300" />
                      <span>{selectedProduct.rating}</span>
                      <span style={{ color: 'var(--text-muted)' }}>({selectedProduct.ratingCount} {t('ratingsText')})</span>
                    </div>
                  )}

                  <h1 className="bottom-sheet__title">{selectedProduct.name[lang] || selectedProduct.name.en}</h1>
                  <p className="bottom-sheet__desc">
                    {selectedProduct.description[lang] || selectedProduct.description.en || t('defaultProductDesc')}
                  </p>

                  {/* Nutrition Accordion (КБЖУ) - only if present in API */}
                  {(selectedProduct.itemSizes[0].nutritions?.[0]?.energy || 0) > 0 && (
                    <div className="kbju-box">
                      <div className="kbju-header" onClick={() => setIsNutritionOpen(!isNutritionOpen)}>
                        <span>{t('kbjuAndIngredients')}</span>
                        {isNutritionOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>

                      {isNutritionOpen && (
                        <div>
                          <div className="kbju-grid">
                            <div className="kbju-cell">
                              <span className="kbju-num">{selectedProduct.itemSizes[0].nutritions[0]?.energy}</span>
                              <span className="kbju-lbl">{t('calories')}</span>
                            </div>
                            <div className="kbju-cell">
                              <span className="kbju-num">{selectedProduct.itemSizes[0].nutritions[0]?.proteins} г</span>
                              <span className="kbju-lbl">{t('proteins')}</span>
                            </div>
                            <div className="kbju-cell">
                              <span className="kbju-num">{selectedProduct.itemSizes[0].nutritions[0]?.fats} г</span>
                              <span className="kbju-lbl">{t('fats')}</span>
                            </div>
                            <div className="kbju-cell">
                              <span className="kbju-num">{selectedProduct.itemSizes[0].nutritions[0]?.carbs} г</span>
                              <span className="kbju-lbl">{t('carbs')}</span>
                            </div>
                          </div>

                          {selectedProduct.allergens?.length > 0 && (
                            <div className="kbju-allergens-text">
                              <b>{t('allergensTitle')}</b> {selectedProduct.allergens.join(', ')}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Modifier Groups (Соусы) */}
                  {selectedProduct.itemSizes[0].itemModifierGroups?.[0] && (
                    <div className="mod-group-section">
                      <div className="mod-group-header">
                        <span className="mod-group-name">{t('chooseSauceTitle')}</span>
                        <span className={`mod-badge-rule ${selectedModifier ? 'active' : ''}`}>
                          {selectedModifier ? t('ruleBadgeComplete') : t('ruleBadgeEmpty')}
                        </span>
                      </div>

                      <div className="modifiers-tiles-grid">
                        {selectedProduct.itemSizes[0].itemModifierGroups[0].modifiers.map(m => {
                          const isSelected = selectedModifier?.id === m.id;
                          return (
                            <div 
                              key={m.id}
                              className={`modifier-tile-card ${isSelected ? 'selected' : ''}`}
                              onClick={() => setSelectedModifier(isSelected ? null : m)}
                            >
                              <div className="modifier-thumb-circle">
                                🥣
                              </div>
                              <div className="modifier-tile-name">{m.name[lang] || m.name.en}</div>
                              <div className="modifier-tile-price">
                                {isSelected ? '✓' : '+0 GEL'}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div className="bottom-sheet__footer">
                  <button className="bottom-cta-add-btn" onClick={handleAddToCartFromModal}>
                    <span>{t('addToCart')}</span>
                    <span>{selectedProduct.itemSizes[0].prices[0].price} GEL</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================================================
          Cart Drawer / Modal
         ========================================================================== */}
      {isCartOpen && (
        <div 
          className="modal-backdrop-layer" 
          onClick={() => setIsCartOpen(false)}
          onTouchMove={e => {
            if (e.target === e.currentTarget) e.preventDefault();
          }}
        >
          <div className="bottom-sheet-card" style={{ maxWidth: 540 }} onClick={e => e.stopPropagation()}>
            <div className="bottom-sheet__drag-handle" />
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800 }}>{t('cartTitle')} ({cartItemsCount})</h2>
              <button onClick={() => setIsCartOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: 20, overflowY: 'auto', flex: '1 1 auto', minHeight: 0 }}>
              {cartEntries.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>🍣</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)', marginBottom: 6 }}>{t('cartEmpty')}</div>
                  <p style={{ fontSize: 13 }}>{t('cartEmptyDesc')}</p>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 18 }}>
                    {cartEntries.map(({ item, quantity, modifier }) => {
                      const itemImg = item.itemSizes[0].buttonImage?.src || NO_PHOTO_IMAGE;
                      return (
                        <div key={item.itemId} style={{ display: 'flex', gap: 14, alignItems: 'center', paddingBottom: 14, borderBottom: '1px solid var(--border-subtle)' }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img 
                            src={itemImg} 
                            alt="" 
                            style={{ width: 64, height: 64, borderRadius: 12, objectFit: 'cover' }}
                            loading="lazy"
                            decoding="async"
                          />
                          <div style={{ flexGrow: 1 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-main)' }}>{item.name[lang] || item.name.en}</div>
                            {item.itemSizes[0].portionWeightGrams > 0 && (
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginTop: 2 }}>
                                {t('portionWeight', { w: item.itemSizes[0].portionWeightGrams })}
                              </div>
                            )}
                            {modifier && (
                              <div style={{ fontSize: 11, color: 'var(--color-primary)', fontWeight: 600, marginTop: 2 }}>
                                + {modifier.name[lang] || modifier.name.en} (0 GEL)
                              </div>
                            )}
                            <div style={{ fontSize: 14, fontWeight: 800, marginTop: 4 }}>
                              {item.itemSizes[0].prices[0].price * quantity} GEL
                            </div>
                          </div>
                          <div className="product-counter-bar" style={{ width: 94, padding: '4px 8px' }}>
                            <button className="counter-action-btn" onClick={() => handleUpdateQty(item.itemId, -1)}>
                              <Minus size={13} />
                            </button>
                            <span style={{ fontSize: 13 }}>{quantity}</span>
                            <button className="counter-action-btn" onClick={() => handleUpdateQty(item.itemId, 1)}>
                              <Plus size={13} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ background: '#FFF9E6', border: '1px solid #FFE082', borderRadius: 12, padding: 12, marginBottom: 16, fontSize: 13, color: '#664D03' }}>
                    <b>🥢 {t('orderCutleryNotice')}</b> {t('chopsticksLabel')}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                      <span>{t('subtotal')}</span>
                      <span>{subtotal} GEL</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                      <span>{t('deliveryFee')}</span>
                      <span>{deliveryFee === 0 ? t('freeDeliveryBadge') : `${deliveryFee} GEL`}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: 12 }}>
                      <span>{t('taxIncluded')}</span>
                      <span>{(subtotal * 0.18).toFixed(1)} GEL</span>
                    </div>
                  </div>
                </>
              )}
            </div>

            {cartEntries.length > 0 && (
              <div style={{ padding: 16, borderTop: '1px solid var(--border-subtle)', flexShrink: 0, background: 'var(--bg-surface)' }}>
                <button 
                  className="bottom-cta-add-btn" 
                  onClick={() => {
                    setIsCartOpen(false);
                    setIsCheckoutOpen(true);
                    setCheckoutStep(isPhoneVerified ? 2 : 1);
                  }}
                >
                  <span>{t('checkoutButton')}</span>
                  <span>{total} GEL</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==========================================================================
          Checkout & Bank Payment Step
         ========================================================================== */}
      {isCheckoutOpen && (
        <div 
          className="modal-backdrop-layer" 
          onClick={() => setIsCheckoutOpen(false)}
          onTouchMove={e => {
            if (e.target === e.currentTarget) e.preventDefault();
          }}
        >
          <div className="bottom-sheet-card" style={{ maxWidth: 540 }} onClick={e => e.stopPropagation()}>
            {/* Header with Back button and Step Title */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {checkoutStep === 2 && (
                  <button 
                    type="button" 
                    onClick={() => setCheckoutStep(1)} 
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'var(--text-secondary)' }}
                    title={lang === 'ru' ? 'Назад к шагу 1' : 'Back to Step 1'}
                  >
                    <ArrowLeft size={19} />
                  </button>
                )}
                <div>
                  <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>
                    {checkoutStep === 1 
                      ? (lang === 'ru' ? 'Шаг 1: Подтверждение номера' : lang === 'ka' ? 'ნაბიჯი 1: ნომრის დადასტურება' : 'Step 1: Phone Verification')
                      : (lang === 'ru' ? 'Шаг 2: Ввод данных и адрес' : lang === 'ka' ? 'ნაბიჯი 2: მონაცემები და მისამართი' : 'Step 2: Details & Address')}
                  </h2>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {checkoutStep === 1 
                      ? (lang === 'ru' ? 'Введите телефон и код проверки' : 'Verify phone via SMS or Telegram')
                      : (lang === 'ru' ? 'Укажите адрес на карте и способ оплаты' : 'Specify address on map and pay')}
                  </div>
                </div>
              </div>

              <button onClick={() => setIsCheckoutOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                <X size={20} />
              </button>
            </div>

            {/* 2-Step Progress Indicator Bar */}
            <div className="checkout-steps-bar">
              <div 
                className={`checkout-step-pill ${checkoutStep === 1 ? 'active' : ''} ${isPhoneVerified ? 'completed' : ''}`}
                onClick={() => setCheckoutStep(1)}
              >
                <div className="checkout-step-num">{isPhoneVerified ? '✓' : '1'}</div>
                <span>{lang === 'ru' ? '1. Телефон' : lang === 'ka' ? '1. ტელეფონი' : '1. Phone'}</span>
              </div>

              <ChevronRight size={14} className="checkout-step-arrow" />

              <div 
                className={`checkout-step-pill ${checkoutStep === 2 ? 'active' : ''}`}
                onClick={() => {
                  if (isPhoneVerified) setCheckoutStep(2);
                }}
              >
                <div className="checkout-step-num">2</div>
                <span>{lang === 'ru' ? '2. Данные и адрес' : lang === 'ka' ? '2. მისამართი' : '2. Details & Address'}</span>
              </div>
            </div>

            {/* ======================================================================
                STEP 1: Phone Verification
               ====================================================================== */}
            {checkoutStep === 1 && (
              <>
                <div style={{ padding: 20, overflowY: 'auto', flex: '1 1 auto', minHeight: 0 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 16 }}>
                    {/* Phone Input */}
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>
                        {t('customerPhone')} *
                      </label>
                      <input 
                        type="tel" 
                        value={customerPhone}
                        onChange={e => {
                          setCustomerPhone(e.target.value);
                          if (isPhoneVerified) setIsPhoneVerified(false);
                          if (isOtpSent) setIsOtpSent(false);
                        }}
                        placeholder="+995 599 00 00 00"
                        style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border-strong)', fontSize: 14 }}
                      />
                    </div>

                    {/* Verification Method Selector (SMS / Telegram) */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
                          {lang === 'ru' ? 'Способ проверки номера' : lang === 'ka' ? 'ნომრის შემოწმების მეთოდი' : 'Verification Method'} *
                        </label>
                        {isPhoneVerified && (
                          <span style={{ fontSize: 12, color: 'var(--system-green)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <Check size={14} /> {lang === 'ru' ? 'Подтвержден' : lang === 'ka' ? 'დადასტურებულია' : 'Verified'}
                          </span>
                        )}
                      </div>

                      <div className="checkout-verify-selector">
                        <button
                          type="button"
                          className={`verify-method-tab ${verificationMethod === 'sms' ? 'active' : ''}`}
                          onClick={() => {
                            setVerificationMethod('sms');
                            setIsOtpSent(false);
                            setOtpError(null);
                          }}
                        >
                          <MessageSquare size={16} />
                          <span>{lang === 'ru' ? 'СМС' : 'SMS'}</span>
                        </button>

                        <button
                          type="button"
                          className={`verify-method-tab ${verificationMethod === 'telegram' ? 'active' : ''}`}
                          onClick={() => {
                            setVerificationMethod('telegram');
                            setIsOtpSent(false);
                            setOtpError(null);
                          }}
                        >
                          <Send size={15} />
                          <span>{lang === 'ru' ? 'Телеграм' : 'Telegram'}</span>
                        </button>
                      </div>

                      {isPhoneVerified ? (
                        <div className="verify-status-card">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#065F46', fontWeight: 700 }}>
                            <Check size={16} color="#10B981" />
                            <span>{lang === 'ru' ? 'Номер успешно подтвержден' : lang === 'ka' ? 'ნომერი დადასტურებულია' : 'Phone verified successfully'}</span>
                          </div>
                          <button 
                            type="button" 
                            onClick={() => { setIsPhoneVerified(false); setIsOtpSent(false); }}
                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer', textDecoration: 'underline' }}
                          >
                            {lang === 'ru' ? 'Изменить' : 'Change'}
                          </button>
                        </div>
                      ) : (
                        <div className="verify-action-box">
                          {!isOtpSent ? (
                            <div>
                              <button 
                                type="button"
                                className="telegram-otp-verify-btn" 
                                style={{ width: '100%', padding: '12px', fontSize: 13 }}
                                onClick={() => handleSendOtp()}
                                disabled={isSendingOtp || !customerPhone.trim()}
                              >
                                {isSendingOtp 
                                  ? (lang === 'ru' ? 'Отправка...' : 'Sending...') 
                                  : verificationMethod === 'sms'
                                    ? (lang === 'ru' ? 'Отправить СМС с кодом' : 'Send SMS code')
                                    : (lang === 'ru' ? 'Получить код в Telegram' : 'Get code in Telegram')}
                              </button>
                              {!customerPhone.trim() && (
                                <div style={{ fontSize: 11, color: 'var(--system-orange)', marginTop: 6 }}>
                                  ⚠️ {lang === 'ru' ? 'Сначала укажите номер телефона выше' : 'Please enter your phone number above first'}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                {verificationMethod === 'sms'
                                  ? (lang === 'ru' ? 'Введите 4-значный проверочный код из СМС:' : 'Enter 4-digit code from SMS:')
                                  : (lang === 'ru' ? 'Введите 4-значный проверочный код из Telegram:' : 'Enter 4-digit code from Telegram:')}
                              </div>

                              <div className="telegram-otp-inputs-row">
                                <div className="otp-digits">
                                  {[0, 1, 2, 3].map(i => (
                                    <input
                                      key={i}
                                      ref={el => { otpInputRefs.current[i] = el; }}
                                      type="text"
                                      inputMode="numeric"
                                      pattern="[0-9]*"
                                      autoComplete={i === 0 ? 'one-time-code' : 'off'}
                                      aria-label={`${lang === 'ru' ? 'Цифра' : 'Digit'} ${i + 1}`}
                                      value={otpCode[i] || ''}
                                      onChange={e => handleOtpDigitChange(i, e.target.value)}
                                      onKeyDown={e => handleOtpDigitKeyDown(i, e)}
                                      onPaste={e => {
                                        e.preventDefault();
                                        handleOtpDigitChange(0, e.clipboardData.getData('text'), true);
                                      }}
                                      onFocus={e => {
                                        // Keep digits contiguous: never focus past the first empty box
                                        const filled = otpCodeRef.current.length;
                                        if (i > filled) {
                                          otpInputRefs.current[filled]?.focus();
                                        } else {
                                          e.target.select();
                                        }
                                      }}
                                      className="otp-digit-input"
                                      autoFocus={i === 0}
                                    />
                                  ))}
                                </div>
                                <button 
                                  type="button"
                                  className="telegram-otp-verify-btn"
                                  onClick={handleVerifyOtp}
                                  disabled={isVerifyingOtp || otpCode.length < 4}
                                >
                                  {isVerifyingOtp ? '...' : (lang === 'ru' ? 'Подтвердить' : 'Verify')}
                                </button>
                              </div>

                              {otpError && (
                                <div style={{ fontSize: 11, color: 'var(--system-red)', fontWeight: 600 }}>
                                  {otpError}
                                </div>
                              )}

                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                                {verificationMethod === 'telegram' && (
                                  <a 
                                    href={telegramDeepLink || `https://t.me/royalsalmon_bot?start=auth`} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="telegram-bot-direct-btn"
                                    onClick={e => e.stopPropagation()}
                                  >
                                    <Send size={13} /> {t('telegramOpenBotBtn')}
                                  </a>
                                )}

                                <button 
                                  type="button"
                                  onClick={() => handleSendOtp()}
                                  disabled={isSendingOtp}
                                  style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: 11, cursor: 'pointer', textDecoration: 'underline' }}
                                >
                                  {lang === 'ru' ? 'Отправить код повторно' : 'Resend code'}
                                </button>
                              </div>

                              {otpHintCode && (
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', background: 'rgba(51, 190, 191, 0.08)', padding: '5px 10px', borderRadius: 8 }}>
                                  {verificationMethod === 'sms'
                                    ? `📩 Тестовый СМС-код: ${otpHintCode}`
                                    : `💬 Бот @royalsalmon_bot отправил код: ${otpHintCode}`}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Brand & Trust note */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border-subtle)' }}>
                    <RoyalSalmonLogo height={24} />
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      🔒 {lang === 'ru' ? 'Безопасная верификация через Royal Salmon' : 'Secure Verification'}
                    </div>
                  </div>
                </div>

                {/* Step 1 Footer CTA */}
                {isPhoneVerified && (
                  <div style={{ padding: 16, borderTop: '1px solid var(--border-subtle)', flexShrink: 0, background: 'var(--bg-surface)' }}>
                    <button 
                      className="bottom-cta-add-btn" 
                      onClick={() => setCheckoutStep(2)}
                    >
                      <span>{lang === 'ru' ? 'Далее: Ввод данных и адрес' : lang === 'ka' ? 'შემდეგ: მისამართი და გადახდა' : 'Continue: Address & Payment'}</span>
                      <ArrowRight size={18} />
                    </button>
                  </div>
                )}
              </>
            )}

            {/* ======================================================================
                STEP 2: Details, Address on Map, and Payment
               ====================================================================== */}
            {checkoutStep === 2 && (
              <>
                <div style={{ padding: 20, overflowY: 'auto', flex: '1 1 auto', minHeight: 0 }}>
                  
                  {/* Verified Phone Chip */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: 10, padding: '8px 12px', marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#065F46', fontWeight: 700 }}>
                      <Check size={15} color="#10B981" />
                      <span>{customerPhone}</span>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setCheckoutStep(1)}
                      style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: 11, cursor: 'pointer', fontWeight: 600, textDecoration: 'underline' }}
                    >
                      {lang === 'ru' ? 'Изменить номер' : 'Change'}
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
                    {/* 1. Customer Name */}
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>
                        {t('customerName')} *
                      </label>
                      <input 
                        type="text" 
                        value={customerName}
                        onChange={e => setCustomerName(e.target.value)}
                        placeholder={lang === 'ru' ? 'Георгий Беридзе' : 'Giorgi Beridze'}
                        style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border-strong)', fontSize: 14 }}
                      />
                    </div>

                    {/* 2. Delivery Mode Selector (Delivery / Pickup) */}
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                        {lang === 'ru' ? 'Способ получения' : lang === 'ka' ? 'მიღების მეთოდი' : 'Delivery Option'} *
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <button
                          type="button"
                          onClick={() => setDeliveryMode('delivery')}
                          style={{
                            padding: '10px 12px',
                            borderRadius: 10,
                            border: `1.5px solid ${deliveryMode === 'delivery' ? 'var(--color-primary)' : 'var(--border-subtle)'}`,
                            background: deliveryMode === 'delivery' ? 'rgba(51, 190, 191, 0.08)' : '#FFFFFF',
                            color: deliveryMode === 'delivery' ? 'var(--color-primary)' : 'var(--text-secondary)',
                            fontWeight: 700,
                            fontSize: 13,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6
                          }}
                        >
                          <Navigation size={15} />
                          <span>{lang === 'ru' ? 'Доставка' : lang === 'ka' ? 'მიტანა' : 'Delivery'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setDeliveryMode('pickup')}
                          style={{
                            padding: '10px 12px',
                            borderRadius: 10,
                            border: `1.5px solid ${deliveryMode === 'pickup' ? 'var(--color-primary)' : 'var(--border-subtle)'}`,
                            background: deliveryMode === 'pickup' ? 'rgba(51, 190, 191, 0.08)' : '#FFFFFF',
                            color: deliveryMode === 'pickup' ? 'var(--color-primary)' : 'var(--text-secondary)',
                            fontWeight: 700,
                            fontSize: 13,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6
                          }}
                        >
                          <Home size={15} />
                          <span>{lang === 'ru' ? 'Самовывоз' : lang === 'ka' ? 'წაღება' : 'Pickup'}</span>
                        </button>
                      </div>
                    </div>

                    {/* 3. If Delivery: Address Input with Map Toggle and Leaflet Map */}
                    {deliveryMode === 'delivery' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
                              {lang === 'ru' ? 'Адрес доставки (улица, дом)' : lang === 'ka' ? 'მიტანის მისამართი' : 'Delivery Address'} *
                            </label>
                            <button
                              type="button"
                              className="checkout-map-toggle-btn"
                              onClick={() => setIsMapVisible(prev => !prev)}
                            >
                              <MapPin size={14} />
                              <span>
                                {isMapVisible 
                                  ? (lang === 'ru' ? 'Свернуть карту' : 'Hide map') 
                                  : (lang === 'ru' ? 'Указать точку на карте' : 'Pick on map')}
                              </span>
                            </button>
                          </div>

                          <input 
                            type="text" 
                            value={deliveryAddress}
                            onChange={e => setDeliveryAddress(e.target.value)}
                            placeholder={lang === 'ru' ? 'Батуми, ул. Джавахишвили, 9' : 'Javakhishvili str. 9, Batumi'}
                            style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border-strong)', fontSize: 14 }}
                          />
                        </div>

                        {/* Interactive Batumi Map with Marker & Geocoding */}
                        {isMapVisible && (
                          <AddressMapPicker
                            initialCoordinates={deliveryCoordinates}
                            initialAddress={deliveryAddress}
                            lang={lang}
                            height={240}
                            onSelectLocation={({ lat, lng, address: pickedAddress }) => {
                              setDeliveryCoordinates({ lat, lng });
                              if (pickedAddress) {
                                setDeliveryAddress(pickedAddress);
                              }
                            }}
                          />
                        )}

                        {/* Additional Address Details Grid */}
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>
                            {lang === 'ru' ? 'Детали адреса (необязательно)' : 'Address details'}
                          </label>
                          <div className="checkout-address-grid">
                            <input 
                              type="text" 
                              value={apartment}
                              onChange={e => setApartment(e.target.value)}
                              placeholder={lang === 'ru' ? 'Кв./офис' : 'Apt'}
                              style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-subtle)', fontSize: 13 }}
                            />
                            <input 
                              type="text" 
                              value={entrance}
                              onChange={e => setEntrance(e.target.value)}
                              placeholder={lang === 'ru' ? 'Подъезд' : 'Ent'}
                              style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-subtle)', fontSize: 13 }}
                            />
                            <input 
                              type="text" 
                              value={floor}
                              onChange={e => setFloor(e.target.value)}
                              placeholder={lang === 'ru' ? 'Этаж' : 'Floor'}
                              style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-subtle)', fontSize: 13 }}
                            />
                            <input 
                              type="text" 
                              value={intercom}
                              onChange={e => setIntercom(e.target.value)}
                              placeholder={lang === 'ru' ? 'Домофон' : 'Intercom'}
                              style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-subtle)', fontSize: 13 }}
                            />
                          </div>
                        </div>

                        {/* Comment to courier */}
                        <div>
                          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>
                            {t('customerComment')}
                          </label>
                          <input 
                            type="text" 
                            value={customerComment}
                            onChange={e => setCustomerComment(e.target.value)}
                            placeholder={lang === 'ru' ? 'Например: код домофона, шлагбаум' : 'e.g. entrance code, barrier'}
                            style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border-strong)', fontSize: 14 }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div style={{ background: '#F8FAFC', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 14, color: 'var(--text-main)' }}>
                          <MapPin size={16} color="var(--color-primary)" />
                          <span>{t('pickupAddress')}</span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                          {lang === 'ru' ? 'Ресторан Royal Salmon, Батуми. Время готовности заказа: 20–30 минут.' : 'Royal Salmon restaurant, Batumi. Prep time: 20-30 min.'}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Bank Payment Options */}
                  <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 12 }}>{t('paymentMethodTitle')}</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                    
                    {/* Card */}
                    <div 
                      onClick={() => setPaymentMethod('card_online')}
                      style={{
                        border: `2px solid ${paymentMethod === 'card_online' ? 'var(--color-primary)' : 'var(--border-subtle)'}`,
                        borderRadius: 12,
                        padding: 12,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        cursor: 'pointer',
                        background: paymentMethod === 'card_online' ? 'var(--color-primary-subtle)' : '#fff'
                      }}
                    >
                      <CreditCard size={24} color="var(--color-primary)" />
                      <div style={{ flexGrow: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>{t('payCard')}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                          <PaymentBadges />
                        </div>
                      </div>
                      {paymentMethod === 'card_online' && <Check size={18} color="var(--color-primary)" />}
                    </div>

                    {/* Cash */}
                    <div 
                      onClick={() => setPaymentMethod('cash')}
                      style={{
                        border: `2px solid ${paymentMethod === 'cash' ? 'var(--color-primary)' : 'var(--border-subtle)'}`,
                        borderRadius: 12,
                        padding: 12,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        cursor: 'pointer',
                        background: paymentMethod === 'cash' ? 'var(--color-primary-subtle)' : '#fff'
                      }}
                    >
                      <span style={{ fontSize: 22 }}>💵</span>
                      <div style={{ flexGrow: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>{t('payCash')}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {lang === 'ru' ? 'Оплата наличными при получении заказа' : lang === 'ka' ? 'ნაღდი ანგარიშსწორება მიღებისას' : 'Pay in cash on receipt'}
                        </div>
                      </div>
                      {paymentMethod === 'cash' && <Check size={18} color="var(--color-primary)" />}
                    </div>

                    {/* Royal Salmon Bottom Logo & Security */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border-subtle)' }}>
                      <RoyalSalmonLogo height={26} />
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        🔒 {lang === 'ru' ? 'Безопасная оплата • Visa & Mastercard' : 'Secure Checkout • Visa & Mastercard'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Step 2 Bottom Payment Button */}
                <div style={{ padding: 16, borderTop: '1px solid var(--border-subtle)', flexShrink: 0, background: 'var(--bg-surface)' }}>
                  <button 
                    className="bottom-cta-add-btn" 
                    disabled={isPaying}
                    onClick={handleProcessBankPayment}
                  >
                    <span>{paymentMethod === 'cash'
                      ? (lang === 'ru' ? 'Оформить заказ' : lang === 'ka' ? 'შეკვეთის გაფორმება' : 'Place order')
                      : isPaying ? 'Соединение с банком...' : t('proceedToBank', { amount: total })}</span>
                    <span>{total} GEL</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ==========================================================================
          Order Confirmation Screen
         ========================================================================== */}
      {confirmedOrder && (
        <div 
          className="modal-backdrop-layer"
          onTouchMove={e => {
            if (e.target === e.currentTarget) e.preventDefault();
          }}
        >
          <div className="bottom-sheet-card" style={{ maxWidth: 480, padding: 28, textAlign: 'center' }}>
            <div className="bottom-sheet__drag-handle" style={{ marginTop: 0, marginBottom: 16 }} />
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--system-green-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: 'var(--system-green)' }}>
              <Check size={36} />
            </div>

            <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>{t('orderSuccessTitle')}</h2>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20 }}>
              {t('orderSuccessDesc', { num: confirmedOrder.orderNumber })}
            </p>

            <div style={{ background: 'var(--bg-muted)', borderRadius: 12, padding: 14, textAlign: 'left', marginBottom: 20, fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ color: 'var(--text-muted)' }}>Статус оплаты:</span>
                <span style={{ color: 'var(--system-green)', fontWeight: 700 }}>
                  {confirmedOrder.paymentStatus === 'paid' ? 'Оплачено картой ✓' : 'Наличными при получении'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ color: 'var(--text-muted)' }}>Сумма заказа:</span>
                <span style={{ fontWeight: 800 }}>{confirmedOrder.total} GEL</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Адрес:</span>
                <span style={{ fontWeight: 600 }}>{confirmedOrder.address}</span>
              </div>
            </div>

            {isPhoneVerified && verificationMethod === 'telegram' && (
              <div style={{ 
                background: 'linear-gradient(135deg, rgba(34, 158, 217, 0.08) 0%, rgba(51, 190, 191, 0.12) 100%)', 
                border: '1.5px solid rgba(34, 158, 217, 0.35)', 
                borderRadius: 14, 
                padding: '12px 14px', 
                marginBottom: 20, 
                fontSize: 13, 
                color: 'var(--text-main)', 
                display: 'flex', 
                alignItems: 'center', 
                gap: 10, 
                textAlign: 'left' 
              }}>
                <span style={{ fontSize: 22, flexShrink: 0 }}>✈️</span>
                <span><b>{t('telegramOrderSentNotice')}</b></span>
              </div>
            )}
            {isPhoneVerified && verificationMethod === 'sms' && (
              <div style={{ 
                background: 'rgba(51, 190, 191, 0.08)', 
                border: '1.5px solid rgba(51, 190, 191, 0.35)', 
                borderRadius: 14, 
                padding: '12px 14px', 
                marginBottom: 20, 
                fontSize: 13, 
                color: 'var(--text-main)', 
                display: 'flex', 
                alignItems: 'center', 
                gap: 10, 
                textAlign: 'left' 
              }}>
                <span style={{ fontSize: 22, flexShrink: 0 }}>📩</span>
                <span><b>{lang === 'ru' ? 'Детали и статус заказа отправлены в СМС' : 'Order details sent via SMS'}</b></span>
              </div>
            )}

            <button 
              className="bottom-cta-add-btn" 
              style={{ justifyContent: 'center' }}
              onClick={() => setConfirmedOrder(null)}
            >
              {t('backToCatalog')}
            </button>
          </div>
        </div>
      )}

      {/* Address Selector Modal */}
      {isAddressModalOpen && (
        <div 
          className="modal-backdrop-layer" 
          onClick={() => setIsAddressModalOpen(false)}
          onTouchMove={e => {
            if (e.target === e.currentTarget) e.preventDefault();
          }}
        >
          <div className="bottom-sheet-card" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <div className="bottom-sheet__drag-handle" />
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <h3 style={{ fontSize: 16, fontWeight: 800 }}>{t('enterAddressPrompt')}</h3>
              <button onClick={() => setIsAddressModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: 16 }}>
              <input 
                type="text" 
                value={tempAddress} 
                onChange={e => setTempAddress(e.target.value)}
                placeholder="Батуми, ул. Джавахишвили, 9"
                style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border-strong)', fontSize: 14, marginBottom: 14 }}
              />
              <div style={{ marginBottom: 14 }}>
                <AddressMapPicker
                  initialCoordinates={tempCoordinates || deliveryCoordinates}
                  initialAddress={tempAddress}
                  lang={lang}
                  height={240}
                  onSelectLocation={({ lat, lng, address: pickedAddress }) => {
                    setTempCoordinates({ lat, lng });
                    if (pickedAddress) {
                      setTempAddress(pickedAddress);
                    }
                  }}
                />
              </div>
              <button
                className="bottom-cta-add-btn"
                style={{ justifyContent: 'center' }}
                onClick={() => {
                  setAddress(tempAddress);
                  setDeliveryAddress(tempAddress);
                  if (tempCoordinates) {
                    setDeliveryCoordinates(tempCoordinates);
                  }
                  setIsAddressModalOpen(false);
                }}
              >
                {t('saveAddress')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Slide-out Drawer Navigation */}
      <div 
        className={`drawer-overlay ${isDrawerOpen ? 'active' : ''}`}
        onClick={() => setIsDrawerOpen(false)}
      />
      <div 
        className={`drawer-content ${isDrawerOpen ? 'active' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={t('menuNavigation')}
      >
        {/* Drawer Header */}
        <div className="drawer-header">
          <Link href="/" className="drawer-brand" onClick={() => setIsDrawerOpen(false)}>
            <span style={{ fontSize: 24 }}>👑</span>
            <span className="drawer-title">Royal Salmon</span>
          </Link>
          <button 
            className="drawer-close-btn" 
            onClick={() => setIsDrawerOpen(false)}
            aria-label={t('closeMenu')}
          >
            <X size={18} />
          </button>
        </div>

        {/* Drawer Scrollable Body */}
        <div className="drawer-body">
          {/* Restaurant Schedule & Location Card */}
          <div className="drawer-info-card">
            <div className="drawer-info-card-item">
              <span>📍</span>
              <span>Батуми, ул. Джавахишвили, 9</span>
            </div>
            <div className="drawer-info-card-item">
              <span>🕒</span>
              <span>{t('restaurantSchedule')}</span>
            </div>
            <div className="drawer-info-card-item">
              <span>📞</span>
              <span>+995 550 505 454</span>
            </div>
          </div>

          {/* Menu Categories with Auto-scroll */}
          <div>
            <div className="drawer-section-title">{t('catalogCategories')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
              {categories.map(cat => {
                const isActive = activeCategory === cat.slug;
                return (
                  <button
                    key={cat.id}
                    className={`drawer-category-chip ${isActive ? 'active' : ''}`}
                    onClick={() => {
                      setIsDrawerOpen(false);
                      scrollToCategory(cat.slug);
                    }}
                  >
                    <span>🍱 {cat.name[lang] || cat.name.en}</span>
                    <span className="drawer-category-count">{cat.items.length}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Site Sections */}
          <div>
            <div className="drawer-section-title">{t('menuNavigation')}</div>
            <div className="drawer-links-group" style={{ marginTop: 8 }}>
              <button 
                className="drawer-link" 
                onClick={() => {
                  setIsDrawerOpen(false);
                  setActiveInfoModal('bonuses');
                }}
              >
                <div className="drawer-link-left">
                  <span className="drawer-link-icon">🎁</span>
                  <span>{t('bonuses')}</span>
                </div>
                <span style={{ fontSize: 13, color: 'var(--color-primary)' }}>➔</span>
              </button>

              <button 
                className="drawer-link" 
                onClick={() => {
                  setIsDrawerOpen(false);
                  setActiveInfoModal('promos');
                }}
              >
                <div className="drawer-link-left">
                  <span className="drawer-link-icon">🔥</span>
                  <span>{t('promos')}</span>
                </div>
                <span style={{ fontSize: 13, color: 'var(--color-primary)' }}>➔</span>
              </button>

              <button 
                className="drawer-link" 
                onClick={() => {
                  setIsDrawerOpen(false);
                  setActiveInfoModal('delivery');
                }}
              >
                <div className="drawer-link-left">
                  <span className="drawer-link-icon">🚚</span>
                  <span>{t('delivTerms')}</span>
                </div>
                <span style={{ fontSize: 13, color: 'var(--color-primary)' }}>➔</span>
              </button>

              <button 
                className="drawer-link" 
                onClick={() => {
                  setIsDrawerOpen(false);
                  setActiveInfoModal('faq');
                }}
              >
                <div className="drawer-link-left">
                  <span className="drawer-link-icon">❓</span>
                  <span>{t('faq')}</span>
                </div>
                <span style={{ fontSize: 13, color: 'var(--color-primary)' }}>➔</span>
              </button>

              <button 
                className="drawer-link" 
                onClick={() => {
                  setIsDrawerOpen(false);
                  setActiveInfoModal('contacts');
                }}
              >
                <div className="drawer-link-left">
                  <span className="drawer-link-icon">📞</span>
                  <span>{t('contacts')}</span>
                </div>
                <span style={{ fontSize: 13, color: 'var(--color-primary)' }}>➔</span>
              </button>
            </div>
          </div>

          {/* Language Switcher in Drawer */}
          <div>
            <div className="drawer-section-title" style={{ marginBottom: 8 }}>Язык / Language</div>
            <div className="lang-switcher" style={{ width: '100%', justifyContent: 'stretch' }}>
              <button 
                className={`lang-btn ${lang === 'ru' ? 'active' : ''}`}
                style={{ flex: 1, padding: '8px 0', textAlign: 'center' }}
                onClick={() => setLang('ru')}
              >
                RU
              </button>
              <button 
                className={`lang-btn ${lang === 'ka' ? 'active' : ''}`}
                style={{ flex: 1, padding: '8px 0', textAlign: 'center' }}
                onClick={() => setLang('ka')}
              >
                GE
              </button>
              <button 
                className={`lang-btn ${lang === 'en' ? 'active' : ''}`}
                style={{ flex: 1, padding: '8px 0', textAlign: 'center' }}
                onClick={() => setLang('en')}
              >
                EN
              </button>
            </div>
          </div>
        </div>

        {/* Drawer Footer with Telegram Bot & Admin Panel Link */}
        <div className="drawer-footer">
          <a 
            href="https://t.me/royalsalmon_bot" 
            target="_blank" 
            rel="noreferrer" 
            className="drawer-tg-btn"
          >
            <span>✈️</span>
            <span>@royalsalmon_bot в Telegram</span>
          </a>
          <Link 
            href="/admin" 
            className="drawer-admin-btn"
            onClick={() => setIsDrawerOpen(false)}
          >
            <span>🛡️</span>
            <span>{t('adminLink')}</span>
          </Link>
        </div>
      </div>

      {/* Information Modal from Drawer (Bonuses, Promos, Delivery, FAQ, Contacts) */}
      {activeInfoModal && (
        <div 
          className="modal-backdrop-layer" 
          onClick={() => setActiveInfoModal(null)}
          onTouchMove={e => {
            if (e.target === e.currentTarget) e.preventDefault();
          }}
        >
          <div className="bottom-sheet-card" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div className="bottom-sheet__drag-handle" />
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 22 }}>
                  {activeInfoModal === 'bonuses' && '🎁'}
                  {activeInfoModal === 'promos' && '🔥'}
                  {activeInfoModal === 'delivery' && '🚚'}
                  {activeInfoModal === 'faq' && '❓'}
                  {activeInfoModal === 'contacts' && '📞'}
                </span>
                <h3 style={{ fontSize: 17, fontWeight: 800 }}>
                  {activeInfoModal === 'bonuses' && t('bonuses')}
                  {activeInfoModal === 'promos' && t('promos')}
                  {activeInfoModal === 'delivery' && t('delivTerms')}
                  {activeInfoModal === 'faq' && t('faq')}
                  {activeInfoModal === 'contacts' && t('contacts')}
                </h3>
              </div>
              <button onClick={() => setActiveInfoModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '20px', overflowY: 'auto', maxHeight: '70vh', fontSize: 14, lineHeight: 1.6, color: 'var(--text-main)' }}>
              {activeInfoModal === 'bonuses' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ background: 'var(--bg-muted)', padding: 14, borderRadius: 12, border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-primary)', marginBottom: 4 }}>
                      {lang === 'ru' ? 'Кэшбэк до 10% на каждый заказ' : lang === 'ka' ? 'ქეშბექი 10%-მდე თითოეულ შეკვეთაზე' : 'Up to 10% Cashback on Every Order'}
                    </div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                      {t('bonusesDesc')}
                    </p>
                  </div>
                  <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <li><b>1 бонус = 1 GEL</b> скидки на следующий заказ.</li>
                    <li>Бонусы начисляются автоматически по номеру телефона при подтверждении заказа.</li>
                    <li>Оплачивайте до 50% суммы чека накопленными баллами.</li>
                  </ul>
                </div>
              )}

              {activeInfoModal === 'promos' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ background: 'linear-gradient(135deg, rgba(255, 179, 0, 0.12) 0%, rgba(255, 107, 107, 0.1) 100%)', padding: 16, borderRadius: 12, border: '1px solid rgba(255, 179, 0, 0.3)' }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#D97706', marginBottom: 4 }}>
                      🔥 {t('bannerTitle')}
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--text-main)' }}>
                      {t('bannerSubtitle')}
                    </p>
                  </div>
                  <div style={{ background: 'var(--bg-muted)', padding: 14, borderRadius: 12, border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>🎂 Скидка 15% ко дню рождения</div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Действует в день рождения и 3 дня после него при оформлении доставки или самовывоза.</p>
                  </div>
                </div>
              )}

              {activeInfoModal === 'delivery' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ background: 'var(--color-primary-subtle)', padding: 14, borderRadius: 12, border: '1px solid rgba(51, 190, 191, 0.3)' }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-primary)', marginBottom: 4 }}>
                      🚚 {lang === 'ru' ? 'Бесплатная доставка от 100 GEL' : lang === 'ka' ? 'უფასო მიტანა 100 GEL-დან' : 'Free Delivery from 100 GEL'}
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--text-main)' }}>
                      {t('deliveryDesc')}
                    </p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                    <div>📍 <b>Зона доставки:</b> Батуми и прилегающие районы.</div>
                    <div>⏱️ <b>Время доставки:</b> 35 – 50 минут с момента подтверждения.</div>
                    <div>💵 <b>Стоимость доставки:</b> 5 GEL (при заказе менее 100 GEL).</div>
                    <div>🍱 <b>Упаковка:</b> Премиальные герметичные боксы с сохранением свежести.</div>
                  </div>
                </div>
              )}

              {activeInfoModal === 'faq' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ background: 'var(--bg-muted)', padding: 12, borderRadius: 10 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>🥢 Входят ли палочки и соусы в состав сетов?</div>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Соевый соус, имбирь, васаби и учебные палочки добавляются отдельно при оформлении заказа в корзине.</p>
                  </div>
                  <div style={{ background: 'var(--bg-muted)', padding: 12, borderRadius: 10 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>💳 Какие способы оплаты доступны?</div>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Bank of Georgia iPay, TBC Checkout, банковские карты Visa / Mastercard или наличные / POS-терминал курьеру.</p>
                  </div>
                  <div style={{ background: 'var(--bg-muted)', padding: 12, borderRadius: 10 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>🐟 Откуда поставляется рыба?</div>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Мы используем исключительно свежий охлажденный норвежский лосось высшей категории качества.</p>
                  </div>
                </div>
              )}

              {activeInfoModal === 'contacts' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ background: 'var(--bg-muted)', padding: 14, borderRadius: 12, border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>👑 Royal Salmon Batumi</div>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Ресторан японской кухни премиум-класса</p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14 }}>
                    <div>📍 <b>Адрес:</b> г. Батуми, ул. Джавахишвили, 9</div>
                    <div>🕒 <b>Время работы:</b> Ежедневно с 11:00 до 23:00</div>
                    <div>📞 <b>Телефон:</b> <a href="tel:+995550505454" style={{ color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 700 }}>+995 550 505 454</a></div>
                    <div>✈️ <b>Telegram Бот:</b> <a href="https://t.me/royalsalmon_bot" target="_blank" rel="noreferrer" style={{ color: '#229ED9', textDecoration: 'none', fontWeight: 700 }}>@royalsalmon_bot</a></div>
                  </div>
                </div>
              )}
            </div>

            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-muted)', textAlign: 'right' }}>
              <button 
                className="bottom-cta-add-btn" 
                style={{ justifyContent: 'center' }}
                onClick={() => setActiveInfoModal(null)}
              >
                {t('closeMenu')}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
