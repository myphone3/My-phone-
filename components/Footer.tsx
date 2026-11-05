'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BUSINESS } from '@/lib/business';

const LINKS = [
  { href: '/terms', label: 'תקנון האתר' },
  { href: '/returns', label: 'ביטולים והחזרות' },
  { href: '/privacy', label: 'מדיניות פרטיות' },
  { href: '/accessibility', label: 'הצהרת נגישות' },
];

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="#25D366">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21c5.46 0 9.91-4.45 9.91-9.91C21.95 6.45 17.5 2 12.04 2Zm5.8 14.02c-.25.69-1.44 1.33-1.98 1.37-.53.05-1.03.24-3.47-.72-2.93-1.16-4.79-4.17-4.94-4.36-.14-.19-1.18-1.57-1.18-3s.75-2.13 1.02-2.42c.26-.29.57-.36.77-.36l.55.01c.18.01.42-.07.65.5.25.59.84 2.03.91 2.18.07.14.12.31.02.5-.1.19-.14.31-.29.48-.14.17-.3.38-.43.51-.14.14-.29.3-.13.59.17.29.74 1.22 1.58 1.97 1.09.97 2 1.27 2.29 1.42.29.14.46.12.62-.07.17-.19.72-.84.91-1.13.19-.29.38-.24.65-.14.26.1 1.68.79 1.97.94.29.14.48.21.55.33.07.12.07.69-.18 1.38Z" />
    </svg>
  );
}

function GmailIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path fill="#4285F4" d="M1.64 21h3.82v-9.27L0 7.64v11.72C0 20.27.73 21 1.64 21Z" />
      <path fill="#34A853" d="M18.55 21h3.81c.91 0 1.64-.73 1.64-1.64V7.64l-5.45 4.09Z" />
      <path fill="#FBBC04" d="M18.55 4.64v7.09L24 7.64V5.45c0-2.02-2.31-3.18-3.93-1.96Z" />
      <path fill="#EA4335" d="M5.45 11.73V4.64L12 9.55l6.55-4.91v7.09L12 16.64Z" />
      <path fill="#C5221F" d="M0 5.45v2.19l5.45 4.09V4.64L3.93 3.49C2.31 2.28 0 3.43 0 5.45Z" />
    </svg>
  );
}

export default function Footer() {
  const pathname = usePathname();
  if (pathname?.startsWith('/admin')) return null;

  return (
    <footer className="bg-gray-900 text-gray-300 mt-16 text-xs" dir="rtl">
      <div className="max-w-6xl mx-auto px-4 py-10 grid gap-8 sm:grid-cols-3 text-center sm:text-right">
        <div className="space-y-3">
          <Link href="/" className="inline-block hover:scale-105 transition">
            <img src="/logo-transparent.png" alt="NEW PHONE" className="w-24 h-24 object-contain" />
          </Link>
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
              <a
                href={`https://wa.me/${BUSINESS.whatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 hover:text-orange-400"
                aria-label={`וואטסאפ ${BUSINESS.phone}`}
              >
                <WhatsAppIcon />
                <span dir="ltr">{BUSINESS.phone}</span>
              </a>
            </li>
            <li>
              <a href={`mailto:${BUSINESS.email}`} className="inline-flex items-center gap-1.5 hover:text-orange-400">
                <GmailIcon />
                <span>{BUSINESS.email}</span>
              </a>
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
