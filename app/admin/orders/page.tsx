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

    if (!error && data) setOrders(data);
    setLoading(false);
  };

  const handleStatusChange = async (orderId: string, newStatus: string, customerEmail?: string, customerName?: string) => {
    const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
    if (error) return alert('שגיאה בעדכון סטטוס: ' + error.message);

    fetchOrders();
    setSelectedOrder((prev: any) => prev && prev.id === orderId ? { ...prev, status: newStatus } : prev);

    if (customerEmail) {
      const orderShortId = orderId.slice(0, 8);
      try {
        await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: customerEmail,
            subject: `עדכון סטטוס הזמנה #${orderShortId}`,
            message: `שלום ${customerName || 'לקוח יקר'},\n\nההזמנה שלך (#${orderShortId}) עודכנה לסטטוס: ${newStatus}.\n\nNEW PHONE`
          })
        });
      } catch (err) {}
    }
  };

  const getColorName = (colorVal: any) => {
    if (!colorVal) return '';
    if (typeof colorVal === 'string') return colorVal;
    return colorVal.name || '';
  };

  if (loading) return <div className="text-center py-20 text-gray-500 font-medium">טוען הזמנות...</div>;

  const logoUrl = 'https://iiaxizrezhczgutqijbe.supabase.co/storage/v1/object/public/product-images/IMG_6252.jpeg';

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-2 sm:p-4" dir="rtl">
      
      {/* סגנון הדפסה: מדפיס רק את סיכום ההזמנה הרשמי */}
      <style jsx global>{`
        @media print {
          body * { visibility: hidden !important; }
          #print-slip, #print-slip * { visibility: visible !important; }
          #print-slip { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; margin: 0 !important; padding: 20px !important; background: white !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* כותרת */}
      <div className="flex items-center justify-between my-2 no-print">
        <h1 className="text-xl font-black text-gray-900 border-r-4 border-orange-600 pr-3 flex items-center gap-2">
          <span>📋</span>
          <span>ניהול הזמנות</span>
          <span className="text-sm font-normal text-gray-500">({orders.length})</span>
        </h1>
      </div>

      {/* טבלת ההזמנות */}
      <div className="bg-white rounded-3xl border overflow-hidden no-print">
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
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-orange-50/40 transition cursor-pointer" onClick={() => setSelectedOrder(order)}>
                  <td className="p-4 font-black text-orange-800">#{order.id?.slice(0, 8)}</td>
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
                    <button onClick={() => setSelectedOrder(order)} className="bg-orange-600 text-white px-3 py-1.5 rounded-xl text-xs font-bold">
                      👁️ צפה בפרטים
                    </button>
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
            <div className="flex items-center justify-between border-b pb-3 sticky top-0 bg-white z-10 no-print">
              <button onClick={() => setSelectedOrder(null)} className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center font-bold text-gray-600 text-sm">
                ✕
              </button>

              {/* כפתור הדפסה/PDF ישיר */}
              <button
                onClick={() => window.print()}
                className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer shadow-md"
              >
                <span>🖨️</span>
                <span>הדפס / שמור כ-PDF</span>
              </button>
            </div>

            {/* פרטי הזמנה לצפייה בניהול */}
            <div className="space-y-4 no-print text-xs text-gray-800">
              <div className="bg-orange-50/70 p-4 rounded-2xl border border-orange-200 flex items-center justify-between">
                <div>
                  <span className="bg-orange-100 text-orange-800 text-xs font-black px-2.5 py-1 rounded-md">
                    הזמנה #{selectedOrder.id?.slice(0, 8)}
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
                    className="bg-white border border-orange-300 text-orange-800 text-xs font-bold rounded-xl px-3 py-1.5 outline-none cursor-pointer"
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
                <p><strong>טלפון:</strong> <a href={`tel:${selectedOrder.phone}`} className="text-blue-600 font-bold underline">{selectedOrder.phone || 'לא צוין'}</a></p>
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

            {/* תעודת המשלוח הרשמית למדפסת/PDF */}
            <div id="print-slip" className="hidden print:block space-y-5 bg-white p-2" dir="rtl">
              <div className="flex justify-between items-center border-b-2 border-orange-600 pb-4">
                <div className="flex items-center gap-3">
                  <img src={logoUrl} alt="NEW PHONE" className="w-14 h-14 object-contain rounded-full border p-0.5" />
                  <div>
                    <h2 className="text-2xl font-black text-gray-900 leading-none">NEW PHONE</h2>
                    <p className="text-xs text-orange-600 font-bold mt-1">הפלאפון החדש שלך</p>
                  </div>
                </div>
                <div className="text-left">
                  <div className="text-base font-black text-orange-600">סיכום הזמנה</div>
                  <div className="text-xs font-bold text-gray-800">#{selectedOrder.id?.slice(0, 8)}</div>
                  <div className="text-[10px] text-gray-500">{selectedOrder.created_at ? new Date(selectedOrder.created_at).toLocaleString('he-IL') : ''}</div>
                </div>
              </div>

              <div className="text-xs text-gray-800 bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-1.5">
                <span className="font-bold block text-gray-900 mb-1 text-sm">פרטי לקוח למשלוח:</span>
                <p>👤 <strong>שם מלא:</strong> {selectedOrder.customer_name || 'לא צוין'}</p>
                <p>📞 <strong>טלפון:</strong> {selectedOrder.phone || 'לא צוין'}</p>
                <p>✉️ <strong>אימייל:</strong> {selectedOrder.email || 'לא צוין'}</p>
                <p>📍 <strong>כתובת למשלוח:</strong> עיר: {selectedOrder.city || ''}, רחוב: {selectedOrder.street || ''} {selectedOrder.building || ''}</p>
                {selectedOrder.notes && <p className="mt-2 text-orange-700 bg-orange-50 p-2.5 rounded-xl border border-orange-200"><strong>הערות למשלוח:</strong> {selectedOrder.notes}</p>}
              </div>

              <div>
                <table className="w-full text-right text-xs border-collapse">
                  <thead>
                    <tr className="bg-orange-600 text-white font-bold">
                      <th className="p-2.5 text-center w-8">#</th>
                      <th className="p-2.5">תיאור מוצר / פריט</th>
                      <th className="p-2.5 text-center w-12">כמות</th>
                      <th className="p-2.5 text-left w-20">מחיר</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y border-b border-gray-200">
                    {Array.isArray(selectedOrder.items) && selectedOrder.items.map((item: any, idx: number) => (
                      <tr key={idx}>
                        <td className="p-2.5 text-center font-bold">{idx + 1}</td>
                        <td className="p-2.5 font-bold">
                          {item.name}
                          {item.selectedVariant && <div className="text-[10px] text-gray-500 font-normal">גרסה: {item.selectedVariant}</div>}
                          {getColorName(item.selectedColor) && <div className="text-[10px] text-gray-500 font-normal">צבע: {getColorName(item.selectedColor)}</div>}
                        </td>
                        <td className="p-2.5 text-center font-bold">{item.quantity || 1}</td>
                        <td className="p-2.5 text-left font-bold">₪{(item.sale_price || item.price || 0) * (item.quantity || 1)}</td>
                      </tr>
                    ))}
                    <tr className="bg-orange-50/50 font-bold">
                      <td className="p-2.5 text-center">{(selectedOrder.items || []).length + 1}</td>
                      <td className="p-2.5">משלוח מהיר עד הבית</td>
                      <td className="p-2.5 text-center">1</td>
                      <td className="p-2.5 text-left">₪{selectedOrder.shipping_cost || 29}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="text-left border-t-2 border-orange-600 pt-3 font-black text-orange-600 text-lg">
                סה"כ לתשלום: ₪{selectedOrder.total_price || 0}
              </div>

              <div className="text-center text-xs text-gray-500 pt-6 border-t border-dashed border-gray-200">
                תודה שקנית ב-NEW PHONE! נשמח לראותך שוב ❤️
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
