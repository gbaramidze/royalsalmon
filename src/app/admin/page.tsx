'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Customer, ItemCategory, Language, Order, OrderStatus } from '@/types';
import { initialCategories } from '@/lib/data';
import { getTranslation } from '@/lib/i18n';
import { 
  TrendingUp, 
  ShoppingBag, 
  Users, 
  DollarSign, 
  ArrowLeft, 
  Search, 
  Clock, 
  CheckCircle2, 
  Truck, 
  Flame, 
  XCircle,
  Filter,
  RefreshCw,
  LogOut
} from 'lucide-react';

const ADMIN_PASSWORD_KEY = 'rs_admin_password';
const ADMIN_REFRESH_MS = 30000;

interface DailySales {
  day: string;
  revenue: number;
  orders: number;
}

function readSavedPassword(): string {
  try {
    return sessionStorage.getItem(ADMIN_PASSWORD_KEY) || '';
  } catch {
    return '';
  }
}

export default function AdminDashboardPage() {
  const [lang, setLang] = useState<Language>('ru');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'orders' | 'customers' | 'menu'>('dashboard');
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [dailySales, setDailySales] = useState<DailySales[]>([]);
  const [adminPassword, setAdminPassword] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [categories, setCategories] = useState<ItemCategory[]>(initialCategories);
  const [orderFilter, setOrderFilter] = useState<string>('all');
  const [customerSearch, setCustomerSearch] = useState<string>('');
  const [copiedCourierLinkId, setCopiedCourierLinkId] = useState<string | null>(null);

  const t = (key: Parameters<typeof getTranslation>[1], params?: Record<string, string | number>) => 
    getTranslation(lang, key, params);

  // Fetch live menu from RestIQ API URL
  useEffect(() => {
    fetch('/api/menu')
      .then(res => res.json())
      .then(data => {
        if (data?.categories?.length > 0) {
          setCategories(data.categories);
        }
      })
      .catch(err => console.error('Failed to load menu for admin:', err));
  }, []);

  const logout = useCallback((message: string | null = null) => {
    try {
      sessionStorage.removeItem(ADMIN_PASSWORD_KEY);
    } catch {
      // Storage unavailable: the password just isn't remembered
    }
    setAdminPassword('');
    setAuthError(message);
  }, []);

  // Orders, customers and sales come from the database
  const loadOverview = useCallback(async (password: string) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/overview', {
        headers: { 'x-admin-password': password },
        cache: 'no-store'
      });
      const data = await res.json().catch(() => null);
      if (res.status === 401 || res.status === 503) {
        logout(data?.error || 'Неверный пароль');
        return;
      }
      if (!res.ok || !data?.success) {
        setLoadError(data?.error || 'Не удалось загрузить данные');
        return;
      }
      setOrders(data.orders);
      setCustomers(data.customers);
      setDailySales(data.dailySales);
      setLoadError(null);
    } catch (err) {
      console.error('Failed to load admin data:', err);
      setLoadError('Нет связи с сервером');
    } finally {
      setIsLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    setAdminPassword(readSavedPassword());
  }, []);

  // Keep the order list fresh while the panel is open
  useEffect(() => {
    if (!adminPassword) return;
    loadOverview(adminPassword);
    const timer = setInterval(() => loadOverview(adminPassword), ADMIN_REFRESH_MS);
    return () => clearInterval(timer);
  }, [adminPassword, loadOverview]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const password = passwordInput.trim();
    if (!password) return;
    try {
      sessionStorage.setItem(ADMIN_PASSWORD_KEY, password);
    } catch {
      // Storage unavailable: the password lasts until the page is reloaded
    }
    setPasswordInput('');
    setAuthError(null);
    setAdminPassword(password);
  };

  const handleUpdateOrderStatus = async (orderId: string, newStatus: OrderStatus) => {
    const previous = orders;
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));

    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': adminPassword },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.status === 401) return logout('Сессия истекла, войдите снова');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      console.error('Failed to update order status:', err);
      setOrders(previous);
      alert('Не удалось сохранить статус заказа.');
    }
  };

  // Link the courier opens on the phone to share the live position with the customer
  const handleCourierLink = async (orderId: string) => {
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/courier-link`, {
        headers: { 'x-admin-password': adminPassword }
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.path) {
        alert('Заказ не найден на сервере — ссылку курьера создать нельзя.');
        return;
      }
      const url = `${window.location.origin}${data.path}`;
      if (navigator.share) {
        await navigator.share({ title: 'Royal Salmon — заказ для курьера', url }).catch(() => {});
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopiedCourierLinkId(orderId);
      setTimeout(() => setCopiedCourierLinkId(prev => (prev === orderId ? null : prev)), 2000);
    } catch (err) {
      console.error('Failed to get courier link:', err);
      alert('Не удалось получить ссылку курьера.');
    }
  };

  // Calculations for Sales Report
  const totalRevenue = orders.reduce((acc, o) => acc + (o.paymentStatus === 'paid' ? o.total : 0), 0);
  const totalOrdersCount = orders.length;
  const avgCheck = totalOrdersCount > 0 ? (totalRevenue / totalOrdersCount).toFixed(1) : 0;
  const newOrdersCount = orders.filter(o => o.status === 'new').length;

  const filteredOrders = orderFilter === 'all' 
    ? orders 
    : orders.filter(o => o.status === orderFilter);

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) || 
    c.phone.includes(customerSearch)
  );

  const maxDailyRevenue = Math.max(1, ...dailySales.map(d => d.revenue));

  if (!adminPassword) {
    return (
      <div className="admin-page-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <form onSubmit={handleLogin} className="admin-data-card" style={{ padding: 24, width: '100%', maxWidth: 360 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>👑</div>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px', color: '#fff' }}>{t('adminTitle')}</h1>
          <p style={{ fontSize: 13, color: '#8da4b4', margin: '0 0 16px' }}>Введите пароль администратора</p>
          <input
            type="password"
            autoFocus
            autoComplete="current-password"
            aria-label="Пароль администратора"
            value={passwordInput}
            onChange={e => setPasswordInput(e.target.value)}
            style={{
              width: '100%',
              background: '#0c131a',
              border: '1px solid #233342',
              borderRadius: 10,
              padding: '10px 14px',
              color: '#fff',
              fontSize: 14,
              marginBottom: 12
            }}
          />
          {authError && <div style={{ color: '#ff6b6b', fontSize: 13, marginBottom: 12 }}>{authError}</div>}
          <button type="submit" className="admin-tab-btn active" style={{ width: '100%' }}>Войти</button>
        </form>
      </div>
    );
  }

  return (
    <div className="admin-page-container">
      {/* Admin Header */}
      <header className="admin-header">
        <div>
          <div className="admin-header__brand">
            <span style={{ fontSize: 28 }}>👑</span>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: '#fff' }}>
                {t('adminTitle')}
              </h1>
              <p style={{ fontSize: 13, color: '#8da4b4', margin: '2px 0 0' }}>
                {t('adminSubtitle')}
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Back to Client Storefront */}
          <Link 
            href="/" 
            className="admin-tab-btn"
            style={{ display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}
          >
            <ArrowLeft size={16} />
            <span>{t('clientStoreLink')}</span>
          </Link>

          <button
            type="button"
            className="admin-tab-btn"
            onClick={() => loadOverview(adminPassword)}
            disabled={isLoading}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <RefreshCw size={16} />
            <span>{isLoading ? 'Обновляем…' : 'Обновить'}</span>
          </button>

          <button
            type="button"
            className="admin-tab-btn"
            onClick={() => logout()}
            aria-label="Выйти"
            title="Выйти"
            style={{ display: 'flex', alignItems: 'center' }}
          >
            <LogOut size={16} />
          </button>

          {/* Language Switcher */}
          <div className="lang-switcher">
            <button className={`lang-btn ${lang === 'ru' ? 'active' : ''}`} onClick={() => setLang('ru')}>RU</button>
            <button className={`lang-btn ${lang === 'ka' ? 'active' : ''}`} onClick={() => setLang('ka')}>GE</button>
            <button className={`lang-btn ${lang === 'en' ? 'active' : ''}`} onClick={() => setLang('en')}>EN</button>
          </div>
        </div>
      </header>

      {loadError && (
        <div className="admin-data-card" style={{ padding: 14, marginBottom: 16, color: '#ff6b6b', fontSize: 13 }}>
          {loadError}
        </div>
      )}

      {/* Admin Tabs */}
      <nav className="admin-tabs-nav">
        <button 
          className={`admin-tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          📊 {t('tabDashboard')}
        </button>
        <button 
          className={`admin-tab-btn ${activeTab === 'orders' ? 'active' : ''}`}
          onClick={() => setActiveTab('orders')}
        >
          📦 {t('tabOrders')} {newOrdersCount > 0 && `(${newOrdersCount})`}
        </button>
        <button 
          className={`admin-tab-btn ${activeTab === 'customers' ? 'active' : ''}`}
          onClick={() => setActiveTab('customers')}
        >
          👥 {t('tabCustomers')}
        </button>
        <button 
          className={`admin-tab-btn ${activeTab === 'menu' ? 'active' : ''}`}
          onClick={() => setActiveTab('menu')}
        >
          🍣 {t('tabMenu')}
        </button>
      </nav>

      {/* ==========================================================================
          1. DASHBOARD & SALES REPORT
         ========================================================================== */}
      {activeTab === 'dashboard' && (
        <div>
          {/* Metrics Row */}
          <div className="stats-grid">
            <div className="stat-card">
              <span className="stat-card__label">{t('metricRevenue')}</span>
              <div className="stat-card__value">{totalRevenue} GEL</div>
              <span style={{ fontSize: 12, color: '#8da4b4' }}>Оплаченные заказы</span>
            </div>

            <div className="stat-card">
              <span className="stat-card__label">{t('metricOrders')}</span>
              <div className="stat-card__value">{totalOrdersCount}</div>
              <span style={{ fontSize: 12, color: '#8da4b4' }}>Новых: {newOrdersCount}</span>
            </div>

            <div className="stat-card">
              <span className="stat-card__label">{t('metricAvgCheck')}</span>
              <div className="stat-card__value">{avgCheck} GEL</div>
              <span style={{ fontSize: 12, color: '#8da4b4' }}>По всем заказам</span>
            </div>

            <div className="stat-card">
              <span className="stat-card__label">{t('metricCustomers')}</span>
              <div className="stat-card__value">{customers.length}</div>
              <span style={{ fontSize: 12, color: '#8da4b4' }}>
                Постоянных: {customers.filter(c => c.ordersCount > 1).length}
              </span>
            </div>
          </div>

          {/* 7-Day Revenue Dynamics Chart */}
          <div className="sales-chart-card">
            <h2 className="sales-chart-title">{t('salesChartTitle')}</h2>
            <div className="chart-bars-wrap">
              {dailySales.map((d, i) => {
                const heightPercent = Math.round((d.revenue / maxDailyRevenue) * 100);
                return (
                  <div key={i} className="chart-bar-col">
                    <span className="chart-bar-val">{d.revenue}</span>
                    <div 
                      className="chart-bar-fill" 
                      style={{ height: `${heightPercent}%` }}
                      title={`${d.revenue} GEL (${d.orders} заказов)`}
                    />
                    <span className="chart-bar-day">{d.day}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Recent Orders Summary */}
          <div className="admin-data-card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 14 }}>{t('recentOrdersTitle')}</h3>
            <div style={{ overflowX: 'auto' }}>
              <table className="admin-data-table">
                <thead>
                  <tr>
                    <th>№ Заказа</th>
                    <th>Клиент</th>
                    <th>Тип</th>
                    <th>Сумма</th>
                    <th>Оплата</th>
                    <th>Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.slice(0, 5).map(o => (
                    <tr key={o.id}>
                      <td style={{ fontWeight: 800, color: 'var(--color-primary)' }}>{o.orderNumber}</td>
                      <td>{o.customerName}</td>
                      <td>{o.deliveryType === 'delivery' ? '🚚 Доставка' : '🏬 Самовывоз'}</td>
                      <td style={{ fontWeight: 800 }}>{o.total} GEL</td>
                      <td>
                        <span style={{ color: o.paymentStatus === 'paid' ? 'var(--system-green)' : '#ffad0d', fontWeight: 700 }}>
                          {o.paymentMethod === 'cash' ? 'Наличные' : 'Карта'}
                        </span>
                      </td>
                      <td>
                        <span className={`status-badge ${o.status}`}>
                          {t(`status${o.status.charAt(0).toUpperCase() + o.status.slice(1)}` as any)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================================================
          2. LIVE ORDERS MANAGEMENT
         ========================================================================== */}
      {activeTab === 'orders' && (
        <div>
          {/* Order Status Filters */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <button 
              className={`admin-tab-btn ${orderFilter === 'all' ? 'active' : ''}`}
              onClick={() => setOrderFilter('all')}
            >
              {t('filterAllOrders')} ({orders.length})
            </button>
            <button 
              className={`admin-tab-btn ${orderFilter === 'new' ? 'active' : ''}`}
              onClick={() => setOrderFilter('new')}
            >
              🆕 {t('statusNew')} ({orders.filter(o => o.status === 'new').length})
            </button>
            <button 
              className={`admin-tab-btn ${orderFilter === 'preparing' ? 'active' : ''}`}
              onClick={() => setOrderFilter('preparing')}
            >
              👨‍🍳 {t('statusPreparing')}
            </button>
            <button 
              className={`admin-tab-btn ${orderFilter === 'in_delivery' ? 'active' : ''}`}
              onClick={() => setOrderFilter('in_delivery')}
            >
              🛵 {t('statusInDelivery')}
            </button>
            <button 
              className={`admin-tab-btn ${orderFilter === 'completed' ? 'active' : ''}`}
              onClick={() => setOrderFilter('completed')}
            >
              ✓ {t('statusCompleted')}
            </button>
          </div>

          <div className="admin-data-card">
            <div style={{ overflowX: 'auto' }}>
              <table className="admin-data-table">
                <thead>
                  <tr>
                    <th>Заказ</th>
                    <th>Клиент и адрес</th>
                    <th>Состав заказа</th>
                    <th>Сумма</th>
                    <th>Банк / Оплата</th>
                    <th>Изменить статус</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map(o => (
                    <tr key={o.id}>
                      <td>
                        <div style={{ fontWeight: 800, color: 'var(--color-primary)', fontSize: 14 }}>{o.orderNumber}</div>
                        <div style={{ fontSize: 11, color: '#8da4b4' }}>
                          {new Date(o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>

                      <td>
                        <div style={{ fontWeight: 700 }}>{o.customerName}</div>
                        <div style={{ fontSize: 12, color: 'var(--color-primary)' }}>{o.customerPhone}</div>
                        <div style={{ fontSize: 11, color: '#8da4b4', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {o.address}
                        </div>
                      </td>

                      <td>
                        {o.items.map((it, idx) => (
                          <div key={idx} style={{ fontSize: 12 }}>
                            <b>{it.quantity}x</b> {it.name}
                            {it.modifiersDescription && (
                              <span style={{ color: 'var(--color-primary)', fontSize: 11 }}> ({it.modifiersDescription})</span>
                            )}
                          </div>
                        ))}
                      </td>

                      <td style={{ fontWeight: 800, fontSize: 14 }}>
                        {o.total} GEL
                      </td>

                      <td>
                        <div style={{ fontWeight: 700, color: o.paymentStatus === 'paid' ? 'var(--system-green)' : '#ffad0d' }}>
                          {o.paymentStatus === 'paid' ? 'Оплачено ✓' : 'Ожидает'}
                        </div>
                        <div style={{ fontSize: 11, color: '#8da4b4' }}>
                          {o.paymentMethod === 'cash' ? 'Наличные' : 'Карта'}
                        </div>
                      </td>

                      <td>
                        <select 
                          value={o.status}
                          onChange={e => handleUpdateOrderStatus(o.id, e.target.value as OrderStatus)}
                          style={{
                            background: '#0c131a',
                            color: '#fff',
                            border: '1px solid #233342',
                            padding: '6px 10px',
                            borderRadius: 8,
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          <option value="new">🆕 Новый</option>
                          <option value="preparing">👨‍🍳 Готовится</option>
                          <option value="in_delivery">🛵 В пути</option>
                          <option value="completed">✓ Завершен</option>
                          <option value="cancelled">✕ Отменен</option>
                        </select>
                        {o.deliveryType === 'delivery' && (
                          <button
                            type="button"
                            onClick={() => handleCourierLink(o.id)}
                            style={{
                              display: 'block',
                              marginTop: 6,
                              background: 'transparent',
                              color: 'var(--color-primary)',
                              border: '1px solid #233342',
                              padding: '5px 10px',
                              borderRadius: 8,
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                          >
                            {copiedCourierLinkId === o.id ? '✓ Скопировано' : '🛵 Ссылка курьера'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================================================
          3. CUSTOMER REPORT (CRM)
         ========================================================================== */}
      {activeTab === 'customers' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', width: 320 }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: '#8da4b4' }} />
              <input 
                type="text"
                placeholder="Поиск по имени или телефону..."
                value={customerSearch}
                onChange={e => setCustomerSearch(e.target.value)}
                style={{
                  width: '100%',
                  background: '#141f29',
                  border: '1px solid #233342',
                  borderRadius: 10,
                  padding: '10px 14px 10px 36px',
                  color: '#fff',
                  fontSize: 13
                }}
              />
            </div>
            <div style={{ fontSize: 13, color: '#8da4b4' }}>
              Всего клиентов в базе: <b>{customers.length}</b>
            </div>
          </div>

          <div className="admin-data-card">
            <div style={{ overflowX: 'auto' }}>
              <table className="admin-data-table">
                <thead>
                  <tr>
                    <th>{t('customerTableColName')}</th>
                    <th>{t('customerTableColPhone')}</th>
                    <th>{t('customerTableColOrders')}</th>
                    <th>{t('customerTableColSpent')}</th>
                    <th>{t('customerTableColLastOrder')}</th>
                    <th>{t('customerTableColTier')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map(c => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 700 }}>{c.name}</td>
                      <td style={{ color: 'var(--color-primary)' }}>{c.phone}</td>
                      <td style={{ fontWeight: 800 }}>{c.ordersCount} заказов</td>
                      <td style={{ fontWeight: 800 }}>{c.totalSpent} GEL</td>
                      <td>{c.lastOrderDate}</td>
                      <td>
                        <span className={`tier-badge ${c.tier}`}>
                          {c.tier}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================================================
          4. MENU & ITEMS MANAGEMENT
         ========================================================================== */}
      {activeTab === 'menu' && (
        <div>
          <div style={{ marginBottom: 16, fontSize: 14, color: '#8da4b4' }}>
            Синхронизировано с RestIQ / Teatro POS API. Позиций в меню: <b>{categories.flatMap(c => c.items).length}</b>
          </div>

          <div className="admin-data-card">
            <div style={{ overflowX: 'auto' }}>
              <table className="admin-data-table">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Блюдо</th>
                    <th>Категория</th>
                    <th>Вес</th>
                    <th>Цена</th>
                    <th>Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.flatMap(c => c.items.map(it => ({ ...it, categoryName: c.name[lang] || c.name.en }))).map(item => (
                    <tr key={item.itemId}>
                      <td style={{ color: '#8da4b4', fontFamily: 'monospace' }}>#{item.sku}</td>
                      <td style={{ fontWeight: 700 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {item.itemSizes[0].buttonImage?.src ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img 
                              src={item.itemSizes[0].buttonImage.src} 
                              alt="" 
                              style={{ width: 42, height: 42, borderRadius: 8, objectFit: 'cover' }}
                            />
                          ) : (
                            <div style={{ width: 42, height: 42, borderRadius: 8, background: '#1c2833', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                              🍣
                            </div>
                          )}
                          <div>
                            <div>{item.name[lang] || item.name.en}</div>
                          </div>
                        </div>
                      </td>
                      <td>{item.categoryName}</td>
                      <td>{item.itemSizes[0].portionWeightGrams > 0 ? `${item.itemSizes[0].portionWeightGrams} г.` : '—'}</td>
                      <td style={{ fontWeight: 800, color: 'var(--color-primary)' }}>
                        {item.itemSizes[0].prices[0].price} GEL
                      </td>
                      <td>
                        <span style={{ color: 'var(--system-green)', fontWeight: 700, fontSize: 12 }}>
                          ● В наличии (Активно)
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
