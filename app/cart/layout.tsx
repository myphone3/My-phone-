import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'עגלת קניות | NEW PHONE',
  description: 'עגלת הקניות שלך ב-NEW PHONE.',
  robots: { index: false, follow: true },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
