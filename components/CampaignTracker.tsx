'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { captureCampaignFromUrl } from '@/lib/campaign';

// קולט ?ref= מהכתובת בכל עמוד שהלקוח נוחת בו (גם כשרק הפרמטרים בכתובת משתנים)
export default function CampaignTracker() {
  const pathname = usePathname();
  const ref = useSearchParams()?.get('ref');
  useEffect(() => {
    if (!pathname?.startsWith('/admin')) captureCampaignFromUrl();
  }, [pathname, ref]);
  return null;
}
