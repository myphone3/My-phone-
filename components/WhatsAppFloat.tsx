'use client';

import { usePathname } from 'next/navigation';
import { whatsappLink } from '@/lib/storeInfo';

// כפתור וואטסאפ צף בפינת המסך
export default function WhatsAppFloat() {
  const pathname = usePathname();
  if (pathname?.startsWith('/admin')) return null;

  return (
    <a
      href={whatsappLink('שלום, אשמח לעזרה באתר NEW PHONE')}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="שיחה בוואטסאפ"
      className="fixed bottom-5 left-5 z-[90] w-14 h-14 rounded-full bg-[#25D366] hover:scale-110 transition shadow-xl flex items-center justify-center"
    >
      <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true" fill="#fff">
        <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21c5.46 0 9.91-4.45 9.91-9.91C21.95 6.45 17.5 2 12.04 2Zm5.8 14.02c-.25.69-1.44 1.33-1.98 1.37-.53.05-1.03.24-3.47-.72-2.93-1.16-4.79-4.17-4.94-4.36-.14-.19-1.18-1.57-1.18-3s.75-2.13 1.02-2.42c.26-.29.57-.36.77-.36l.55.01c.18.01.42-.07.65.5.25.59.84 2.03.91 2.18.07.14.12.31.02.5-.1.19-.14.31-.29.48-.14.17-.3.38-.43.51-.14.14-.29.3-.13.59.17.29.74 1.22 1.58 1.97 1.09.97 2 1.27 2.29 1.42.29.14.46.12.62-.07.17-.19.72-.84.91-1.13.19-.29.38-.24.65-.14.26.1 1.68.79 1.97.94.29.14.48.21.55.33.07.12.07.69-.18 1.38Z" />
      </svg>
    </a>
  );
}
