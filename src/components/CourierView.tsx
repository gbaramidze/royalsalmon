'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Check, MapPin, Navigation, Phone } from 'lucide-react';
import type { CourierView as CourierData } from '@/lib/orders';
import { haversineKm, LatLng } from '@/lib/geo';
import RoyalSalmonLogo from '@/components/RoyalSalmonLogo';

interface CourierViewProps {
  orderId: string;
  token: string;
}

const MIN_SEND_INTERVAL_MS = 4000;
const MIN_MOVE_KM = 0.015; // send sooner than the heartbeat only after a real move
const HEARTBEAT_MS = 20000; // keeps the position "live" for the customer while the courier stands still

type ShareState = 'idle' | 'starting' | 'sharing' | 'error';

interface WakeLockSentinelLike {
  release: () => Promise<void>;
}

function geoErrorText(err: GeolocationPositionError): string {
  if (err.code === err.PERMISSION_DENIED) {
    return 'Доступ к геопозиции запрещён. Разрешите его для этого сайта в настройках браузера и нажмите «Начать» ещё раз.';
  }
  if (err.code === err.POSITION_UNAVAILABLE) return 'Не удаётся определить местоположение. Включите GPS.';
  return 'GPS долго не отвечает. Проверьте, что геолокация включена.';
}

export default function CourierView({ orderId, token }: CourierViewProps) {
  const [order, setOrder] = useState<CourierData | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'forbidden' | 'not_found' | 'error'>('loading');
  const [shareState, setShareState] = useState<ShareState>('idle');
  const [shareError, setShareError] = useState<string | null>(null);
  const [lastSentAt, setLastSentAt] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [isFinishing, setIsFinishing] = useState(false);

  const watchIdRef = useRef<number | null>(null);
  const latestRef = useRef<LatLng | null>(null);
  const lastSentRef = useRef<{ at: number; position: LatLng } | null>(null);
  const isSendingRef = useRef(false);
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null);

  const apiUrl = `/api/orders/${encodeURIComponent(orderId)}/courier`;

  useEffect(() => {
    let isCancelled = false;
    fetch(`${apiUrl}?t=${encodeURIComponent(token)}`, { cache: 'no-store' })
      .then(async res => {
        if (isCancelled) return;
        if (res.status === 403) return setLoadState('forbidden');
        if (res.status === 404) return setLoadState('not_found');
        const data = await res.json();
        if (isCancelled) return;
        if (data?.success && data.order) {
          setOrder(data.order);
          setLoadState('ready');
        } else {
          setLoadState('error');
        }
      })
      .catch(err => {
        console.warn('Failed to load courier order:', err);
        if (!isCancelled) setLoadState('error');
      });
    return () => {
      isCancelled = true;
    };
  }, [apiUrl, token]);

  // Keeps "sent N s ago" current
  useEffect(() => {
    if (shareState !== 'sharing') return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [shareState]);

  const sendPosition = async (position: LatLng) => {
    if (isSendingRef.current) return;
    isSendingRef.current = true;
    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, lat: position.lat, lng: position.lng }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        lastSentRef.current = { at: Date.now(), position };
        setLastSentAt(Date.now());
        setShareError(null);
        if (data.order) setOrder(data.order);
        if (data.order?.status === 'completed' || data.order?.status === 'cancelled') stopSharing();
      } else {
        setShareError(data?.error || 'Сервер не принял координаты.');
      }
    } catch {
      setShareError('Нет интернета — координаты отправятся, когда связь вернётся.');
    } finally {
      isSendingRef.current = false;
    }
  };

  const handlePosition = (pos: GeolocationPosition) => {
    const position = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    latestRef.current = position;
    setAccuracy(Math.round(pos.coords.accuracy));
    setShareState('sharing');

    const last = lastSentRef.current;
    const isDue =
      !last ||
      (Date.now() - last.at >= MIN_SEND_INTERVAL_MS && haversineKm(last.position, position) >= MIN_MOVE_KM) ||
      Date.now() - last.at >= HEARTBEAT_MS;
    if (isDue) sendPosition(position);
  };

  const requestWakeLock = async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const wakeLock = (navigator as any).wakeLock;
      if (wakeLock && !wakeLockRef.current) wakeLockRef.current = await wakeLock.request('screen');
    } catch {
      // Not supported or refused: the courier just has to keep the screen on
    }
  };

  const stopSharing = () => {
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    watchIdRef.current = null;
    wakeLockRef.current?.release().catch(() => {});
    wakeLockRef.current = null;
    setShareState('idle');
  };

  const startSharing = () => {
    if (!('geolocation' in navigator)) {
      setShareState('error');
      setShareError('Этот браузер не умеет определять геопозицию.');
      return;
    }
    if (!window.isSecureContext) {
      setShareState('error');
      setShareError('Геопозиция работает только по https-ссылке.');
      return;
    }

    setShareState('starting');
    setShareError(null);
    requestWakeLock();
    watchIdRef.current = navigator.geolocation.watchPosition(
      handlePosition,
      err => {
        setShareError(geoErrorText(err));
        if (err.code === err.PERMISSION_DENIED) {
          stopSharing();
          setShareState('error');
        }
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 }
    );
  };

  // watchPosition goes quiet while standing still: resend the last fix so the customer still sees it live
  useEffect(() => {
    if (shareState !== 'sharing') return;
    const timer = setInterval(() => {
      const last = lastSentRef.current;
      if (latestRef.current && (!last || Date.now() - last.at >= HEARTBEAT_MS)) sendPosition(latestRef.current);
    }, 5000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareState]);

  // The wake lock is dropped whenever the page is hidden; take it again on return
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && watchIdRef.current !== null) {
        wakeLockRef.current = null;
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      wakeLockRef.current?.release().catch(() => {});
    };
  }, []);

  const handleDelivered = async () => {
    if (!window.confirm('Заказ передан клиенту?')) return;
    setIsFinishing(true);
    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action: 'delivered' }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.order) {
        setOrder(data.order);
        stopSharing();
      } else {
        setShareError(data?.error || 'Не удалось отметить доставку. Попробуйте ещё раз.');
      }
    } catch {
      setShareError('Нет интернета. Попробуйте ещё раз.');
    } finally {
      setIsFinishing(false);
    }
  };

  const isClosed = order?.status === 'completed' || order?.status === 'cancelled';
  const secondsAgo = lastSentAt ? Math.max(0, Math.round((now - lastSentAt) / 1000)) : null;
  const navigationUrl = order?.destination
    ? `https://www.google.com/maps/dir/?api=1&destination=${order.destination.lat},${order.destination.lng}&travelmode=driving`
    : order
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(order.address)}&travelmode=driving`
    : '';

  return (
    <main className="tracking-page">
      <header className="tracking-header">
        <RoyalSalmonLogo height={28} />
        {order && <span className="tracking-header__number">Курьер · #{order.orderNumber}</span>}
      </header>

      {loadState === 'loading' && <div className="tracking-card tracking-card--center">Загружаем заказ…</div>}

      {(loadState === 'forbidden' || loadState === 'not_found' || loadState === 'error') && (
        <div className="tracking-card tracking-card--center">
          <div className="tracking-emoji">{loadState === 'error' ? '📡' : '🔒'}</div>
          <h1 className="tracking-title">
            {loadState === 'forbidden' ? 'Ссылка недействительна' : loadState === 'not_found' ? 'Заказ не найден' : 'Не удалось загрузить заказ'}
          </h1>
          <p className="tracking-subtitle">
            {loadState === 'error' ? 'Проверьте интернет и обновите страницу.' : 'Попросите у администратора новую ссылку курьера.'}
          </p>
        </div>
      )}

      {order && (
        <>
          <section className="tracking-card tracking-card--center">
            {isClosed ? (
              <>
                <div className="tracking-emoji">{order.status === 'completed' ? '🎉' : '✕'}</div>
                <h1 className="tracking-title">{order.status === 'completed' ? 'Заказ доставлен' : 'Заказ отменён'}</h1>
                <p className="tracking-subtitle">Геопозиция больше не передаётся. Страницу можно закрыть.</p>
              </>
            ) : shareState === 'sharing' ? (
              <>
                <div className="courier-live">
                  <span className="courier-live__dot" /> Клиент видит вас на карте
                </div>
                <p className="tracking-subtitle">
                  {secondsAgo !== null ? `Отправлено ${secondsAgo} с назад` : 'Отправляем первую точку…'}
                  {accuracy !== null && ` · точность ±${accuracy} м`}
                </p>
                <p className="tracking-note">Не закрывайте эту страницу и не блокируйте экран до конца доставки.</p>
              </>
            ) : (
              <>
                <div className="tracking-emoji">🛵</div>
                <h1 className="tracking-title">{shareState === 'starting' ? 'Ищем GPS…' : 'Готовы выезжать?'}</h1>
                <p className="tracking-subtitle">
                  Нажмите «Начать доставку» и разрешите доступ к геопозиции — клиент увидит вас на карте.
                </p>
                <button type="button" className="tracking-call-btn courier-btn" onClick={startSharing} disabled={shareState === 'starting'}>
                  <Navigation size={16} /> {shareState === 'starting' ? 'Подключаемся…' : 'Начать доставку'}
                </button>
              </>
            )}
            {shareError && !isClosed && <div className="complaint-form__error">{shareError}</div>}
          </section>

          <section className="tracking-card">
            <h2 className="tracking-section-title">Клиент</h2>
            <div className="courier-row">
              <b>{order.customerName}</b>
              <a href={`tel:${order.customerPhone}`} className="courier-phone">
                <Phone size={14} /> {order.customerPhone}
              </a>
            </div>
            <div className="tracking-address">
              <MapPin size={14} />
              <span>{order.address}</span>
            </div>
            {order.notes && <p className="tracking-note courier-notes">📝 {order.notes}</p>}
            <div className="tracking-total">
              <span>{order.paymentStatus === 'paid' ? 'Оплачено' : order.paymentMethod === 'cash' ? 'Получить наличными' : 'Получить картой'}</span>
              <b>{order.total} GEL</b>
            </div>
            <a href={navigationUrl} target="_blank" rel="noreferrer" className="tracking-call-btn courier-btn--secondary">
              <Navigation size={16} /> Маршрут в Google Maps
            </a>
          </section>

          {!isClosed && (
            <button type="button" className="tracking-call-btn courier-btn--done" onClick={handleDelivered} disabled={isFinishing}>
              <Check size={16} /> {isFinishing ? 'Отмечаем…' : 'Заказ доставлен'}
            </button>
          )}
        </>
      )}
    </main>
  );
}
