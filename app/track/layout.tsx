import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'מעקב הזמנה | NEW PHONE',
  description: 'בודקים איפה ההזמנה שלכם עם מספר ההזמנה ומספר הטלפון, בלי להתחבר.',
};

export default function TrackLayout({ children }: { children: React.ReactNode }) {
  return children;
}
