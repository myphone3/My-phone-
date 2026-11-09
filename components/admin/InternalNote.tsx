'use client';

import { useEffect, useRef, useState } from 'react';
import { showToast } from '@/lib/toast';

// הערה פנימית לצוות (הלקוח לא רואה אותה)
export default function InternalNote({ value, onSave, disabled = false }: { value: string; onSave: (text: string) => Promise<boolean>; disabled?: boolean }) {
  const [text, setText] = useState(value || '');
  const [saving, setSaving] = useState(false);

  // ערך חדש מבחוץ (טעינה או שמירה) מחליף את הטקסט רק אם לא נערך מאז
  const lastValue = useRef(value || '');
  useEffect(() => {
    setText((current) => (current === lastValue.current ? value || '' : current));
    lastValue.current = value || '';
  }, [value]);

  const changed = text.trim() !== (value || '').trim();

  const save = async () => {
    setSaving(true);
    const ok = await onSave(text.trim());
    setSaving(false);
    showToast(ok ? 'ההערה נשמרה' : 'שמירת ההערה נכשלה', { kind: ok ? 'success' : 'error' });
  };

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-3 space-y-2">
      <label className="block text-xs font-black text-yellow-900">📝 הערה פנימית (רק הצוות רואה)</label>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        maxLength={1000}
        disabled={disabled}
        placeholder="למשל: התקשרתי, רוצה איסוף עצמי ביום ראשון"
        className="w-full bg-white border border-yellow-200 rounded-xl p-2.5 text-xs outline-none focus:border-yellow-500"
      />
      {changed && (
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-1.5 rounded-xl text-xs font-black cursor-pointer disabled:opacity-60"
        >
          {saving ? 'שומר...' : 'שמירת ההערה'}
        </button>
      )}
    </div>
  );
}
