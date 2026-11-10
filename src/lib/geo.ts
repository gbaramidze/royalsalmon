export interface LatLng {
  lat: number;
  lng: number;
}

// Royal Salmon kitchen: Batumi, 9 Ivane Javakhishvili St (couriers start from here)
export const RESTAURANT_COORDS: LatLng = { lat: 41.6409423, lng: 41.6223071 };

const ROAD_DETOUR_FACTOR = 1.4; // straight line -> approximate road distance
const COURIER_SPEED_KMH = 25;
export const DEFAULT_DELIVERY_MINUTES = 30;

export function haversineKm(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/** Approximate driving time in minutes between two points */
export function travelMinutes(from: LatLng, to: LatLng): number {
  return ((haversineKm(from, to) * ROAD_DETOUR_FACTOR) / COURIER_SPEED_KMH) * 60;
}

// Older live positions are ignored and the tracking page falls back to the time-based estimate
export const COURIER_FRESH_MS = 3 * 60 * 1000;

export function isCourierFresh(courier: { updatedAt: string } | null | undefined, now = Date.now()): boolean {
  return Boolean(courier && now - Date.parse(courier.updatedAt) < COURIER_FRESH_MS);
}

/** The rest of a route from `position` on: the part already travelled is cut off */
export function trimRouteFrom(points: LatLng[], position: LatLng): LatLng[] {
  if (points.length < 2) return [position, ...points];

  // Flat projection is precise enough at city scale
  const cosLat = Math.cos((position.lat * Math.PI) / 180);
  const px = position.lng * cosLat;
  const py = position.lat;
  let bestIndex = 0;
  let bestDist = Infinity;

  for (let i = 0; i < points.length - 1; i++) {
    const ax = points[i].lng * cosLat, ay = points[i].lat;
    const dx = points[i + 1].lng * cosLat - ax, dy = points[i + 1].lat - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
    const ex = ax + t * dx - px, ey = ay + t * dy - py;
    const dist = ex * ex + ey * ey;
    if (dist < bestDist) {
      bestDist = dist;
      bestIndex = i;
    }
  }
  return [position, ...points.slice(bestIndex + 1)];
}

/** Point that lies `fraction` (0..1) of the way along a route */
export function pointAlongRoute(points: LatLng[], fraction: number): LatLng {
  const segments = points.slice(1).map((p, i) => haversineKm(points[i], p));
  let remaining = segments.reduce((sum, km) => sum + km, 0) * Math.min(1, Math.max(0, fraction));

  for (let i = 0; i < segments.length; i++) {
    if (remaining <= segments[i]) {
      const t = segments[i] ? remaining / segments[i] : 0;
      return {
        lat: points[i].lat + (points[i + 1].lat - points[i].lat) * t,
        lng: points[i].lng + (points[i + 1].lng - points[i].lng) * t,
      };
    }
    remaining -= segments[i];
  }
  return points[points.length - 1];
}

export function isLatLng(value: unknown): value is LatLng {
  const v = value as LatLng | null;
  return Boolean(
    v &&
    typeof v.lat === 'number' && typeof v.lng === 'number' &&
    Number.isFinite(v.lat) && Number.isFinite(v.lng) &&
    Math.abs(v.lat) <= 90 && Math.abs(v.lng) <= 180
  );
}
