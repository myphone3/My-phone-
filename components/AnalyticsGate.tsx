'use client';

import { usePathname } from 'next/navigation';

// לא טוענים כלי מעקב בפאנל הניהול, כדי שהכניסות של המנהל לא ייספרו כמבקרים
export default function AnalyticsGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname?.startsWith('/admin')) return null;
  return <>{children}</>;
}
