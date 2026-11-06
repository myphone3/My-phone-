'use client';

import { useEffect, useState } from 'react';
import { COMPARE_EVENT, COMPARE_MAX, getCompare, toggleCompare } from '@/lib/compare';
import { showToast } from '@/lib/toast';

// כפתור "להשוואה" בדף מוצר
export default function CompareButton({ productId }: { productId: string }) {
  const [on, setOn] = useState(false);

  useEffect(() => {
    const update = () => setOn(getCompare().includes(productId));
    update();
    window.addEventListener(COMPARE_EVENT, update);
    return () => window.removeEventListener(COMPARE_EVENT, update);
  }, [productId]);

  const click = () => {
    const wasOn = on;
    if (!toggleCompare(productId)) {
      showToast(`אפשר להשוות עד ${COMPARE_MAX} מכשירים. הסירו אחד ונסו שוב.`, { kind: 'error' });
      return;
    }
    if (!wasOn) showToast('נוסף להשוואה ⚖️', { kind: 'success', action: { href: '/compare', label: 'להשוואה' } });
  };

  return (
    <button
      type="button"
      onClick={click}
      aria-pressed={on}
      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
        on ? 'bg-gray-900 border-gray-900 text-white' : 'bg-white border-gray-200 text-gray-700 hover:border-orange-300'
      }`}
    >
      <span>⚖️</span>
      <span>{on ? 'בהשוואה' : 'להשוואה'}</span>
    </button>
  );
}
