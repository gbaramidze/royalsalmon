'use client';

import React, { useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import type * as LType from 'leaflet';
import { Camera, Check, MapPin, Phone, X } from 'lucide-react';
import type { TrackingView as TrackingData } from '@/lib/orders';
import { DEFAULT_DELIVERY_MINUTES, isCourierFresh, LatLng, pointAlongRoute, travelMinutes, trimRouteFrom } from '@/lib/geo';
import { addBaseTileLayer } from '@/lib/mapTiles';
import RoyalSalmonLogo from '@/components/RoyalSalmonLogo';

interface TrackingViewProps {
  orderId: string;
  editMode?: boolean;
}

const POLL_INTERVAL_MS = 8000;
const RESTAURANT_PHONE = '+995555123456';
const RESTAURANT_PHONE_LABEL = '+995 555 123 456';

interface DeliveryProgress {
  remainingMinutes: number;
  progress: number; // 0..1
  courier: LatLng | null;
  path: LatLng[] | null; // what is left to drive, along the roads when the route is known
  isLive: boolean;
}

function getDeliveryProgress(order: TrackingData, now: number): DeliveryProgress {
  const totalMinutes = order.etaMinutes ?? DEFAULT_DELIVERY_MINUTES;
  const startedAt = order.deliveryStartedAt ? Date.parse(order.deliveryStartedAt) : now;
  const elapsedMinutes = Math.max(0, (now - startedAt) / 60000);
  const route = order.route;

  // Real courier position, sent from the courier page
  if (order.courier && order.destination && isCourierFresh(order.courier, now)) {
    const fromCourier = route?.origin === 'courier' ? route : null;
    const remainingMinutes = Math.max(
      1,
      Math.ceil(fromCourier ? fromCourier.durationMinutes : travelMinutes(order.courier, order.destination))
    );
    return {
      remainingMinutes,
      progress: elapsedMinutes / (elapsedMinutes + remainingMinutes),
      courier: order.courier,
      path: route ? trimRouteFrom(route.points, order.courier) : [order.courier, order.destination],
      isLive: true,
    };
  }

  // Otherwise estimate from the time since the courier left, moving the dot along the road
  const progress = Math.min(0.95, elapsedMinutes / totalMinutes);
  let courier: LatLng | null = null;
  if (route?.origin === 'restaurant' && route.points.length > 1) {
    courier = pointAlongRoute(route.points, progress);
  } else if (order.destination) {
    courier = {
      lat: order.restaurant.lat + (order.destination.lat - order.restaurant.lat) * progress,
      lng: order.restaurant.lng + (order.destination.lng - order.restaurant.lng) * progress,
    };
  }

  return {
    remainingMinutes: Math.max(1, Math.ceil(totalMinutes - elapsedMinutes)),
    progress,
    courier,
    path: courier && order.destination
      ? route?.origin === 'restaurant' ? trimRouteFrom(route.points, courier) : [courier, order.destination]
      : null,
    isLive: false,
  };
}

function SushiAnimation() {
  return (
    <svg className="sushi-anim" viewBox="0 0 280 170" role="img" aria-label="Повар готовит роллы">
      <ellipse cx="140" cy="140" rx="118" ry="8" fill="rgba(0,0,0,0.08)" />
      <rect x="20" y="112" width="240" height="22" rx="8" fill="#C89B6A" />
      <rect x="20" y="112" width="240" height="7" rx="3.5" fill="#D9B083" />

      {/* Roll log */}
      <rect x="40" y="74" width="112" height="38" rx="19" fill="#1F3A36" />
      <ellipse cx="150" cy="93" rx="10" ry="19" fill="#FFF8EE" />
      <ellipse cx="150" cy="93" rx="4.5" ry="9" fill="#FF8A65" />

      {/* Sliced pieces */}
      {[190, 219, 248].map((cx, i) => (
        <g key={cx} className={`sushi-anim__piece sushi-anim__piece--${i + 1}`}>
          <circle cx={cx} cy="98" r="13" fill="#1F3A36" />
          <circle cx={cx} cy="98" r="10.5" fill="#FFF8EE" />
          <circle cx={cx - 2} cy="97" r="4.5" fill="#FF8A65" />
          <circle cx={cx + 4} cy="101" r="2.6" fill="#8BC34A" />
        </g>
      ))}

      {/* Knife */}
      <g className="sushi-anim__knife">
        <path d="M150 14 H198 V58 Q172 64 150 54 Z" fill="#DDE3E8" />
        <path d="M150 50 Q172 60 198 54 V58 Q172 64 150 54 Z" fill="#B8C2CA" />
        <rect x="198" y="16" width="46" height="14" rx="5" fill="#3B2A22" />
      </g>
    </svg>
  );
}

function ProgressRing({ progress, minutes }: { progress: number; minutes: number }) {
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  const percent = Math.round(progress * 100);

  return (
    <div className="eta-ring" role="img" aria-label={`Осталось ${minutes} мин, пройдено ${percent}% пути`}>
      <svg viewBox="0 0 132 132">
        <circle cx="66" cy="66" r={radius} className="eta-ring__track" />
        <circle
          cx="66"
          cy="66"
          r={radius}
          className="eta-ring__fill"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
        />
      </svg>
      <div className="eta-ring__center">
        <span className="eta-ring__label">осталось</span>
        <span className="eta-ring__value">{minutes}</span>
        <span className="eta-ring__label">мин · {percent}%</span>
      </div>
    </div>
  );
}

function DeliveryMap({
  restaurant,
  destination,
  courier,
  path,
}: {
  restaurant: LatLng;
  destination: LatLng;
  courier: LatLng | null;
  path: LatLng[] | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LType.Map | null>(null);
  const courierMarkerRef = useRef<LType.Marker | null>(null);
  const routeRef = useRef<LType.Polyline | null>(null);
  const hasFittedRouteRef = useRef(false);
  const courierRef = useRef(courier);
  courierRef.current = courier;
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    async function initMap() {
      const L = await import('leaflet');
      if (isCancelled || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, { zoomControl: false });
      addBaseTileLayer(L, map);
      map.fitBounds(L.latLngBounds([restaurant, destination]), { padding: [36, 36], maxZoom: 16 });

      L.marker(destination, {
        icon: L.divIcon({ html: '<div class="tracking-pin tracking-pin--home">🏠</div>', className: '', iconSize: [34, 34], iconAnchor: [17, 17] }),
      }).addTo(map);

      const start = courierRef.current || restaurant;
      routeRef.current = L.polyline([start, destination], { color: '#33BEBF', weight: 5, opacity: 0.85, lineCap: 'round', lineJoin: 'round' }).addTo(map);
      courierMarkerRef.current = L.marker(start, {
        icon: L.divIcon({ html: '<div class="tracking-pin tracking-pin--courier">🛵</div>', className: '', iconSize: [38, 38], iconAnchor: [19, 19] }),
        zIndexOffset: 1000,
      }).addTo(map);

      mapRef.current = map;
      setMapReady(true);
    }

    initMap();

    return () => {
      isCancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      courierMarkerRef.current = null;
      routeRef.current = null;
      hasFittedRouteRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destination.lat, destination.lng]);

  // Move the courier dot and shorten the route as the position changes
  useEffect(() => {
    if (!mapReady) return;
    if (courier) courierMarkerRef.current?.setLatLng(courier);
    if (path) routeRef.current?.setLatLngs(path);

    // Roads can bend outside the straight-line view: fit once the real route arrives
    if (path && path.length > 2 && !hasFittedRouteRef.current && routeRef.current && mapRef.current) {
      hasFittedRouteRef.current = true;
      mapRef.current.invalidateSize(); // the card may have changed size since the map was created
      mapRef.current.fitBounds(routeRef.current.getBounds().extend(destination), { padding: [36, 36], maxZoom: 16 });
    }
  }, [mapReady, courier, path, destination]);

  return <div ref={containerRef} className="tracking-map" />;
}

const MAX_COMPLAINT_PHOTOS = 3;
const MAX_PHOTO_SIDE_PX = 1600;

// Phone photos are large; shrink them to a JPEG before upload
async function compressPhoto(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_PHOTO_SIDE_PX / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.82));
    return blob ? new File([blob], 'photo.jpg', { type: 'image/jpeg' }) : file;
  } catch {
    return file;
  }
}

function ComplaintForm({ order, onSent, onCancel }: { order: TrackingData; onSent: (order: TrackingData) => void; onCancel: () => void }) {
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<Array<{ file: File; previewUrl: string }>>([]);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const photosRef = useRef(photos);
  photosRef.current = photos;

  // Release preview URLs when the form closes
  useEffect(() => () => photosRef.current.forEach(p => URL.revokeObjectURL(p.previewUrl)), []);

  const toggleItem = (index: number) =>
    setSelectedItems(prev => (prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]));

  const handleAddPhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []).slice(0, MAX_COMPLAINT_PHOTOS - photos.length);
    e.target.value = '';
    const compressed = await Promise.all(picked.map(compressPhoto));
    setPhotos(prev => [...prev, ...compressed.map(file => ({ file, previewUrl: URL.createObjectURL(file) }))]);
  };

  const handleRemovePhoto = (index: number) => {
    URL.revokeObjectURL(photos[index].previewUrl);
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (description.trim().length < 5) {
      setError('Опишите, что не так — хотя бы пару слов.');
      return;
    }

    setIsSending(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('description', description.trim());
      selectedItems.forEach(i => form.append('items', String(i)));
      photos.forEach(p => form.append('photos', p.file));

      const res = await fetch(`/api/orders/${encodeURIComponent(order.id)}/complaint`, { method: 'POST', body: form });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success && data.order) {
        onSent(data.order);
      } else {
        setError(data?.error || 'Не удалось отправить. Попробуйте ещё раз.');
      }
    } catch (err) {
      console.warn('Failed to send complaint:', err);
      setError('Нет связи. Проверьте интернет и попробуйте ещё раз.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <form className="tracking-card complaint-form" onSubmit={handleSubmit}>
      <div className="complaint-form__head">
        <h2 className="tracking-section-title">Что-то не так?</h2>
        <button type="button" className="complaint-form__close" onClick={onCancel} aria-label="Закрыть">
          <X size={18} />
        </button>
      </div>

      <div className="complaint-form__label">С какой позицией проблема?</div>
      <div className="complaint-form__items">
        {order.items.map((it, i) => (
          <label key={i} className={`complaint-item ${selectedItems.includes(i) ? 'selected' : ''}`}>
            <input type="checkbox" checked={selectedItems.includes(i)} onChange={() => toggleItem(i)} />
            <span>{it.name}</span>
            <b>×{it.quantity}</b>
          </label>
        ))}
      </div>

      <label className="complaint-form__label" htmlFor="complaint-description">Опишите, что случилось</label>
      <textarea
        id="complaint-description"
        className="complaint-form__textarea"
        value={description}
        onChange={e => setDescription(e.target.value)}
        maxLength={1000}
        rows={4}
        placeholder="Например: привезли не тот ролл, не хватает соуса…"
      />

      <div className="complaint-form__label">Фото (по желанию, до {MAX_COMPLAINT_PHOTOS})</div>
      <div className="complaint-photos">
        {photos.map((p, i) => (
          <div key={p.previewUrl} className="complaint-photo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.previewUrl} alt={`Фото ${i + 1}`} />
            <button type="button" onClick={() => handleRemovePhoto(i)} aria-label={`Удалить фото ${i + 1}`}>
              <X size={12} />
            </button>
          </div>
        ))}
        {photos.length < MAX_COMPLAINT_PHOTOS && (
          <label className="complaint-photo complaint-photo--add">
            <Camera size={20} />
            <span>Добавить</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={handleAddPhotos} />
          </label>
        )}
      </div>

      {error && <div className="complaint-form__error">{error}</div>}

      <button type="submit" className="tracking-call-btn complaint-form__submit" disabled={isSending}>
        {isSending ? 'Отправляем…' : 'Отправить'}
      </button>
    </form>
  );
}

export default function TrackingView({ orderId, editMode = false }: TrackingViewProps) {
  const [order, setOrder] = useState<TrackingData | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'not_found' | 'error'>('loading');
  const [now, setNow] = useState(() => Date.now());
  const [isComplaintOpen, setIsComplaintOpen] = useState(false);

  // Poll the order status
  useEffect(() => {
    let isCancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}`, { cache: 'no-store' });
        if (isCancelled) return;
        if (res.status === 404) {
          setLoadState('not_found');
          return;
        }
        const data = await res.json();
        if (isCancelled) return;
        if (data?.success && data.order) {
          setOrder(data.order);
          setLoadState('ready');
        }
      } catch (err) {
        console.warn('Failed to load order status:', err);
        // Keep showing the last known status if a later poll fails
        if (!isCancelled) setLoadState(prev => (prev === 'ready' ? prev : 'error'));
      }
    }

    load();
    const timer = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      isCancelled = true;
      clearInterval(timer);
    };
  }, [orderId]);

  // Tick so the countdown and the courier dot keep moving between polls
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const isPickup = order?.deliveryType === 'pickup';
  const steps = isPickup
    ? ['Принят', 'Готовится', 'Готов к выдаче', 'Выдан']
    : ['Принят', 'Готовится', 'В пути', 'Доставлен'];
  const activeStep = order ? ['new', 'preparing', 'in_delivery', 'completed'].indexOf(order.status) : -1;
  const delivery = order?.status === 'in_delivery' && !isPickup ? getDeliveryProgress(order, now) : null;

  return (
    <main className="tracking-page">
      <Script
        src="https://telegram.org/js/telegram-web-app.js"
        strategy="afterInteractive"
        onLoad={() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const webApp = (window as any).Telegram?.WebApp;
          webApp?.ready();
          webApp?.expand();
        }}
      />

      <header className="tracking-header">
        <RoyalSalmonLogo height={28} />
        {order && <span className="tracking-header__number">Заказ #{order.orderNumber}</span>}
      </header>

      {loadState === 'loading' && <div className="tracking-card tracking-card--center">Загружаем статус заказа…</div>}

      {loadState === 'not_found' && (
        <div className="tracking-card tracking-card--center">
          <div className="tracking-emoji">🔍</div>
          <h1 className="tracking-title">Заказ не найден</h1>
          <p className="tracking-subtitle">Проверьте ссылку или позвоните нам — мы поможем.</p>
        </div>
      )}

      {loadState === 'error' && (
        <div className="tracking-card tracking-card--center">
          <div className="tracking-emoji">📡</div>
          <h1 className="tracking-title">Не удалось загрузить статус</h1>
          <p className="tracking-subtitle">Проверьте интернет — страница обновится сама.</p>
        </div>
      )}

      {order && (
        <>
          {editMode && (
            <section className="tracking-card tracking-edit">
              <h2 className="tracking-section-title">Изменить заказ</h2>
              <p className="tracking-subtitle">
                {order.status === 'new' || order.status === 'preparing'
                  ? 'Позвоните нам — оператор изменит состав, адрес или время заказа.'
                  : order.status === 'in_delivery'
                  ? 'Заказ уже в пути, состав изменить нельзя. Если нужно уточнить адрес — позвоните нам.'
                  : 'Заказ уже закрыт. Если что-то не так — позвоните нам.'}
              </p>
              <a href={`tel:${RESTAURANT_PHONE}`} className="tracking-call-btn">
                <Phone size={16} /> {RESTAURANT_PHONE_LABEL}
              </a>
            </section>
          )}

          <section className="tracking-card tracking-card--center">
            {order.status === 'new' && (
              <>
                <div className="tracking-emoji">🧾</div>
                <h1 className="tracking-title">Заказ принят</h1>
                <p className="tracking-subtitle">Передаём его на кухню — скоро начнём готовить.</p>
              </>
            )}

            {order.status === 'preparing' && (
              <>
                <SushiAnimation />
                <h1 className="tracking-title">Готовим ваш заказ</h1>
                <p className="tracking-subtitle">Повара уже крутят роллы из свежего лосося.</p>
              </>
            )}

            {order.status === 'in_delivery' && isPickup && (
              <>
                <div className="tracking-emoji">🛍️</div>
                <h1 className="tracking-title">Заказ готов к выдаче</h1>
                <p className="tracking-subtitle">{order.address}</p>
              </>
            )}

            {delivery && (
              <>
                <h1 className="tracking-title">Курьер в пути</h1>
                <ProgressRing progress={delivery.progress} minutes={delivery.remainingMinutes} />
                {order.destination ? (
                  <DeliveryMap
                    restaurant={order.restaurant}
                    destination={order.destination}
                    courier={delivery.courier}
                    path={delivery.path}
                  />
                ) : (
                  <p className="tracking-subtitle">Точка на карте не была указана, поэтому показываем только время.</p>
                )}
                {!delivery.isLive && (
                  <p className="tracking-note">Положение курьера и время рассчитаны примерно.</p>
                )}
              </>
            )}

            {order.status === 'completed' && (
              <>
                <div className="tracking-emoji">🎉</div>
                <h1 className="tracking-title">{isPickup ? 'Заказ выдан' : 'Заказ доставлен'}</h1>
                <p className="tracking-subtitle">Приятного аппетита! Спасибо, что выбрали Royal Salmon.</p>
              </>
            )}

            {order.status === 'cancelled' && (
              <>
                <div className="tracking-emoji">✕</div>
                <h1 className="tracking-title">Заказ отменён</h1>
                <p className="tracking-subtitle">Если это ошибка — позвоните нам.</p>
              </>
            )}
          </section>

          {order.status === 'completed' && (
            isComplaintOpen ? (
              <ComplaintForm
                order={order}
                onCancel={() => setIsComplaintOpen(false)}
                onSent={updated => {
                  setOrder(updated);
                  setIsComplaintOpen(false);
                }}
              />
            ) : (
              <>
                {order.complaintsCount > 0 && (
                  <div className="tracking-card complaint-sent">
                    <Check size={16} />
                    <span>Обращение отправлено. Мы разберёмся и свяжемся с вами.</span>
                  </div>
                )}
                <button type="button" className="complaint-open-btn" onClick={() => setIsComplaintOpen(true)}>
                  {order.complaintsCount > 0 ? 'Сообщить ещё об одной проблеме' : 'Что-то не так с заказом?'}
                </button>
              </>
            )
          )}

          {order.status !== 'cancelled' && (
            <ol className="tracking-steps">
              {steps.map((label, i) => {
                // The last step is finished as soon as it is reached
                const isDone = i < activeStep || order.status === 'completed';
                return (
                <li
                  key={label}
                  className={`tracking-step ${isDone ? 'done' : i === activeStep ? 'active' : ''}`}
                >
                  <span className="tracking-step__dot">{isDone ? <Check size={12} /> : i + 1}</span>
                  <span className="tracking-step__label">{label}</span>
                </li>
                );
              })}
            </ol>
          )}

          <section className="tracking-card">
            <h2 className="tracking-section-title">Состав заказа</h2>
            <ul className="tracking-items">
              {order.items.map((it, i) => (
                <li key={i}>
                  <span>{it.name}</span>
                  <b>×{it.quantity}</b>
                </li>
              ))}
            </ul>
            <div className="tracking-total">
              <span>Итого</span>
              <b>{order.total} GEL</b>
            </div>
            <div className="tracking-address">
              <MapPin size={14} />
              <span>{order.address}</span>
            </div>
          </section>

          {!editMode && (
            <a href={`tel:${RESTAURANT_PHONE}`} className="tracking-call-link">
              <Phone size={14} /> Связаться с рестораном
            </a>
          )}
        </>
      )}
    </main>
  );
}
