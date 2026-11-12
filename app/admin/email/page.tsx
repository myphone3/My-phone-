'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// מסך המיילים אוחד עם מסך הלקוחות ("לקוחות ומיילים")
export default function AdminEmailRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/admin/customers#compose');
  }, [router]);
  return null;
}
