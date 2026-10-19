import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import {
  getOrder,
  ORDER_STATUSES,
  roadMinutesFromKitchen,
  toTrackingView,
  toTrackingViewWithRoute,
  updateOrderStatus,
} from '@/lib/orders';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

// Public order tracking data
export async function GET(_req: Request, { params }: RouteContext) {
  const { id } = await params;
  const order = await getOrder(id);
  if (!order) {
    return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
  }
  return NextResponse.json({ success: true, order: await toTrackingViewWithRoute(order) });
}

// Status change from the admin panel
export async function PATCH(req: Request, { params }: RouteContext) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const status = body?.status;

  if (!ORDER_STATUSES.includes(status)) {
    return NextResponse.json({ success: false, error: 'Invalid status' }, { status: 400 });
  }

  const order = await updateOrderStatus(id, status, await roadMinutesFromKitchen(id, status));
  if (!order) {
    return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
  }
  return NextResponse.json({ success: true, order: toTrackingView(order) });
}

