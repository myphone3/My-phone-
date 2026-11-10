import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'חיפוש | NEW PHONE',
  description: 'חיפוש מוצרים בחנות NEW PHONE.',
  robots: { index: false, follow: true },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
