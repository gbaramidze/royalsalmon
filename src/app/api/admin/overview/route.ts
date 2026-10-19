import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { listOrders } from '@/lib/orders';
import { check, getSupabase } from '@/lib/supabase';
import { Customer } from '@/types';

export const dynamic = 'force-dynamic';

const WEEKDAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

function tierFor(totalSpent: number): Customer['tier'] {
  if (totalSpent >= 1500) return 'VIP';
  if (totalSpent >= 800) return 'Gold';
  if (totalSpent >= 400) return 'Silver';
  return 'Standard';
}

// Everything the admin panel shows: orders, customers and the 7-day sales chart
export async function GET(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  try {
    const db = getSupabase();
    const [orders, customerRows, salesRows] = await Promise.all([
      listOrders(),
      db.from('customer_stats').select('*').order('total_spent', { ascending: false }).limit(500),
      db.from('daily_sales').select('*'),
    ]);

    const customers: Customer[] = (check(customerRows, 'load customers') ?? []).map(c => ({
      id: c.phone,
      name: c.name,
      phone: c.phone,
      email: c.email || '',
      ordersCount: Number(c.orders_count),
      totalSpent: Number(c.total_spent),
      lastOrderDate: String(c.last_order_at).slice(0, 10),
      tier: tierFor(Number(c.total_spent)),
    }));

    const dailySales = (check(salesRows, 'load daily sales') ?? []).map(d => {
      const [year, month, day] = String(d.day).split('-').map(Number);
      const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
      return {
        day: `${weekday} (${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')})`,
        revenue: Number(d.revenue),
        orders: Number(d.orders),
      };
    });

    // The courier link secret is handed out only through the courier-link endpoint
    return NextResponse.json({
      success: true,
      orders: orders.map(({ courierToken: _courierToken, ...order }) => order),
      customers,
      dailySales,
    });
  } catch (error) {
    console.error('Failed to load admin overview:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Database error' },
      { status: 500 }
    );
  }
}
