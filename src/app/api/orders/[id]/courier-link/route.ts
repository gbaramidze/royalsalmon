import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { ensureCourierToken } from '@/lib/orders';

export const dynamic = 'force-dynamic';

// Courier link for the admin panel: the courier opens it on the phone and shares the live position
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const { id } = await params;
  const token = await ensureCourierToken(id);
  if (!token) {
    return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
  }
  return NextResponse.json({ success: true, path: `/courier/${encodeURIComponent(id)}?t=${token}` });
}
