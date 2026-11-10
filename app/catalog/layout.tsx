import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'כל המוצרים | NEW PHONE',
  description: 'כל המכשירים הכשרים, הסמארטפונים, הנגנים והאביזרים ב-NEW PHONE, עם סינון לפי קטגוריה, מחיר וכשרות.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
