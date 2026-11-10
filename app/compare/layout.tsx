import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'השוואת מוצרים | NEW PHONE',
  description: 'השוואה בין מכשירים זה לצד זה.',
  robots: { index: false, follow: true },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
