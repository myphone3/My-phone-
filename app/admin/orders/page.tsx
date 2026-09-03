'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  const handleStatusChange = async (order: any, newStatus: string) => {
    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', order.id);

    if (error) {
      alert('שגיאה בעדכון סטטוס: ' + error.message);
      return;
    }

    fetchOrders();

    if (order.email) {
      let statusAction = `ההזמנה שלך התקבלה בהצלחה`;
      if (newStatus === 'מחכה למשלוח') statusAction = 'ההזמנה שלך מחכה למשלוח';
      else if (newStatus === 'מוכן לאיסוף') statusAction = 'ההזמנה שלך מוכנה לאיסוף';
      else if (newStatus === 'נשלח') statusAction = 'ההזמנה שלך נשלחה אליך';
      else if (newStatus === 'הושלם') statusAction = 'ההזמנה שלך הושלמה בהצלחה';
      else if (newStatus === 'בטיפול') statusAction = 'ההזמנה שלך נמצאת בטיפול';

      const orderShortId = order.id ? order.id.slice(0, 8) : '';
      const message = `שלום ${order.customer_name || 'לקוח יקר'},\n\nNEW PHONE שמחים לעדכן אותך שההזמנה שלך (#${orderShortId}) ${statusAction}.\n\nתודה שקנית אצלנו!\nNEW PHONE`;

      try {
        const res = await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: order.email,
            subject: `עדכון סטטוס הזמנה #${orderShortId} - NEW PHONE`,
            message: message
          })
        });

        if (res.ok) {
          alert('הסטטוס עודכן והודעת מייל עם מספר ההזמנה נשלחה בהצלחה ללקוח! ✉️');
        } else {
          alert('הסטטוס עודכן, אך שליחת המייל נכשלה.');
        }
      } catch (err) {
        console.error('Email send failed:', err);
      }
    } else {
      alert('הסטטוס עודכן בהצלחה (ללקוח זה לא הוזן אימייל).');
    }
  };

  const deleteOrder = async (orderId: string) => {
    if (!confirm('האם למחוק הזמנה זו לצמיתות?')) return;
    const { error } = await supabase.from('orders').delete().eq('id', orderId);
    if (error) {
      alert('שגיאה במחיקת הזמנה: ' + error.message);
    } else {
      fetchOrders();
    }
  };

  const printOrderPdf = (order: any) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const logoUrl = 'https://iiaxizrezhczgutqijbe.supabase.co/storage/v1/object/public/product-images/IMG_6252.jpeg';

    const itemsHtml = [
      ...(order.items || []).map((item: any, idx: number) => `
        <tr style="border-bottom: 1px solid #ddd;">
          <td style="padding: 10px;">${idx + 1}</td>
          <td style="padding: 10px;">${item.name} ${item.selectedVariant ? `(${item.selectedVariant})` : ''} ${item.selectedColor ? `- ${item.selectedColor.name}` : ''}</td>
          <td style="padding: 10px; text-align: center;">${item.quantity || 1}</td>
          <td style="padding: 10px; text-align: left;">₪${(item.sale_price || item.price || 0) * (item.quantity || 1)}</td>
        </tr>
      `),
      `
      <tr style="border-bottom: 1px solid #ddd; background-color: #fff7ed;">
        <td style="padding: 10px;">${(order.items || []).length + 1}</td>
        <td style="padding: 10px;">משלוח מהיר עד הבית</td>
        <td style="padding: 10px; text-align: center;">1</td>
        <td style="padding: 10px; text-align: left;">₪${order.shipping_cost || 29}</td>
      </tr>
      `
    ].join('');

    printWindow.document.write(`
      <html dir="rtl" lang="he">
      <head>
        <title>סיכום הזמנה #${order.id?.slice(0, 8)}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 30px; color: #333; direction: rtl; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #ea580c; padding-bottom: 20px; margin-bottom: 20px; }
          .logo-box { display: flex; align-items: center; gap: 12px; }
          .logo-img { width: 55px; height: 55px; object-fit: contain; border-radius: 50%; }
          .logo-title { font-size: 22px; font-weight: 900; color: #111; }
          .logo-sub { font-size: 10px; color: #666; font-weight: bold; }
          .details { margin-bottom: 20px; font-size: 13px; line-height: 1.6; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { background: #ea580c; color: white; padding: 10px; text-align: right; font-size: 13px; }
          td { font-size: 13px; }
          .total { margin-top: 20px; text-align: left; font-size: 18px; font-weight: bold; color: #ea580c; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo-box">
            <img src="${logoUrl}" alt="NEW PHONE" class="logo-img" />
            <div>
              <div class="logo-title">NEW PHONE</div>
              <div class="logo-sub">הפלאפון החדש שלך</div>
            </div>
          </div>
          <div style="text-align: left;">
            <div style="font-size: 14px; font-weight: bold;">מספר הזמנה: #${order.id?.slice(0, 8)}</div>
            <div style="font-size: 12px; color: #666;">תאריך: ${order.created_at ? new Date(order.created_at).toLocaleString('he-IL') : ''}</div>
          </div>
        </div>

        <div class="details">
          <strong>פרטי לקוח:</strong><br>
          שם: ${order.customer_name || 'לא צוין'}<br>
          טלפון: ${order.phone || 'לא צוין'}<br>
          אימייל: ${order.email || 'לא צוין'}<br>
          כתובת למשלוח: עיר: ${order.city || ''}, רחוב: ${order.street || ''} ${order.building || ''}<br>
          ${order.notes ? `<strong>הערות הלקוח:</strong> ${order.notes}` : ''}
        </div>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>תיאור פריט</th>
              <th style="text-align: center;">כמות</th>
              <th style="text-align: left;">סכום</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div class="total">
          סה"כ לתשלום: ₪${order.total_price || 0}
        </div>

        <script>
          window.print();
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (loading) return <div className="text-center py-20 text-gray-500 font-medium">טוען הזמנות...</div>;

  return (
    <div className="space-y-6" dir="rtl">
      <div className="bg-white p-6 rounded-3xl border shadow-sm flex justify-between items-center">
        <h1 className="text-base font-black text-gray-900 border-r-4 border-orange-600 pr-3">
          ניהול הזמנות לקוחות ({orders.length})
        </h1>
        <button
          onClick={fetchOrders}
          className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
        >
          🔄 רענן רשימה
        </button>
      </div>

      <div className="space-y-4">
        {orders.length > 0 ? (
          orders.map((order) => (
            <div key={order.id} className="bg-white p-6 rounded-3xl border shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-3 gap-2">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="bg-orange-100 text-orange-800 text-[11px] font-black px-2.5 py-0.5 rounded-md">
                      הזמנה #{order.id ? order.id.slice(0, 8) : ''}
                    </span>
                    <span className="text-xs font-black text-gray-900">
                      מאת: {order.customer_name || 'ללא שם'}
                    </span>
                  </div>
                  <span className="text-[11px] text-gray-500">
                    תאריך: {order.created_at ? new Date(order.created_at).toLocaleString('he-IL') : 'לא ידוע'}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    value={order.status || 'חדש'}
                    onChange={(e) => handleStatusChange(order, e.target.value)}
                    className="bg-orange-50 border border-orange-200 text-orange-800 text-xs font-bold rounded-xl px-3 py-1.5 outline-none cursor-pointer"
                  >
                    <option value="חדש">חדש 🆕</option>
                    <option value="בטיפול">בטיפול ⏳</option>
                    <option value="מחכה למשלוח">מחכה למשלוח 📦</option>
                    <option value="מוכן לאיסוף">מוכן לאיסוף 🛍️</option>
                    <option value="נשלח">נשלח 🚚</option>
                    <option value="הושלם">הושלם ✓</option>
                  </select>

                  <button
                    onClick={() => printOrderPdf(order)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-xs"
                    title="הדפס סיכום הזמנה / PDF"
                  >
                    🖨️ הדפס PDF
                  </button>

                  <button
                    onClick={() => deleteOrder(order.id)}
                    className="text-red-500 hover:text-red-700 text-xs font-bold p-1.5 cursor-pointer"
                    title="מחק הזמנה"
                  >
                    🗑️
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-gray-700 bg-gray-50 p-4 rounded-2xl border">
                <div>
                  <span className="font-bold block mb-1 text-gray-900">פרטי התקשרות וכתובת:</span>
                  <p>📞 טלפון: <a href={`tel:${order.phone}`} className="text-blue-600 font-bold">{order.phone}</a></p>
                  <p className="mt-1">✉️ אימייל: {order.email || 'לא צוין'}</p>
                  <p className="mt-1">📍 עיר: {order.city || 'לא צוין'} | רחוב: {order.street || ''} {order.building || ''}</p>
                  {order.notes && <p className="mt-2 text-orange-700 bg-orange-50 p-2 rounded-lg border border-orange-200"><strong>הערות לקוח:</strong> {order.notes}</p>}
                </div>
                <div className="text-left sm:text-left flex flex-col justify-between">
                  <div>
                    <span className="font-bold block mb-1 text-gray-900">סיכום תשלום:</span>
                    <p className="text-xs text-gray-600">עלות משלוח: ₪{order.shipping_cost || 29}</p>
                  </div>
                  <div>
                    <span className="text-sm font-black text-orange-600 block mt-2">סה"כ לתשלום: ₪{order.total_price || 0}</span>
                  </div>
                </div>
              </div>

              {/* רשימת המוצרים בהזמנה כולל שורת משלוח */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-gray-700 block">מוצרים בהזמנה:</span>
                <div className="space-y-2">
                  {Array.isArray(order.items) && order.items.map((item: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between bg-gray-50/50 border p-3 rounded-xl text-xs">
                      <div className="flex items-center gap-3">
                        {item.image_url && <img src={item.image_url} alt="" className="w-10 h-10 object-contain bg-white rounded-lg border p-0.5" />}
                        <div>
                          <span className="font-bold text-gray-900 block">{item.name}</span>
                          {item.selectedVariant && <span className="text-[10px] text-gray-500">גרסה: {item.selectedVariant} | </span>}
                          {item.selectedColor && <span className="text-[10px] text-gray-500">צבע: {item.selectedColor.name}</span>}
                        </div>
                      </div>
                      <div className="text-left">
                        <span className="font-bold text-gray-900">כמות: {item.quantity || 1}</span>
                        <span className="text-orange-600 font-black block">₪{(item.sale_price || item.price || 0) * (item.quantity || 1)}</span>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-between bg-orange-50/50 border border-orange-200 p-3 rounded-xl text-xs">
                    <span className="font-bold text-gray-900">משלוח מהיר עד הבית</span>
                    <span className="text-orange-600 font-black">₪{order.shipping_cost || 29}</span>
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-20 bg-white rounded-3xl border p-8 space-y-3 shadow-sm">
            <span className="text-4xl">📦</span>
            <h3 className="font-black text-sm text-gray-900">אין הזמנות חדשות במערכת כרגע</h3>
            <p className="text-xs text-gray-400">ברגע שלקוח יבצע הזמנה בחנות, היא תופיע כאן מיד.</p>
          </div>
        )}
      </div>
    </div>
  );
}
