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
import { getPosOrderStatus, PosStatus, siteStatusFromPos } from '@/lib/posOrders';
import type { OrderStatus } from '@/types';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/** Order of the site statuses; the POS may only move an order forward (or cancel it) */
const STATUS_RANK: Record<OrderStatus, number> = { new: 0, preparing: 1, in_delivery: 2, completed: 3, cancelled: 4 };

// Public order tracking data, kept in step with the restaurant POS
export async function GET(_req: Request, { params }: RouteContext) {
  const { id } = await params;
  let order = await getOrder(id);
  if (!order) {
    return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
  }

  let pos: PosStatus | null = null;
  if (order.status !== 'completed' && order.status !== 'cancelled') {
    pos = await getPosOrderStatus(order.id);
    if (pos) {
      const next = siteStatusFromPos(pos, order.deliveryType);
      // Never step back: e.g. staff may already have sent the courier from the admin panel
      if (STATUS_RANK[next] > STATUS_RANK[order.status]) {
        try {
          order = (await updateOrderStatus(id, next, await roadMinutesFromKitchen(id, next))) ?? order;
        } catch (error) {
          console.error('Failed to apply POS status:', error);
          order = { ...order, status: next };
        }
      }
    }
  }

  const view = await toTrackingViewWithRoute(order);
  return NextResponse.json({
    success: true,
    order: { ...view, posConfirmed: pos ? pos.confirmed : null, rejectionReason: pos?.rejectionReason ?? null },
  });
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

