import { LatLng } from '@/lib/geo';

// OSRM road router. The public demo server is rate limited: set OSRM_URL to an own instance for production
const OSRM_URL = (process.env.OSRM_URL || 'https://router.project-osrm.org').replace(/\/+$/, '');
const REQUEST_TIMEOUT_MS = 4000;
const CACHE_TTL_MS = 10 * 60 * 1000;
const FAILURE_TTL_MS = 30 * 1000; // don't hammer the router while it is down
const MAX_CACHE_ENTRIES = 500;

export interface RoadRoute {
  points: LatLng[];
  distanceKm: number;
  durationMinutes: number;
}

const cache = new Map<string, { route: Promise<RoadRoute | null>; expiresAt: number }>();

// ~100 m grid for the start, so a moving courier reuses a route instead of asking the router on every poll
const startKey = (p: LatLng) => `${p.lat.toFixed(3)},${p.lng.toFixed(3)}`;
const endKey = (p: LatLng) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;
const round5 = (n: number) => Math.round(n * 1e5) / 1e5;

async function fetchRoute(from: LatLng, to: LatLng): Promise<RoadRoute | null> {
  const url = `${OSRM_URL}/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
  try {
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const route = data?.code === 'Ok' ? data.routes?.[0] : null;
    if (!route?.geometry?.coordinates?.length) return null;

    return {
      points: (route.geometry.coordinates as [number, number][]).map(([lng, lat]) => ({ lat: round5(lat), lng: round5(lng) })),
      distanceKm: route.distance / 1000,
      durationMinutes: route.duration / 60,
    };
  } catch (e) {
    console.warn('Road routing failed:', e);
    return null;
  }
}

/** Driving route along the roads, or null when the router is unavailable */
export function getRoadRoute(from: LatLng, to: LatLng): Promise<RoadRoute | null> {
  const key = `${startKey(from)};${endKey(to)}`;
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) return hit.route;

  if (cache.size >= MAX_CACHE_ENTRIES) {
    for (const [k, v] of cache) if (v.expiresAt <= now) cache.delete(k);
    if (cache.size >= MAX_CACHE_ENTRIES) cache.clear();
  }

  const entry = { route: fetchRoute(from, to), expiresAt: now + CACHE_TTL_MS };
  cache.set(key, entry);
  entry.route.then(route => {
    if (!route) entry.expiresAt = Date.now() + FAILURE_TTL_MS;
  });
  return entry.route;
}
