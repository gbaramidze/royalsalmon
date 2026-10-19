import type { Metadata } from 'next';
import { fetchLiveMenu } from '@/lib/api';
import StorefrontView from '@/components/StorefrontView';

export const metadata: Metadata = {
  title: 'Royal Salmon | Доставка суши и роллов в Батуми',
  description: 'Премиальные сеты, запеченные и темпура роллы в Батуми. Быстрая доставка и самовывоз.',
};

// Revalidate server cache every 60 seconds
export const revalidate = 60;

export default async function Page() {
  // Pre-load menu on the server side (SSR) from RestIQ live API
  const categories = await fetchLiveMenu();

  return <StorefrontView initialCategories={categories} />;
}
