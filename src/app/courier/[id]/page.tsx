import type { Metadata } from 'next';
import CourierView from '@/components/CourierView';

export const metadata: Metadata = {
  title: 'Royal Salmon | Курьер',
  robots: { index: false },
};

export default async function CourierPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { id } = await params;
  const { t } = await searchParams;

  return <CourierView orderId={id} token={t || ''} />;
}
