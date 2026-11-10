import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'קטגוריות ומותגים | NEW PHONE',
  description: 'כל הקטגוריות והמותגים בחנות NEW PHONE: מכשירים כשרים, תומכי כשר, סמארטפונים, נגנים ואביזרים.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
