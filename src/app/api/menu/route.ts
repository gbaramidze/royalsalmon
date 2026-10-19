import { NextResponse } from 'next/server';
import { fetchLiveMenu, RESTIQ_API_URL } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const categories = await fetchLiveMenu();
    return NextResponse.json({
      success: true,
      source: RESTIQ_API_URL,
      categoriesCount: categories.length,
      totalItems: categories.reduce((acc, c) => acc + c.items.length, 0),
      categories
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
      }
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: String(error)
    }, { status: 500 });
  }
}
