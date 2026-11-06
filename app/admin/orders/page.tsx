'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { orderNumber } from '@/lib/orders';
import { fetchAll } from '@/lib/fetchAll';
import { escapeHtml, shippingLabelsHtml, waNumber } from '@/lib/shippingLabels';

const STATUSES = ['חדש', 'בטיפול', 'מחכה למשלוח', 'מוכן לאיסוף', 'נשלח', 'הושלם', 'מבוטל'];

// כפתור וואטסאפ ללקוח, עם הודעה פתוחה על ההזמנה
const WhatsAppButton = ({ order, label }: { order: any; label?: string }) => {
  const num = waNumber(order.phone || order.customer_phone);
  if (!num) return null;
  const text = `שלום ${order.customer_name || ''}, כאן NEW PHONE לגבי הזמנה #${orderNumber(order.id)}`;
  return (
    <a
      href={`https://wa.me/${num}?text=${encodeURIComponent(text)}`}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1"
      title="שליחת וואטסאפ ללקוח"
    >
      💬{label ? ` ${label}` : ''}
    </a>
  );
};

// מספר הזמנה: 8 ספרות בלבד, מחושב מהמזהה הפנימי (תמיד אותו מספר לאותה הזמנה)
const getOrderNumber = orderNumber;

export default function AdminOrdersPage() {
  return (
    <Suspense fallback={<div className="text-center py-20 text-gray-500 font-medium">טוען הזמנות...</div>}>
      <AdminOrders />
    </Suspense>
  );
}

function AdminOrders() {
  const params = useSearchParams();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  // חיפוש וסינון (אפשר להגיע עם ?q=מייל ממסך הלקוחות)
  const [search, setSearch] = useState(params?.get('q') || '');
  // מעבר לאותו מסך עם חיפוש אחר (למשל מהדשבורד) מעדכן את החיפוש
  const qParam = params?.get('q') || '';
  useEffect(() => {
    if (qParam) setSearch(qParam);
  }, [qParam]);
  const [statusFilter, setStatusFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  // הזמנות שסומנו להדפסת מדבקות משלוח
  const [checked, setChecked] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    const { data, error } = await fetchAll((a, b) =>
      supabase.from('orders').select('*').order('created_at', { ascending: false }).order('id').range(a, b)
    );
    if (error) alert('שגיאה בטעינת ההזמנות: ' + (error.message || ''));
    else setOrders(data);
    setLoading(false);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase().replace(/^#/, '');
    // התאמה לפי ספרות רק כשהחיפוש הוא מספר (טלפון או מספר הזמנה), לא כשיש בו אותיות
    const numericQuery = /^[\d\s\-+]+$/.test(q);
    const qDigits = numericQuery ? q.replace(/\D/g, '') : '';
    const from = fromDate ? new Date(fromDate + 'T00:00:00') : null;
    // עד סוף היום שנבחר: עד תחילת היום שאחריו (לא כולל)
    const to = toDate ? (([y, m, d]) => new Date(y, m - 1, d + 1))(toDate.split('-').map(Number)) : null;
    return orders.filter((o) => {
      if (statusFilter && (o.status || 'חדש') !== statusFilter) return false;
      const d = o.created_at ? new Date(o.created_at) : null;
      if (from && (!d || d < from)) return false;
      if (to && (!d || d >= to)) return false;
      if (!q) return true;
      const phone = String(o.phone || o.customer_phone || '').replace(/\D/g, '');
      return (
        String(o.customer_name || '').toLowerCase().includes(q) ||
        String(o.email || '').toLowerCase().includes(q) ||
        (qDigits.length >= 3 && (phone.includes(qDigits) || orderNumber(o.id).includes(qDigits)))
      );
    });
  }, [orders, search, statusFilter, fromDate, toDate]);

  // הגעה מהדשבורד עם מספר הזמנה: פותחים ישר את פרטי ההזמנה
  const [autoOpenedFor, setAutoOpenedFor] = useState('');
  useEffect(() => {
    if (loading || !qParam || autoOpenedFor === qParam || search !== qParam) return;
    setAutoOpenedFor(qParam);
    if (filtered.length === 1) setSelectedOrder(filtered[0]);
  }, [autoOpenedFor, loading, filtered, qParam, search]);

  const statusCounts = useMemo(() => {
    const c: Record<string, number> = {};
    orders.forEach((o) => (c[o.status || 'חדש'] = (c[o.status || 'חדש'] || 0) + 1));
    return c;
  }, [orders]);

  const toggleChecked = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const allShownChecked = filtered.length > 0 && filtered.every((o) => checked.has(o.id));
  const toggleAllShown = () =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (allShownChecked) filtered.forEach((o) => next.delete(o.id));
      else filtered.forEach((o) => next.add(o.id));
      return next;
    });

  const printLabels = () => {
    const chosen = orders.filter((o) => checked.has(o.id));
    if (!chosen.length) return;
    const blob = new Blob([shippingLabelsHtml(chosen)], { type: 'text/html;charset=utf-8;' });
    window.open(URL.createObjectURL(blob), '_blank');
  };

  const hasFilters = !!(search || statusFilter || fromDate || toDate);
  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setFromDate('');
    setToDate('');
  };

  const handleStatusChange = async (orderId: string, newStatus: string, customerEmail?: string, customerName?: string) => {
    const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
    if (error) return alert('שגיאה בעדכון סטטוס: ' + error.message);

    fetchOrders();
    setSelectedOrder((prev: any) => prev && prev.id === orderId ? { ...prev, status: newStatus } : prev);

    if (customerEmail) {
      try {
        // שליחת מייל מותרת רק למנהל מחובר, לכן מצרפים את ההתחברות שלו. הניסוח נבנה בשרת לפי הסטטוס
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          alert('הסטטוס עודכן, אך המייל ללקוח לא נשלח (צריך להתחבר מחדש)');
          return;
        }
        const res = await fetch('/api/order-status-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ orderId })
        });
        if (!res.ok) alert('הסטטוס עודכן, אך שליחת המייל ללקוח נכשלה');
      } catch (err) {
        alert('הסטטוס עודכן, אך שליחת המייל ללקוח נכשלה');
      }
    }
  };

  const getColorName = (colorVal: any) => {
    if (!colorVal) return '';
    if (typeof colorVal === 'string') return colorVal;
    return colorVal.name || '';
  };

  // יצירת ותצוגת קובץ PDF אמיתי בלחיצה
  const handleOpenPDF = () => {
    if (!selectedOrder) return;

    const logoUrl = 'https://iiaxizrezhczgutqijbe.supabase.co/storage/v1/object/public/product-images/IMG_6252.jpeg';
    const orderNumber = getOrderNumber(selectedOrder.id);
    const dateStr = selectedOrder.created_at ? new Date(selectedOrder.created_at).toLocaleString('he-IL') : '';

    const itemsRows = (selectedOrder.items || []).map((item: any, idx: number) => {
      const colorText = getColorName(item.selectedColor);
      return `
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 10px; text-align: center; font-weight: bold; width: 30px;">${idx + 1}</td>
          <td style="padding: 10px; font-weight: bold;">
            ${escapeHtml(item.name || 'מוצר')}
            ${item.selectedVariant ? `<div style="font-size: 11px; color: #6b7280; margin-top: 2px;">גרסה: ${escapeHtml(item.selectedVariant)}</div>` : ''}
            ${colorText ? `<div style="font-size: 11px; color: #6b7280; margin-top: 2px;">צבע: ${escapeHtml(colorText)}</div>` : ''}
          </td>
          <td style="padding: 10px; text-align: center; font-weight: bold; width: 50px;">${item.quantity || 1}</td>
          <td style="padding: 10px; text-align: left; font-weight: bold; width: 80px;">₪${(item.sale_price || item.price || 0) * (item.quantity || 1)}</td>
        </tr>
      `;
    }).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="he">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>סיכום הזמנה #${orderNumber}</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: system-ui, -apple-system, sans-serif; padding: 20px; color: #111827; direction: rtl; margin: 0; background: #fff; }
          .container { max-width: 650px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 16px; padding: 24px; }
          .header { display: flex; justify-content: center; padding-bottom: 14px; }
          .logo-img { width: 90px; height: 90px; object-fit: contain; border-radius: 50%; }
          .title-row { display: flex; justify-content: space-between; align-items: center; border-top: 2px solid #ea580c; padding-top: 16px; margin-bottom: 20px; }
          .doc-title { font-size: 28px; font-weight: 900; color: #ea580c; }
          .order-meta { text-align: left; }
          .order-label { font-size: 11px; font-weight: bold; color: #6b7280; }
          .order-num { font-size: 20px; font-weight: 900; color: #111827; direction: ltr; text-align: left; }
          .order-date { font-size: 11px; color: #6b7280; }
          .details-card { background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; font-size: 13px; line-height: 1.6; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 10px; }
          th { background-color: #ea580c; color: #ffffff; padding: 10px; text-align: right; }
          .total-card { margin-top: 20px; text-align: left; font-size: 18px; font-weight: 900; color: #ea580c; border-top: 2px solid #e5e7eb; padding-top: 14px; }
          .footer-note { margin-top: 30px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px dashed #e5e7eb; padding-top: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <img src="${logoUrl}" alt="NEW PHONE" class="logo-img" />
          </div>

          <div class="title-row">
            <div class="doc-title">סיכום הזמנה</div>
            <div class="order-meta">
              <div class="order-label">מספר הזמנה</div>
              <div class="order-num">#${orderNumber}</div>
              <div class="order-date">${dateStr}</div>
            </div>
          </div>

          <div class="details-card">
            <strong>פרטי לקוח למשלוח:</strong><br>
            שם מלא: <strong>${escapeHtml(selectedOrder.customer_name || 'לא צוין')}</strong><br>
            טלפון: ${escapeHtml(selectedOrder.phone || 'לא צוין')}<br>
            אימייל: ${escapeHtml(selectedOrder.email || 'לא צוין')}<br>
            כתובת למשלוח: עיר: ${escapeHtml(selectedOrder.city || '')}, רחוב: ${escapeHtml(selectedOrder.street || '')} ${escapeHtml(selectedOrder.building || '')}<br>
            ${selectedOrder.notes ? `<div style="margin-top:6px; color:#c2410c;"><strong>הערות למשלוח:</strong> ${escapeHtml(selectedOrder.notes)}</div>` : ''}
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 30px; text-align: center;">#</th>
                <th>תיאור מוצר / פריט</th>
                <th style="width: 50px; text-align: center;">כמות</th>
                <th style="width: 80px; text-align: left;">מחיר</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRows}
              <tr style="border-bottom: 1px solid #e5e7eb; background-color: #fff7ed;">
                <td style="padding: 10px; text-align: center; font-weight: bold;">${(selectedOrder.items || []).length + 1}</td>
                <td style="padding: 10px; font-weight: bold;">משלוח מהיר עד הבית</td>
                <td style="padding: 10px; text-align: center; font-weight: bold;">1</td>
                <td style="padding: 10px; text-align: left; font-weight: bold;">₪${selectedOrder.shipping_cost || 29}</td>
              </tr>
            </tbody>
          </table>

          <div class="total-card">
            סה"כ לתשלום: ₪${selectedOrder.total_price || 0}
          </div>

          <div class="footer-note">
            תודה שקנית ב-NEW PHONE! נשמח לראותך שוב ❤️
          </div>
        </div>
      </body>
      </html>
    `;

    // יצירת קובץ נתונים (Blob) ופתיחתו ישירות בדפדפן
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  if (loading) return <div className="text-center py-20 text-gray-500 font-medium">טוען הזמנות...</div>;

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-2 sm:p-4" dir="rtl">
      
      {/* כותרת */}
      <div className="flex items-center justify-between my-2">
        <h1 className="text-xl font-black text-gray-900 border-r-4 border-orange-600 pr-3 flex items-center gap-2">
          <span>📋</span>
          <span>ניהול הזמנות</span>
          <span className="text-sm font-normal text-gray-500">({orders.length})</span>
        </h1>
        {checked.size > 0 && (
          <button onClick={printLabels} className="bg-gray-900 hover:bg-black text-white px-4 py-2 rounded-xl text-xs font-bold cursor-pointer">
            🏷️ הדפסת מדבקות משלוח ({checked.size})
          </button>
        )}
      </div>

      {/* חיפוש וסינון */}
      <div className="bg-white rounded-3xl border p-4 space-y-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="חיפוש לפי שם, טלפון, מייל או מספר הזמנה..."
          className="w-full bg-gray-50 border rounded-xl p-3 text-xs outline-none focus:border-orange-600"
        />
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setStatusFilter('')}
            className={`px-3 py-1.5 rounded-full text-[11px] font-bold cursor-pointer ${!statusFilter ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-700'}`}
          >
            הכל ({orders.length})
          </button>
          {STATUSES.filter((st) => statusCounts[st]).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st === statusFilter ? '' : st)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-bold cursor-pointer ${statusFilter === st ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-700'}`}
            >
              {st} ({statusCounts[st]})
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <label className="flex items-center gap-1.5 text-gray-600 font-bold">
            מתאריך
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="bg-gray-50 border rounded-lg px-2 py-1.5" />
          </label>
          <label className="flex items-center gap-1.5 text-gray-600 font-bold">
            עד
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="bg-gray-50 border rounded-lg px-2 py-1.5" />
          </label>
          {hasFilters && (
            <button onClick={clearFilters} className="text-orange-700 font-bold hover:underline cursor-pointer">
              ניקוי סינון ✕
            </button>
          )}
          {hasFilters && <span className="text-gray-500">נמצאו {filtered.length}</span>}
        </div>
      </div>

      {/* טבלת ההזמנות */}
      <div className="bg-white rounded-3xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-gray-50 border-b text-gray-700 font-bold">
              <tr>
                <th className="p-4 w-8">
                  <input type="checkbox" checked={allShownChecked} onChange={toggleAllShown} className="accent-orange-600 w-4 h-4" title="סימון כל ההזמנות המוצגות" />
                </th>
                <th className="p-4">מספר הזמנה</th>
                <th className="p-4">שם הלקוח</th>
                <th className="p-4">טלפון</th>
                <th className="p-4">תאריך</th>
                <th className="p-4">סטטוס</th>
                <th className="p-4">סה"כ</th>
                <th className="p-4 text-center">פעולות</th>
              </tr>
            </thead>
            <tbody className="divide-y text-gray-800">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-gray-400">{orders.length ? 'אין הזמנות שמתאימות לחיפוש.' : 'עדיין אין הזמנות.'}</td>
                </tr>
              )}
              {filtered.map((order) => (
                <tr key={order.id} className={`hover:bg-orange-50/40 transition cursor-pointer ${checked.has(order.id) ? 'bg-orange-50/60' : ''}`} onClick={() => setSelectedOrder(order)}>
                  <td className="p-4" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={checked.has(order.id)} onChange={() => toggleChecked(order.id)} className="accent-orange-600 w-4 h-4" />
                  </td>
                  <td className="p-4 font-black text-orange-800" dir="ltr">#{getOrderNumber(order.id)}</td>
                  <td className="p-4 font-bold text-gray-900">{order.customer_name || 'ללא שם'}</td>
                  <td className="p-4 dir-ltr text-right">{order.phone || 'לא צוין'}</td>
                  <td className="p-4 text-gray-500">{order.created_at ? new Date(order.created_at).toLocaleDateString('he-IL') : ''}</td>
                  <td className="p-4" onClick={(e) => e.stopPropagation()}>
                    <select
                      value={order.status || 'חדש'}
                      onChange={(e) => handleStatusChange(order.id, e.target.value, order.email, order.customer_name)}
                      className="bg-orange-50 border border-orange-200 text-orange-800 text-[11px] font-bold rounded-xl px-2.5 py-1 outline-none cursor-pointer"
                    >
                      <option value="חדש">חדש 🆕</option>
                      <option value="בטיפול">בטיפול ⏳</option>
                      <option value="מחכה למשלוח">מחכה למשלוח 📦</option>
                      <option value="מוכן לאיסוף">מוכן לאיסוף 🛍️</option>
                      <option value="נשלח">נשלח 🚚</option>
                      <option value="הושלם">הושלם ✓</option>
                      <option value="מבוטל">מבוטל ❌</option>
                    </select>
                  </td>
                  <td className="p-4 font-black text-orange-600">₪{order.total_price || 0}</td>
                  <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-1.5">
                      <button onClick={() => setSelectedOrder(order)} className="bg-orange-600 text-white px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap">
                        👁️ פרטים
                      </button>
                      <WhatsAppButton order={order} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* מודל פרטי ההזמנה */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-2xl border relative my-auto">
            
            {/* סרגל עליון */}
            <div className="flex items-center justify-between border-b pb-3 sticky top-0 bg-white z-10">
              <button onClick={() => setSelectedOrder(null)} className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center font-bold text-gray-600 text-sm">
                ✕
              </button>

              {/* כפתור פתיחת מסמך הסיכום */}
              <button
                onClick={handleOpenPDF}
                className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer shadow-md"
              >
                <span>📄</span>
                <span>פתח סיכום הזמנה (PDF)</span>
              </button>
            </div>

            {/* פרטי הזמנה לצפייה בניהול */}
            <div className="space-y-4 text-xs text-gray-800">
              <div className="bg-orange-50/70 p-4 rounded-2xl border border-orange-200 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="bg-orange-100 text-orange-800 text-xs font-black px-2.5 py-1 rounded-md inline-flex gap-1">
                    <span>הזמנה</span>
                    <span dir="ltr">#{getOrderNumber(selectedOrder.id)}</span>
                  </span>
                  <div className="text-gray-500 mt-1.5 font-medium">
                    תאריך: {selectedOrder.created_at ? new Date(selectedOrder.created_at).toLocaleString('he-IL') : ''}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-700">סטטוס:</span>
                  <select
                    value={selectedOrder.status || 'חדש'}
                    onChange={(e) => handleStatusChange(selectedOrder.id, e.target.value, selectedOrder.email, selectedOrder.customer_name)}
                    className="bg-white border border-orange-300 text-orange-800 text-xs font-bold rounded-xl px-3 py-1.5 outline-none cursor-pointer max-w-full"
                  >
                    <option value="חדש">חדש 🆕</option>
                    <option value="בטיפול">בטיפול ⏳</option>
                    <option value="מחכה למשלוח">מחכה למשלוח 📦</option>
                    <option value="מוכן לאיסוף">מוכן לאיסוף 🛍️</option>
                    <option value="נשלח">נשלח 🚚</option>
                    <option value="הושלם">הושלם ✓</option>
                    <option value="מבוטל">מבוטל ❌</option>
                  </select>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-1.5">
                <div className="font-bold text-gray-900 border-b pb-1.5 mb-2 text-sm">👤 פרטי לקוח וכתובת למשלוח</div>
                <p><strong>שם מלא:</strong> {selectedOrder.customer_name || 'לא צוין'}</p>
                <p className="flex items-center gap-2 flex-wrap"><strong>טלפון:</strong> <a href={`tel:${selectedOrder.phone}`} className="text-blue-600 font-bold underline">{selectedOrder.phone || 'לא צוין'}</a> <WhatsAppButton order={selectedOrder} label="וואטסאפ" /></p>
                <p><strong>אימייל:</strong> {selectedOrder.email || 'לא צוין'}</p>
                <p><strong>כתובת:</strong> עיר: {selectedOrder.city || ''}, רחוב: {selectedOrder.street || ''} {selectedOrder.building || ''}</p>
                {selectedOrder.notes && (
                  <p className="mt-2 text-orange-700 bg-orange-50 p-2.5 rounded-xl border border-orange-200">
                    <strong>הערות לקוח:</strong> {selectedOrder.notes}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <div className="font-bold text-gray-900 text-sm pt-1">📦 מוצרים בהזמנה</div>
                <div className="space-y-2 max-h-52 overflow-y-auto">
                  {Array.isArray(selectedOrder.items) && selectedOrder.items.map((item: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between bg-white border p-3 rounded-2xl shadow-xs">
                      <div className="flex items-center gap-3">
                        {item.image_url && <img src={item.image_url} alt="" className="w-11 h-11 object-contain bg-gray-50 rounded-xl border p-0.5" />}
                        <div>
                          <span className="font-bold text-gray-900 block text-xs">{item.name}</span>
                          {item.selectedVariant && <span className="text-[10px] text-gray-500">גרסה: {item.selectedVariant} | </span>}
                          {getColorName(item.selectedColor) && <span className="text-[10px] text-gray-500">צבע: {getColorName(item.selectedColor)}</span>}
                        </div>
                      </div>
                      <div className="text-left">
                        <span className="text-gray-600 font-medium block">כמות: {item.quantity || 1}</span>
                        <span className="text-orange-600 font-black">₪{(item.sale_price || item.price || 0) * (item.quantity || 1)}</span>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-between bg-orange-50/50 border border-orange-200 p-3 rounded-2xl">
                    <span className="font-bold text-gray-900">משלוח מהיר עד הבית</span>
                    <span className="text-orange-600 font-black">₪{selectedOrder.shipping_cost || 29}</span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-900 text-white p-4 rounded-2xl flex justify-between items-center">
                <span className="font-bold text-sm">סה"כ לתשלום:</span>
                <span className="text-lg font-black text-orange-400">₪{selectedOrder.total_price || 0}</span>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
