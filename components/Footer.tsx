'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BUSINESS } from '@/lib/business';
import Fill from './Fill';

const LINKS = [
  { href: '/terms', label: 'תקנון האתר' },
  { href: '/returns', label: 'ביטולים והחזרות' },
  { href: '/privacy', label: 'מדיניות פרטיות' },
  { href: '/accessibility', label: 'הצהרת נגישות' },
];

export default function Footer() {
  const pathname = usePathname();
  if (pathname?.startsWith('/admin')) return null;

  return (
    <footer className="bg-gray-900 text-gray-300 mt-16 text-xs" dir="rtl">
      <div className="max-w-6xl mx-auto px-4 py-10 grid gap-8 sm:grid-cols-3 text-center sm:text-right">
        <div className="space-y-2">
          <p className="text-lg font-black text-orange-400">NEW PHONE</p>
          <p className="text-gray-400 leading-6">החנות המובילה למכשירים כשרים, סלולר ונגנים באיכות הגבוהה ביותר.</p>
        </div>

        <div className="space-y-2">
          <p className="font-bold text-white text-sm">מידע ללקוחות</p>
          <ul className="space-y-1.5">
            {LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="hover:text-orange-400 transition">
                  {link.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/cart?tab=orders" className="hover:text-orange-400 transition">
                ההזמנות שלי
              </Link>
            </li>
          </ul>
        </div>

        <div className="space-y-2">
          <p className="font-bold text-white text-sm">יצירת קשר</p>
          <ul className="space-y-1.5">
            <li>
              📞{' '}
              {BUSINESS.phone ? (
                <a href={`tel:${BUSINESS.phone}`} className="hover:text-orange-400" dir="ltr">
                  {BUSINESS.phone}
                </a>
              ) : (
                <Fill label="טלפון" />
              )}
            </li>
            <li>
              💬{' '}
              {BUSINESS.whatsapp ? (
                <a href={`https://wa.me/${BUSINESS.whatsapp}`} target="_blank" rel="noopener noreferrer" className="hover:text-orange-400">
                  שלחו לנו וואטסאפ
                </a>
              ) : (
                <Fill label="וואטסאפ" />
              )}
            </li>
            <li>
              ✉️{' '}
              {BUSINESS.email ? (
                <a href={`mailto:${BUSINESS.email}`} className="hover:text-orange-400">
                  {BUSINESS.email}
                </a>
              ) : (
                <Fill label="מייל" />
              )}
            </li>
            <li>
              🕒 <Fill value={BUSINESS.hours} label="שעות פעילות" />
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-gray-800 py-4 px-4 text-center text-gray-500">
        © {new Date().getFullYear()} NEW PHONE · כל הזכויות שמורות
      </div>
    </footer>
  );
}
