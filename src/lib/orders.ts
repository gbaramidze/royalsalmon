import crypto from 'crypto';
import { Order, OrderStatus } from '@/types';
import { DEFAULT_DELIVERY_MINUTES, isCourierFresh, LatLng, RESTAURANT_COORDS, travelMinutes } from '@/lib/geo';
import { getRoadRoute, RoadRoute } from '@/lib/routing';
import { check, COMPLAINT_PHOTOS_BUCKET, getSupabase } from '@/lib/supabase';

export const ORDER_STATUSES: OrderStatus[] = ['new', 'preparing', 'in_delivery', 'completed', 'cancelled'];

export interface OrderComplaint {
  id: string;
  createdAt: string;
  items: string[]; // names of the positions the customer flagged
  description: string;
  photos: string[]; // object paths in the complaint photos bucket
}

export const MAX_COMPLAINTS_PER_ORDER = 3;

export interface StoredOrder extends Order {
  statusUpdatedAt: string;
  deliveryStartedAt?: string;
  etaMinutes?: number; // full trip estimate, fixed when the courier leaves
  courier?: LatLng & { updatedAt: string };
  courierToken?: string; // secret part of the courier link
  complaintsCount: number;
}

/** Road route the tracking page draws: from the live courier position, or from the kitchen */
export type TrackingRoute = RoadRoute & { origin: 'courier' | 'restaurant' };

/** What the courier page sees: enough to reach the customer */
export interface CourierView {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  customerName: string;
  customerPhone: string;
  address: string;
  notes: string | null;
  destination: LatLng | null;
  total: number;
  paymentMethod: Order['paymentMethod'];
  paymentStatus: Order['paymentStatus'];
}

/** What the public tracking page is allowed to see (no phone, no notes) */
export interface TrackingView {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  deliveryType: 'delivery' | 'pickup';
  address: string;
  items: Array<{ name: string; quantity: number }>;
  total: number;
  createdAt: string;
  statusUpdatedAt: string;
  deliveryStartedAt: string | null;
  etaMinutes: number | null;
  destination: LatLng | null;
  courier: (LatLng & { updatedAt: string }) | null;
  restaurant: LatLng;
  route: TrackingRoute | null;
  complaintsCount: number;
}

// ---------------------------------------------------------------------------
// Row mapping
// ---------------------------------------------------------------------------

interface OrderItemRow {
  position: number;
  item_id: string;
  name: string;
  quantity: number;
  price: number | string;
  modifiers_description: string | null;
}

interface OrderRow {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  delivery_type: Order['deliveryType'];
  address: string;
  lat: number | null;
  lng: number | null;
  apartment: string | null;
  entrance: string | null;
  floor: string | null;
  intercom: string | null;
  notes: string | null;
  subtotal: number | string;
  delivery_fee: number | string;
  tax: number | string;
  total: number | string;
  payment_method: Order['paymentMethod'];
  payment_status: Order['paymentStatus'];
  status: OrderStatus;
  created_at: string;
  status_updated_at: string;
  delivery_started_at: string | null;
  eta_minutes: number | null;
  courier_token: string | null;
  courier_lat: number | null;
  courier_lng: number | null;
  courier_updated_at: string | null;
  order_items?: OrderItemRow[];
  order_complaints?: Array<{ count: number }>;
}

const ORDER_SELECT = '*, order_items(*), order_complaints(count)';

const toNumber = (value: number | string) => Number(value);
const orUndefined = <T>(value: T | null) => (value === null ? undefined : value);

function fromRow(row: OrderRow): StoredOrder {
  return {
    id: row.id,
    orderNumber: row.order_number,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    customerEmail: orUndefined(row.customer_email),
    deliveryType: row.delivery_type,
    address: row.address,
    coordinates: row.lat !== null && row.lng !== null ? { lat: row.lat, lng: row.lng } : undefined,
    apartment: orUndefined(row.apartment),
    entrance: orUndefined(row.entrance),
    floor: orUndefined(row.floor),
    intercom: orUndefined(row.intercom),
    notes: orUndefined(row.notes),
    items: [...(row.order_items || [])]
      .sort((a, b) => a.position - b.position)
      .map(it => ({
        itemId: it.item_id,
        name: it.name,
        quantity: it.quantity,
        price: toNumber(it.price),
        modifiersDescription: orUndefined(it.modifiers_description),
      })),
    subtotal: toNumber(row.subtotal),
    deliveryFee: toNumber(row.delivery_fee),
    tax: toNumber(row.tax),
    total: toNumber(row.total),
    status: row.status,
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status,
    createdAt: row.created_at,
    statusUpdatedAt: row.status_updated_at,
    deliveryStartedAt: orUndefined(row.delivery_started_at),
    etaMinutes: orUndefined(row.eta_minutes),
    courier:
      row.courier_lat !== null && row.courier_lng !== null && row.courier_updated_at
        ? { lat: row.courier_lat, lng: row.courier_lng, updatedAt: row.courier_updated_at }
        : undefined,
    courierToken: orUndefined(row.courier_token),
    complaintsCount: row.order_complaints?.[0]?.count ?? 0,
  };
}

/** Phone as stored and looked up everywhere: no spaces, dashes or brackets */
export function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-()]/g, '').trim();
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export async function saveOrder(order: Order): Promise<StoredOrder> {
  const db = getSupabase();
  const now = new Date().toISOString();

  check(
    await db.from('orders').upsert({
      id: order.id,
      order_number: order.orderNumber,
      customer_name: order.customerName,
      customer_phone: normalizePhone(order.customerPhone),
      customer_email: order.customerEmail || null,
      delivery_type: order.deliveryType,
      address: order.address,
      lat: order.coordinates?.lat ?? null,
      lng: order.coordinates?.lng ?? null,
      apartment: order.apartment || null,
      entrance: order.entrance || null,
      floor: order.floor || null,
      intercom: order.intercom || null,
      notes: order.notes || null,
      subtotal: order.subtotal,
      delivery_fee: order.deliveryFee,
      tax: order.tax,
      total: order.total,
      payment_method: order.paymentMethod,
      payment_status: order.paymentStatus,
      status: order.status,
      created_at: order.createdAt || now,
      status_updated_at: now,
    }),
    'save order'
  );

  // A repeated save replaces the lines instead of duplicating them
  check(await db.from('order_items').delete().eq('order_id', order.id), 'clear order items');
  check(
    await db.from('order_items').insert(
      order.items.map((it, position) => ({
        order_id: order.id,
        position,
        item_id: it.itemId,
        name: it.name,
        quantity: it.quantity,
        price: it.price,
        modifiers_description: it.modifiersDescription || null,
      }))
    ),
    'save order items'
  );

  return (await getOrder(order.id))!;
}

export async function getOrder(id: string): Promise<StoredOrder | null> {
  const row = check(await getSupabase().from('orders').select(ORDER_SELECT).eq('id', id).maybeSingle(), 'load order');
  return row ? fromRow(row as OrderRow) : null;
}

/** Newest orders first, for the admin panel */
export async function listOrders(limit = 200): Promise<StoredOrder[]> {
  const rows = check(
    await getSupabase().from('orders').select(ORDER_SELECT).order('created_at', { ascending: false }).limit(limit),
    'list orders'
  ) ?? [];
  return (rows as OrderRow[]).map(fromRow);
}

/** Road driving time for the ETA, looked up only when the courier is about to leave */
export async function roadMinutesFromKitchen(id: string, status: OrderStatus): Promise<number | undefined> {
  if (status !== 'in_delivery') return undefined;
  const order = await getOrder(id);
  if (!order?.coordinates || order.deliveryStartedAt) return undefined;
  const route = await getRoadRoute(RESTAURANT_COORDS, order.coordinates);
  return route?.durationMinutes;
}

/** `roadMinutes`: driving time along the roads, used for the ETA when the courier leaves */
export async function updateOrderStatus(id: string, status: OrderStatus, roadMinutes?: number): Promise<StoredOrder | null> {
  const db = getSupabase();
  const now = new Date().toISOString();

  const updated = check(
    await db.from('orders').update({ status, status_updated_at: now }).eq('id', id).select('id, lat, lng'),
    'update order status'
  ) ?? [];
  if (!updated.length) return null;

  if (status === 'in_delivery') {
    const { lat, lng } = updated[0] as { lat: number | null; lng: number | null };
    const etaMinutes =
      lat !== null && lng !== null
        ? Math.max(5, Math.round(roadMinutes ?? travelMinutes(RESTAURANT_COORDS, { lat, lng })) + 3)
        : DEFAULT_DELIVERY_MINUTES;

    // Only the first departure counts: a repeated "in delivery" keeps the original clock
    check(
      await db
        .from('orders')
        .update({ delivery_started_at: now, eta_minutes: etaMinutes })
        .eq('id', id)
        .is('delivery_started_at', null),
      'start delivery'
    );
  }

  return getOrder(id);
}

export async function updateCourierLocation(id: string, location: LatLng): Promise<StoredOrder | null> {
  const updated = check(
    await getSupabase()
      .from('orders')
      .update({ courier_lat: location.lat, courier_lng: location.lng, courier_updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id'),
    'update courier location'
  ) ?? [];
  return updated.length ? getOrder(id) : null;
}

// ---------------------------------------------------------------------------
// Views for the tracking and courier pages
// ---------------------------------------------------------------------------

export function toTrackingView(order: StoredOrder): TrackingView {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    deliveryType: order.deliveryType,
    address: order.address,
    items: order.items.map(it => ({ name: it.name, quantity: it.quantity })),
    total: order.total,
    createdAt: order.createdAt,
    statusUpdatedAt: order.statusUpdatedAt,
    deliveryStartedAt: order.deliveryStartedAt || null,
    etaMinutes: order.etaMinutes ?? null,
    destination: order.coordinates || null,
    courier: order.courier || null,
    restaurant: RESTAURANT_COORDS,
    route: null,
    complaintsCount: order.complaintsCount,
  };
}

/** Tracking view with the road route of an active delivery */
export async function toTrackingViewWithRoute(order: StoredOrder): Promise<TrackingView> {
  const view = toTrackingView(order);
  if (view.status !== 'in_delivery' || view.deliveryType !== 'delivery' || !view.destination) return view;

  const fromCourier = view.courier && isCourierFresh(view.courier);
  const route = await getRoadRoute(fromCourier ? view.courier! : view.restaurant, view.destination);
  return { ...view, route: route && { ...route, origin: fromCourier ? 'courier' : 'restaurant' } };
}

export function toCourierView(order: StoredOrder): CourierView {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    address: order.address,
    notes: order.notes || null,
    destination: order.coordinates || null,
    total: order.total,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
  };
}

// ---------------------------------------------------------------------------
// Courier link
// ---------------------------------------------------------------------------

export async function ensureCourierToken(id: string): Promise<string | null> {
  const db = getSupabase();
  const order = await getOrder(id);
  if (!order) return null;
  if (order.courierToken) return order.courierToken;

  // Set only if still empty, so two admins clicking at once get the same link
  check(
    await db
      .from('orders')
      .update({ courier_token: crypto.randomBytes(16).toString('base64url') })
      .eq('id', id)
      .is('courier_token', null),
    'create courier token'
  );
  return (await getOrder(id))?.courierToken ?? null;
}

export function isValidCourierToken(order: StoredOrder, token: unknown): boolean {
  if (!order.courierToken || typeof token !== 'string') return false;
  const expected = Buffer.from(order.courierToken);
  const given = Buffer.from(token);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

// ---------------------------------------------------------------------------
// Complaints
// ---------------------------------------------------------------------------

export async function addOrderComplaint(id: string, complaint: OrderComplaint): Promise<StoredOrder | null> {
  check(
    await getSupabase().from('order_complaints').insert({
      id: complaint.id,
      order_id: id,
      created_at: complaint.createdAt,
      items: complaint.items,
      description: complaint.description,
      photos: complaint.photos,
    }),
    'save complaint'
  );
  return getOrder(id);
}

/** Upload a complaint photo to storage and return its object path */
export async function saveComplaintPhoto(
  complaintId: string,
  index: number,
  extension: string,
  contentType: string,
  content: Buffer
): Promise<string> {
  const objectPath = `${complaintId}/${index + 1}.${extension}`;
  check(
    await getSupabase().storage.from(COMPLAINT_PHOTOS_BUCKET).upload(objectPath, content, { contentType, upsert: true }),
    'upload complaint photo'
  );
  return objectPath;
}
