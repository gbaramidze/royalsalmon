'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { MapPin, Navigation, Crosshair, Check, AlertCircle, Loader2 } from 'lucide-react';
import type * as LType from 'leaflet';
import { addBaseTileLayer } from '@/lib/mapTiles';

export interface LocationData {
  lat: number;
  lng: number;
  address: string;
  street?: string;
  houseNumber?: string;
}

interface AddressMapPickerProps {
  initialCoordinates?: { lat: number; lng: number } | null;
  initialAddress?: string;
  lang?: 'ru' | 'ka' | 'en';
  onSelectLocation: (loc: LocationData) => void;
  height?: number | string;
}

// Default to Batumi central area
const BATUMI_DEFAULT_COORDS = { lat: 41.6434, lng: 41.6399 };

export function AddressMapPicker({
  initialCoordinates,
  initialAddress = '',
  lang = 'ru',
  onSelectLocation,
  height = 280,
}: AddressMapPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<LType.Map | null>(null);
  const markerRef = useRef<LType.Marker | null>(null);

  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number }>(
    initialCoordinates || BATUMI_DEFAULT_COORDS
  );
  const [resolvedAddress, setResolvedAddress] = useState<string>(initialAddress);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Reverse geocode lat/lng to readable street and house
  const reverseGeocode = useCallback(
    async (lat: number, lng: number) => {
      setIsGeocoding(true);
      try {
        const langParam = lang === 'ka' ? 'ka,ru,en' : lang === 'ru' ? 'ru,ka,en' : 'en,ka,ru';
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=${langParam}`,
          {
            headers: {
              'User-Agent': 'RoyalSalmonBatumiStore/1.0',
            },
          }
        );

        if (!res.ok) throw new Error('Geocoding request failed');

        const data = await res.json();
        const addr = data.address || {};

        const road = addr.road || addr.pedestrian || addr.street || addr.neighbourhood || '';
        const house = addr.house_number || '';
        const suburb = addr.suburb || addr.city_district || '';
        const city = addr.city || addr.town || 'Батуми';

        let formatted = '';
        if (road && house) {
          formatted = `${road}, ${house}`;
        } else if (road) {
          formatted = road;
        } else if (suburb) {
          formatted = `${suburb}, ${city}`;
        } else if (data.display_name) {
          // Take first 2 parts of display name
          formatted = data.display_name.split(',').slice(0, 2).join(',').trim();
        } else {
          formatted = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        }

        setResolvedAddress(formatted);
        onSelectLocation({
          lat,
          lng,
          address: formatted,
          street: road,
          houseNumber: house,
        });
      } catch (err) {
        console.warn('Reverse geocoding error:', err);
        const fallback = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        setResolvedAddress(fallback);
        onSelectLocation({ lat, lng, address: fallback });
      } finally {
        setIsGeocoding(false);
      }
    },
    [lang, onSelectLocation]
  );

  // Initialize Leaflet map
  useEffect(() => {
    let isCancelled = false;

    async function initMap() {
      if (!mapContainerRef.current) return;
      if (mapInstanceRef.current) return; // already initialized

      // Dynamically import Leaflet on client-side
      const L = await import('leaflet');
      if (isCancelled || !mapContainerRef.current) return;

      const startLat = initialCoordinates?.lat || BATUMI_DEFAULT_COORDS.lat;
      const startLng = initialCoordinates?.lng || BATUMI_DEFAULT_COORDS.lng;

      // Create stylish custom SVG pin icon
      const customPinHtml = `
        <div style="position: relative; width: 38px; height: 38px; display: flex; align-items: center; justify-content: center;">
          <div style="
            position: absolute;
            width: 32px;
            height: 32px;
            background: #33BEBF;
            border: 2.5px solid #FFFFFF;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            box-shadow: 0 4px 14px rgba(0,0,0,0.35);
            display: flex;
            align-items: center;
            justify-content: center;
            top: 0;
            left: 3px;
          "></div>
          <div style="
            position: absolute;
            width: 11px;
            height: 11px;
            background: #FFFFFF;
            border-radius: 50%;
            top: 10px;
            left: 13.5px;
            box-shadow: inset 0 1px 3px rgba(0,0,0,0.25);
          "></div>
          <div style="
            position: absolute;
            bottom: 0px;
            left: 14px;
            width: 10px;
            height: 4px;
            background: rgba(0,0,0,0.25);
            border-radius: 50%;
            filter: blur(1px);
          "></div>
        </div>
      `;

      const pinIcon = L.divIcon({
        html: customPinHtml,
        className: 'royal-salmon-map-pin',
        iconSize: [38, 38],
        iconAnchor: [19, 36],
      });

      // Init map
      const map = L.map(mapContainerRef.current, {
        center: [startLat, startLng],
        zoom: 15,
        zoomControl: false,
      });
      addBaseTileLayer(L, map);

      // Add zoom control top-right
      L.control.zoom({ position: 'topright' }).addTo(map);

      // Create draggable marker
      const marker = L.marker([startLat, startLng], {
        icon: pinIcon,
        draggable: true,
      }).addTo(map);

      markerRef.current = marker;
      mapInstanceRef.current = map;
      setMapLoaded(true);

      // Handle marker dragend
      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        setCurrentCoords({ lat: pos.lat, lng: pos.lng });
        reverseGeocode(pos.lat, pos.lng);
      });

      // Handle map click
      map.on('click', (e: LType.LeafletMouseEvent) => {
        marker.setLatLng(e.latlng);
        setCurrentCoords({ lat: e.latlng.lat, lng: e.latlng.lng });
        reverseGeocode(e.latlng.lat, e.latlng.lng);
      });

      // Initial reverse geocode if no address provided
      if (!initialAddress) {
        reverseGeocode(startLat, startLng);
      }
    }

    initMap();

    return () => {
      isCancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
    };
  }, []); // Run on mount

  // Locate user with GPS
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      alert(lang === 'ru' ? 'Геолокация не поддерживается вашим браузером' : 'Geolocation is not supported');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const { latitude, longitude } = pos.coords;
        setCurrentCoords({ lat: latitude, lng: longitude });

        if (mapInstanceRef.current && markerRef.current) {
          mapInstanceRef.current.flyTo([latitude, longitude], 16, { duration: 1.2 });
          markerRef.current.setLatLng([latitude, longitude]);
        }
        reverseGeocode(latitude, longitude);
      },
      (err) => {
        setIsLocating(false);
        console.warn('Geolocation error:', err.message);
        alert(
          lang === 'ru'
            ? 'Не удалось определить геолокацию. Разрешите доступ в браузере или укажите точку на карте.'
            : 'Could not detect location. Please permit GPS or choose on map.'
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
      {/* Map Window */}
      <div
        style={{
          position: 'relative',
          height,
          width: '100%',
          borderRadius: 14,
          overflow: 'hidden',
          border: '1.5px solid var(--border-subtle, #E2E8F0)',
          background: '#F1F5F9',
          boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
        }}
      >
        <div ref={mapContainerRef} style={{ width: '100%', height: '100%', zIndex: 1 }} />

        {/* Locate Me Floating Button */}
        <button
          type="button"
          onClick={handleLocateMe}
          disabled={isLocating}
          title={lang === 'ru' ? 'Мое местоположение' : 'My location'}
          style={{
            position: 'absolute',
            bottom: 12,
            right: 12,
            zIndex: 10,
            background: '#FFFFFF',
            border: 'none',
            borderRadius: 10,
            padding: '8px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--color-primary, #33BEBF)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          {isLocating ? <Loader2 size={15} className="spinner" /> : <Crosshair size={15} />}
          <span>{lang === 'ru' ? 'Где я' : lang === 'ka' ? 'ჩემი მდებარეობა' : 'Locate me'}</span>
        </button>

        {/* Top Hint Bar */}
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            right: 48,
            zIndex: 10,
            background: 'rgba(15, 23, 42, 0.78)',
            backdropFilter: 'blur(6px)',
            color: '#FFFFFF',
            borderRadius: 8,
            padding: '5px 10px',
            fontSize: 11,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            pointerEvents: 'none',
          }}
        >
          <Navigation size={12} color="#33BEBF" />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {lang === 'ru'
              ? 'Нажмите на карту или перетяните маркер'
              : lang === 'ka'
              ? 'დააჭირეთ რუკას ან გადაიტანეთ მარკერი'
              : 'Tap map or drag pin to exact entrance'}
          </span>
        </div>
      </div>

      {/* Resolved Address Pill Banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          background: 'rgba(51, 190, 191, 0.08)',
          border: '1px solid rgba(51, 190, 191, 0.25)',
          borderRadius: 10,
          padding: '8px 12px',
          fontSize: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flexGrow: 1 }}>
          <MapPin size={15} color="var(--color-primary, #33BEBF)" style={{ flexShrink: 0 }} />
          <div style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>
              {isGeocoding
                ? (lang === 'ru' ? 'Определяем адрес точки...' : 'Resolving address...')
                : resolvedAddress || (lang === 'ru' ? 'Точка на карте выбрана' : 'Location pinned')}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, fontSize: 11, color: 'var(--color-primary)', fontWeight: 700 }}>
          <Check size={14} />
          <span>{lang === 'ru' ? 'Метка готова' : 'Pinned'}</span>
        </div>
      </div>
    </div>
  );
}

export default AddressMapPicker;
