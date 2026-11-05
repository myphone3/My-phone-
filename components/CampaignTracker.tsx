'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { captureCampaignFromUrl } from '@/lib/campaign';

// קולט ?ref= מהכתובת בכל עמוד שהלקוח נוחת בו
export default function CampaignTracker() {
  const pathname = usePathname();
  useEffect(() => {
    if (!pathname?.startsWith('/admin')) captureCampaignFromUrl();
  }, [pathname]);
  return null;
}
