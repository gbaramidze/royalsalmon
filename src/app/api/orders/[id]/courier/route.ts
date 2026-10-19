import { NextResponse } from 'next/server';
import { isLatLng } from '@/lib/geo';
import {
  getOrder,
  isValidCourierToken,
  roadMinutesFromKitchen,
  toCourierView,
  updateCourierLocation,
  updateOrderStatus,
} from '@/lib/orders';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

const forbidden = () => NextResponse.json({ success: false, error: 'Invalid courier link' }, { status: 403 });
const notFound = () => NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });

// Order details for the courier page: ?t=<courier token>
export async function GET(req: Request, { params }: RouteContext) {
  const { id } = await params;
  const order = await getOrder(id);
  if (!order) return notFound();
  if (!isValidCourierToken(order, new URL(req.url).searchParams.get('t'))) return forbidden();

  return NextResponse.json({ success: true, order: toCourierView(order) });
}

// From the courier page: { token, lat, lng } — live position; { token, action: 'delivered' } — order handed over
export async function POST(req: Request, { params }: RouteContext) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const order = await getOrder(id);
  if (!order) return notFound();
  if (!isValidCourierToken(order, body?.token)) return forbidden();

  if (order.status === 'completed' || order.status === 'cancelled') {
    return NextResponse.json({ success: true, order: toCourierView(order) });
  }

  if (body?.action === 'delivered') {
    const updated = await updateOrderStatus(id, 'completed');
    return updated ? NextResponse.json({ success: true, order: toCourierView(updated) }) : notFound();
  }

  const location = { lat: body?.lat, lng: body?.lng };
  if (!isLatLng(location)) {
    return NextResponse.json({ success: false, error: 'lat and lng are required' }, { status: 400 });
  }

  // The courier started sharing the position, so the order is on its way
  if (order.status === 'new' || order.status === 'preparing') {
    await updateOrderStatus(id, 'in_delivery', await roadMinutesFromKitchen(id, 'in_delivery'));
  }

  const updated = await updateCourierLocation(id, location);
  return updated ? NextResponse.json({ success: true, order: toCourierView(updated) }) : notFound();
}
