'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('שגיאה בשליפת הזמנות:', error.message);
    } else if (data) {
      setOrders(data);
    }
    setLoading(false);
  };

  const handleStatusChange = async (orderId: string, newStatus: string, customerEmail?: string, customerName?: string) => {
    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', orderId);

    if (error) {
      alert('שגיאה בעדכון סטטוס: ' + error.message);
      return;
    }

    fetchOrders();
    setSelectedOrder((prev: any) => prev && prev.id === orderId ? { ...prev, status: newStatus } : prev);

    if (customerEmail) {
      let statusAction = `ההזמנה שלך התקבלה בהצלחה`;
      if (newStatus === 'מחכה למשלוח') statusAction = 'ההזמנה שלך מחכה למשלוח';
      else if (newStatus === 'מוכן לאיסוף') statusAction = 'ההזמנה שלך מוכנה לאיסוף';
      else if (newStatus === 'נשלח') statusAction = 'ההזמנה שלך נשלחה אליך';
      else if (newStatus === 'הושלם') statusAction = 'ההזמנה שלך הושלמה בהצלחה';
      else if (newStatus === 'בטיפול') statusAction = 'ההזמנה שלך נמצאת בטיפול';
      else if (newStatus === 'מבוטל') statusAction = 'ההזמנה שלך בוטלה';

      const orderShortId = orderId.slice(0, 8);
      const message = `שלום ${customerName || 'לקוח יקר'},\n\nשמחים לעדכן אותך שההזמנה שלך (#${orderShortId}) ${statusAction}.\n\nשמחים לתת לך שירות!`;

      try {
        await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: customerEmail,
            subject: `עדכון סטטוס הזמנה #${orderShortId}`,
            message: message
          })
        });
      } catch (err) {
        console.error('Email send failed:', err);
      }
    }
  };

  const getColorName = (colorVal: any) => {
    if (!colorVal) return '';
    if (typeof colorVal === 'string') return colorVal;
    if (typeof colorVal === 'object' && colorVal.name) return String(colorVal.name);
    return '';
  };

  const escapeHtml = (value: any) => {
    return String(value === null || value === undefined ? '' : value)
      .split('&').join('&amp;')
      .split('<').join('&lt;')
      .split('>').join('&gt;')
      .split('"').join('&quot;');
  };

  // Opens a clean page in a new window with only the order summary and prints it.
  // Works on iPhone Safari too (the window is opened directly from the click).
  const handlePrintPDF = () => {
    if (!selectedOrder) return;
    const o = selectedOrder;
    const shortId = o.id ? String(o.id).slice(0, 8) : '';
    const dateStr = o.created_at ? new Date(o.created_at).toLocaleString('he-IL') : '';
    const shipping = o.shipping_cost || 29;
    const items: any[] = Array.isArray(o.items) ? o.items : [];

    let rows = '';
    items.forEach((item: any, idx: number) => {
      const colorText = getColorName(item.selectedColor);
      const qty = item.quantity || 1;
      const price = (item.sale_price || item.price || 0) * qty;
      let desc = '<b>' + escapeHtml(item.name) + '</b>';
      if (item.selectedVariant) desc += '<div class="sub">גרסה: ' + escapeHtml(item.selectedVariant) + '</div>';
      if (colorText) desc += '<div class="sub">צבע: ' + escapeHtml(colorText) + '</div>';
      rows += '<tr><td class="c">' + (idx + 1) + '</td><td>' + desc + '</td><td class="c">' + qty + '</td><td class="l">₪' + price + '</td></tr>';
    });
    rows += '<tr class="ship"><td class="c">' + (items.length + 1) + '</td><td><b>משלוח מהיר עד הבית</b></td><td class="c">1</td><td class="l">₪' + shipping + '</td></tr>';

    const css = [
      'body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:0;padding:20px;direction:rtl;}',
      '.bar{text-align:center;margin-bottom:16px;}',
      '.btn{background:#ea580c;color:#fff;border:0;border-radius:12px;padding:12px 22px;font-size:16px;font-weight:bold;}',
      '.head{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #ea580c;padding-bottom:12px;}',
      '.brand{display:flex;align-items:center;gap:12px;}',
      '.brand img{width:56px;height:56px;object-fit:contain;border-radius:50%;border:1px solid #ddd;}',
      '.brand h2{margin:0;font-size:24px;}',
      '.brand p{margin:4px 0 0;color:#ea580c;font-size:12px;font-weight:bold;}',
      '.meta{text-align:left;}',
      '.meta .t{color:#ea580c;font-weight:bold;font-size:16px;}',
      '.meta .s{font-size:12px;color:#555;}',
      '.box{background:#f9fafb;border:1px solid #e5e7eb;border-radius:14px;padding:14px;margin:16px 0;font-size:13px;line-height:1.9;}',
      '.note{background:#fff7ed;border:1px solid #fed7aa;color:#c2410c;border-radius:10px;padding:8px;margin-top:8px;}',
      'table{width:100%;border-collapse:collapse;font-size:13px;}',
      'th{background:#ea580c;color:#fff;padding:9px;text-align:right;-webkit-print-color-adjust:exact;print-color-adjust:exact;}',
      'td{padding:9px;border-bottom:1px solid #e5e7eb;text-align:right;vertical-align:top;}',
      '.c{text-align:center;}.l{text-align:left;}',
      '.sub{font-size:11px;color:#6b7280;}',
      '.ship td{background:#fff7ed;}',
      '.total{text-align:left;border-top:3px solid #ea580c;margin-top:14px;padding-top:10px;font-size:20px;font-weight:bold;color:#ea580c;}',
      '.thanks{text-align:center;color:#6b7280;font-size:12px;margin-top:28px;padding-top:14px;border-top:1px dashed #d1d5db;}',
      '@media print{.bar{display:none;}body{padding:0;}}'
    ].join('');

    const logo = 'https://iiaxizrezhczgutqijbe.supabase.co/storage/v1/object/public/product-images/IMG_6252.jpeg';

    let notesHtml = '';
    if (o.notes) notesHtml = '<div class="note"><b>הערות למשלוח:</b> ' + escapeHtml(o.notes) + '</div>';

    const html =
      '<!DOCTYPE html><html dir="rtl" lang="he"><head><meta charset="UTF-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<title>הזמנה #' + escapeHtml(shortId) + '</title>' +
      '<style>' + css + '</style></head><body>' +
      '<div class="bar"><button class="btn" onclick="window.print()">🖨️ הדפס / שמור כ-PDF</button></div>' +
      '<div class="head"><div class="brand"><img src="' + logo + '" alt="NEW PHONE">' +
      '<div><h2>NEW PHONE</h2><p>הפלאפון החדש שלך</p></div></div>' +
      '<div class="meta"><div class="t">סיכום הזמנה</div><div class="s"><b>#' + escapeHtml(shortId) + '</b></div><div class="s">' + escapeHtml(dateStr) + '</div></div></div>' +
      '<div class="box"><b>פרטי לקוח למשלוח:</b><br>' +
      '👤 <b>שם מלא:</b> ' + escapeHtml(o.customer_name || 'לא צוין') + '<br>' +
      '📞 <b>טלפון:</b> ' + escapeHtml(o.phone || 'לא צוין') + '<br>' +
      '✉️ <b>אימייל:</b> ' + escapeHtml(o.email || 'לא צוין') + '<br>' +
      '📍 <b>כתובת למשלוח:</b> עיר: ' + escapeHtml(o.city || '') + ', רחוב: ' + escapeHtml(o.street || '') + ' ' + escapeHtml(o.building || '') +
      notesHtml + '</div>' +
      '<table><thead><tr><th class="c">#</th><th>תיאור מוצר / פריט</th><th class="c">כמות</th><th class="l">מחיר</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<div class="total">סה"כ לתשלום: ₪' + (o.total_price || 0) + '</div>' +
      '<div class="thanks">תודה שקנית ב-NEW PHONE! נשמח לראותך שוב ❤️</div>' +
      '</body></html>';

    const w = window.open('', '_blank');
    if (!w) {
      alert('הדפדפן חסם את החלון. אפשר חלונות קופצים ונסה שוב.');
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => {
      try {
        w.print();
      } catch (e) {
        console.error('print failed', e);
      }
    }, 800);
  };

  if (loading) return <div className="text-center py-20 text-gray-500 font-medium">טוען הזמנות...</div>;

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-2 sm:p-4" dir="rtl">

      <div className="flex items-center justify-between my-2">
        <h1 className="text-xl font-black text-gray-900 border-r-4 border-orange-600 pr-3 flex items-center gap-2">
          <span>📋</span>
          <span>ניהול הזמנות</span>
          <span className="text-sm font-normal text-gray-500">({orders.length})</span>
        </h1>
      </div>

      <div className="bg-white rounded-3xl border shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-gray-50 border-b text-gray-700 font-bold">
              <tr>
                <th className="p-4">מזהה הזמנה</th>
                <th className="p-4">שם הלקוח</th>
                <th className="p-4">טלפון</th>
                <th className="p-4">תאריך</th>
                <th className="p-4">סטטוס</th>
                <th className="p-4">סה"כ</th>
                <th className="p-4 text-center">פעולות</th>
              </tr>
            </thead>
            <tbody className="divide-y text-gray-800">
              {orders.length > 0 ? (
                orders.map((order) => (
                  <tr key={order.id} className="hover:bg-orange-50/40 transition cursor-pointer" onClick={() => setSelectedOrder(order)}>
                    <td className="p-4 font-black text-orange-800">#{order.id ? order.id.slice(0, 8) : ''}</td>
                    <td className="p-4 font-bold text-gray-900">{order.customer_name || 'ללא שם'}</td>
                    <td className="p-4 dir-ltr text-right">{order.phone || 'לא צוין'}</td>
                    <td className="p-4 text-gray-500">
                      {order.created_at ? new Date(order.created_at).toLocaleDateString('he-IL') : 'לא ידוע'}
                    </td>
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
                      <button
                        onClick={() => setSelectedOrder(order)}
                        className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                      >
                        👁️ צפה בפרטים
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-gray-400">
                    אין הזמנות חדשות במערכת כרגע.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedOrder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-2xl border relative my-auto">

            <div className="flex items-center justify-between border-b pb-3 sticky top-0 bg-white z-10">
              <button
                onClick={() => setSelectedOrder(null)}
                className="w-9 h-9 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center font-bold text-gray-600 cursor-pointer text-sm transition"
              >
                ✕
              </button>

              <button
                onClick={handlePrintPDF}
                className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-md"
              >
                <span>🖨️</span>
                <span>הדפס / שמור כ-PDF</span>
              </button>
            </div>

            <div className="space-y-4 text-xs text-gray-800">

              <div className="bg-orange-50/70 p-4 rounded-2xl border border-orange-200 flex items-center justify-between">
                <div>
                  <span className="bg-orange-100 text-orange-800 text-xs font-black px-2.5 py-1 rounded-md">
                    הזמנה #{selectedOrder.id ? selectedOrder.id.slice(0, 8) : ''}
                  </span>
                  <div className="text-gray-500 mt-1.5 font-medium">
                    תאריך: {selectedOrder.created_at ? new Date(selectedOrder.created_at).toLocaleString('he-IL') : 'לא ידוע'}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-700">סטטוס:</span>
                  <select
                    value={selectedOrder.status || 'חדש'}
                    onChange={(e) => handleStatusChange(selectedOrder.id, e.target.value, selectedOrder.email, selectedOrder.customer_name)}
                    className="bg-white border border-orange-300 text-orange-800 text-xs font-bold rounded-xl px-3 py-1.5 outline-none cursor-pointer shadow-xs"
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
                <div className="font-bold text-gray-900 border-b pb-1.5 mb-2 text-sm flex items-center gap-1.5">
                  <span>👤</span> פרטי לקוח וכתובת למשלוח
                </div>
                <p><strong>שם מלא:</strong> {selectedOrder.customer_name || 'לא צוין'}</p>
                <p><strong>טלפון:</strong> 
