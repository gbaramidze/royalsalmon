import type { Metadata } from 'next';
import TrackingView from '@/components/TrackingView';

export const metadata: Metadata = {
  title: 'Royal Salmon | Статус заказа',
  robots: { index: false },
};

export default async function TrackingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const { id } = await params;
  const { edit } = await searchParams;

  return <TrackingView orderId={id} editMode={edit === '1'} />;
}
