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

  // הפעלה ישירה של הדיאלוג מהמכשיר באותו עמוד (עובד 100% באייפון ובכל דפדפן)
  const handlePrint = () => {
    window.print();
  };

  if (loading) return <div className="text-center py-20 text-gray-500 font-medium">טוען הזמנות...</div>;

  const logoUrl = 'https://iiaxizrezhczgutqijbe.supabase.co/storage/v1/object/public/product-images/IMG_6252.jpeg';

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-2 sm:p-4" dir="rtl">
      
      {/* הגדרות מדויקות להדפסה - מסתיר את פאנל הניהול והכפתורים ומדפיס רק את טופס ההזמנה */}
      <style jsx global>{`
        @media print {
          /* הסתרת כל הדף */
          body * {
            visibility: hidden !important;
          }
          /* הצגת אזור ההדפסה בלבד */
          #print-area, #print-area * {
            visibility: visible !important;
          }
          #print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 10px !important;
            background: white !important;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* כותרת העמוד */}
      <div className="flex items-center justify-between my-2 no-print">
        <h1 className="text-xl font-black text-gray-900 border-r-4 border-orange-600 pr-3 flex items-center gap-2">
          <span>📋</span>
          <span>ניהול הזמנות</span>
          <span className="text-sm font-normal text-gray-500">({orders.length})</span>
        </h1>
      </div>

      {/* טבלת ההזמנות */}
      <div className="bg-white rounded-3xl border shadow-xs overflow-hidden no-print">
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

      {/* מודל סיכום הזמנה נבחרת */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-5 space-y-4 shadow-2xl border relative my-auto">
            
            {/* סרגל עליון - כפתור סגירה והדפסה בלבד */}
            <div className="flex items-center justify-between border-b pb-3 sticky top-0 bg-white z-10 no-print">
              <button
                onClick={() => setSelectedOrder(null)}
                className="w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center font-bold text-gray-600 cursor-pointer text-sm"
              >
                ✕
              </button>

              <button
                onClick={handlePrint}
                className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <span>🖨️</span>
                <span>הדפס / שמור כ-PDF</span>
              </button>
            </div>

            {/* פרטי מזהה וסטטוס במערכת */}
            <div className="bg-orange-50/60 p-3.5 rounded-2xl border border-orange-200 flex items-center justify-between no-print">
              <div>
                <span className="bg-orange-100 text-orange-800 text-[11px] font-black px-2 py-0.5 rounded-md">
                  סיכום הזמנה #{selectedOrder.id ? selectedOrder.id.slice(0, 8) : ''}
                </span>
                <div className="text-[11px] text-gray-500 mt-1">
                  תאריך: {selectedOrder.created_at ? new Date(selectedOrder.created_at).toLocaleString('he-IL') : 'לא ידוע'}
                </div>
              </div>

              <select
                value={selectedOrder.status || 'חדש'}
                onChange={(e) => handleStatusChange(selectedOrder.id, e.target.value, selectedOrder.email, selectedOrder.customer_name)}
                className="bg-white border border-orange-300 text-orange-800 text-xs font-bold rounded-xl px-2.5 py-1.5 outline-none cursor-pointer shadow-xs"
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

            {/* אזור המסמך הנקי שמיועד להדפסה ולשמירה כ-PDF */}
            <div id="print-area" className="space-y-4 bg-white p-2">
              
              {/* כותרת ולוגו עבור ההדפסה */}
              <div className="flex justify-between items-center border-b-2 border-orange-600 pb-3">
                <div className="flex items-center gap-2.5">
                  <img src={logoUrl} alt="NEW PHONE" className="w-11 h-11 object-contain rounded-full border p-0.5" />
                  <div>
                    <h2 className="text-lg font-black text-gray-900 leading-none">NEW PHONE</h2>
                    <p className="text-[10px] text-orange-600 font-bold mt-0.5">הפלאפון החדש שלך</p>
                  </div>
                </div>
                <div className="text-left">
                  <div className="text-xs font-black text-orange-600">סיכום הזמנה</div>
                  <div className="text-xs font-bold text-gray-800">#{selectedOrder.id ? selectedOrder.id.slice(0, 8) : ''}</div>
                  <div className="text-[10px] text-gray-500">
                    {selectedOrder.created_at ? new Date(selectedOrder.created_at).toLocaleString('he-IL') : ''}
                  </div>
                </div>
              </div>

              {/* פרטי הלקוח והכתובת */}
              <div className="text-xs text-gray-800 bg-gray-50 p-3.5 rounded-2xl border border-gray-200 space-y-1">
                <span className="font-bold block text-gray-900 mb-1">פרטי לקוח למשלוח:</span>
                <p>👤 <strong>שם:</strong> {selectedOrder.customer_name || 'לא צוין'}</p>
                <p>📞 <strong>טלפון:</strong> {selectedOrder.phone || 'לא צוין'}</p>
                <p>✉️ <strong>אימייל:</strong> {selectedOrder.email || 'לא צוין'}</p>
                <p>📍 <strong>כתובת:</strong> עיר: {selectedOrder.city || ''}, רחוב: {selectedOrder.street || ''} {selectedOrder.building || ''}</p>
                {selectedOrder.notes && (
                  <p className="mt-2 text-orange-700 bg-orange-50 p-2 rounded-lg border border-orange-200">
                    <strong>הערות לקוח:</strong> {selectedOrder.notes}
                  </p>
                )}
              </div>

              {/* טבלת מוצרים בהדפסה */}
              <div>
                <table className="w-full text-right text-xs border-collapse">
                  <thead>
                    <tr className="bg-orange-600 text-white font-bold">
                      <th className="p-2 text-center w-8">#</th>
                      <th className="p-2">תיאור פריט</th>
                      <th className="p-2 text-center w-12">כמות</th>
                      <th className="p-2 text-left w-20">סכום</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y border-b border-gray-200">
                    {Array.isArray(selectedOrder.items) && selectedOrder.items.map((item: any, idx: number) => {
                      const colorText = getColorName(item.selectedColor);
                      return (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="p-2 text-center font-bold">{idx + 1}</td>
                          <td className="p-2 font-bold">
                            {item.name}
                            {item.selectedVariant && <div className="text-[10px] text-gray-500 font-normal">גרסה: {item.selectedVariant}</div>}
                            {colorText && <div className="text-[10px] text-gray-500 font-normal">צבע: {colorText}</div>}
                          </td>
                          <td className="p-2 text-center font-bold">{item.quantity || 1}</td>
                          <td className="p-2 text-left font-bold">₪{(item.sale_price || item.price || 0) * (item.quantity || 1)}</td>
                        </tr>
                      );
                    })}
                    <tr className="bg-orange-50/50 font-bold">
                      <td className="p-2 text-center">{(selectedOrder.items || []).length + 1}</td>
                      <td className="p-2">משלוח מהיר עד הבית</td>
                      <td className="p-2 text-center">1</td>
                      <td className="p-2 text-left">₪{selectedOrder.shipping_cost || 29}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* סה"כ לתשלום */}
              <div className="text-left border-t-2 border-orange-600 pt-2 font-black text-orange-600 text-base">
                סה"כ לתשלום: ₪{selectedOrder.total_price || 0}
              </div>

            </div>

          </div>
        </div>
      )}
    </div>
  );
}
