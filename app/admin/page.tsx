'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin/products');
  }, [router]);

  return <div className="text-center py-20 text-xs text-gray-500 font-medium">מעבר לפאנל הניהול...</div>;
}
