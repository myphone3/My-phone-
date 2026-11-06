'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/lib/toast';
import { formatDate } from '@/lib/orders';

type Member = { user_id: string; email: string; role: string; created_at: string };

const ROLE_LABEL: Record<string, string> = { owner: '👑 בעלים - רואה הכל', staff: '🧑‍💼 עובד - הזמנות ומוצרים' };

const MESSAGES: Record<string, string> = {
  not_found: 'לא נמצא משתמש עם המייל הזה. בקשו מהעובד להתחבר לאתר עם גוגל פעם אחת, ונסו שוב.',
  not_allowed: 'רק בעלים יכול לנהל את הצוות.',
  self: 'אי אפשר לשנות את ההרשאה של עצמך.',
  bad_role: 'הרשאה לא תקינה.',
};

// צוות והרשאות: הוספת עובדים לפי מייל, ובחירה מה כל אחד רואה
export default function StaffPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [me, setMe] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'staff' | 'owner'>('staff');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [{ data }, { data: session }] = await Promise.all([supabase.rpc('admin_list_staff'), supabase.auth.getSession()]);
    setMembers((data as Member[]) || []);
    setMe(session.session?.user.id || '');
  };

  useEffect(() => {
    load();
  }, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    const { data, error } = await supabase.rpc('admin_add_staff', { p_email: email.trim(), p_role: role });
    setBusy(false);
    if (error || data !== 'ok') return showToast(MESSAGES[String(data)] || 'השמירה נכשלה', { kind: 'error' });
    showToast('נשמר ✓', { kind: 'success' });
    setEmail('');
    load();
  };

  const remove = async (m: Member) => {
    if (!confirm(`להסיר את ${m.email} מהצוות? הוא לא יוכל להיכנס לניהול.`)) return;
    const { data, error } = await supabase.rpc('admin_remove_staff', { p_user_id: m.user_id });
    if (error || data !== 'ok') return showToast(MESSAGES[String(data)] || 'ההסרה נכשלה', { kind: 'error' });
    load();
  };

  return (
    <div className="space-y-4 max-w-3xl" dir="rtl">
      <div className="bg-white p-5 rounded-3xl border-2 border-orange-200 space-y-1">
        <h1 className="text-xl font-black text-gray-900">🔐 צוות והרשאות</h1>
        <p className="text-xs text-gray-500">
          עובד רואה רק הזמנות, מוצרים, ביקורות ושאלות נפוצות. הוא לא רואה הכנסות, רווח, לקוחות, דוחות והגדרות.
        </p>
      </div>

      <form onSubmit={add} className="bg-white p-5 rounded-3xl border-2 border-orange-200 space-y-3">
        <div className="font-black text-gray-900 text-sm">➕ הוספת איש צוות</div>
        <p className="text-[11px] text-gray-500">העובד צריך קודם להיכנס לאתר פעם אחת עם חשבון הגוגל שלו. אחר כך כותבים כאן את המייל שלו.</p>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="המייל של העובד (gmail)"
          dir="ltr"
          className="w-full bg-gray-50 border rounded-xl p-3 text-sm outline-none focus:border-orange-600"
        />
        <div className="grid grid-cols-2 gap-2">
          {(['staff', 'owner'] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={`p-3 rounded-xl border text-xs font-bold cursor-pointer ${role === r ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-gray-700'}`}
            >
              {ROLE_LABEL[r]}
            </button>
          ))}
        </div>
        <button disabled={busy} className="w-full bg-orange-600 hover:bg-orange-700 text-white py-3 rounded-xl text-sm font-black cursor-pointer disabled:opacity-60">
          {busy ? 'שומר...' : 'הוספה'}
        </button>
      </form>

      <div className="bg-white rounded-3xl border-2 border-orange-200 divide-y divide-orange-100">
        {members.map((m) => (
          <div key={m.user_id} className="p-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="font-bold text-sm text-gray-900 truncate" dir="ltr">{m.email}</div>
              <div className="text-[11px] text-gray-500">{ROLE_LABEL[m.role] || m.role} · מאז {formatDate(m.created_at)}</div>
            </div>
            {m.user_id === me ? (
              <span className="text-[11px] text-gray-400 shrink-0">זה את/ה</span>
            ) : (
              <button onClick={() => remove(m)} className="text-xs text-red-600 font-bold hover:underline cursor-pointer shrink-0">הסרה</button>
            )}
          </div>
        ))}
        {!members.length && <div className="p-6 text-center text-xs text-gray-400">טוען...</div>}
      </div>
    </div>
  );
}
