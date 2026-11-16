import { NextResponse } from 'next/server';
import { sendOrderNotification } from '@/lib/telegram';
import { saveOrder } from '@/lib/orders';
import { DELIVERY_ENABLED } from '@/lib/promos';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const orderData = await req.json();

    if (!orderData?.id || !orderData?.orderNumber || !orderData?.customerPhone || !Array.isArray(orderData?.items)) {
      return NextResponse.json({
        success: false,
        error: 'Order data is missing required fields'
      }, { status: 400 });
    }

    if (!DELIVERY_ENABLED && orderData.deliveryType === 'delivery') {
      return NextResponse.json({
        success: false,
        error: 'Доставка временно недоступна, доступен только самовывоз'
      }, { status: 400 });
    }

    // Keep the order on the server so the tracking page can follow its status
    await saveOrder({ ...orderData, status: 'new' });

    const result = await sendOrderNotification(orderData);
    return NextResponse.json({
      success: Boolean(result?.ok),
      result
    });
  } catch (error) {
    console.error('Error sending order notification via Telegram:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
