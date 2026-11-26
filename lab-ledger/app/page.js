'use client';
import { useEffect, useRef } from 'react';

export default function Page() {
  const root = useRef(null);
  useEffect(() => {
    let done = false;
    import('@/lib/ledger').then((m) => { if (!done && root.current) m.start(root.current); });
    return () => { done = true; };
  }, []);
  return <div ref={root} />;
}
