'use client';

import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

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

      const orderShortId = orderId.slice(0, 8);
      const message = `שלום ${customerName || 'לקוח יקר'},\n\nNEW PHONE שמחים לעדכן אותך שההזמנה שלך (#${orderShortId}) ${statusAction}.\n\nשמחים לתת לך שירות!\nNEW PHONE`;

      try {
        await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: customerEmail,
            subject: `עדכון סטטוס הזמנה #${orderShortId} - NEW PHONE`,
            message: message
          })
        });
      } catch (err) {
        console.error('Email send failed:', err);
      }
    }
  };

  const deleteOrder = async (orderId: string) => {
    if (!confirm('האם למחוק הזמנה זו לצמיתות?')) return;
    const { error } = await supabase.from('orders').delete().eq('id', orderId);
    if (error) {
      alert('שגיאה במחיקת הזמנה: ' + error.message);
    } else {
      setSelectedOrder(null);
      fetchOrders();
    }
  };

  // 1. הפעלת דיאלוג ההדפסה הטבעי של הדפדפן
  const handlePrint = () => {
    window.print();
  };

  // 2. הורדה ישירה של קובץ PDF
  const handleDownloadPDF = async () => {
    if (!printRef.current || !selectedOrder) return;

    // טעינה דינמית של html2pdf.js בצד הלקוח
    const html2pdf = (await import('html2pdf.js')).default;

    const element = printRef.current;
    const opt = {
      margin:       10,
      filename:     `order_${selectedOrder.id.slice(0, 8)}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save();
  };

  if (loading) return <div className="text-center py-20 text-gray-500 font-medium">טוען הזמנות...</div>;

  const logoUrl = 'https://iiaxizrezhczgutqijbe.supabase.co/storage/v1/object/public/product-images/IMG_6252.jpeg';

  return (
    <div className="space-y-6 max-w-6xl mx-auto" dir="rtl">
      
      {/* סגנונות הדפסה: הסתרת כל האלמנטים של הניהול בזמן הדפסה */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-order-card, #printable-order-card * {
            visibility: visible;
          }
          #printable-order-card {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 20px;
            margin: 0;
            background: white;
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
      <div className="bg-white rounded-3xl border shadow-sm overflow-hidden no-print">
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

      {/* מודל פרטי ההזמנה הנבחרת */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6 shadow-2xl border relative">
            
            {/* כפתורי פעולה עליונים (נסתרים בהדפסה) */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-orange-50/60 p-4 rounded-2xl border border-orange-200 no-print">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-700">סטטוס:</span>
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
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrint}
                  className="bg-orange-600 hover:bg-orange-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  🖨️ הדפס סיכום
                </button>
                <button
                  onClick={handleDownloadPDF}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  📥 הורד PDF
                </button>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  ✕ סגור
                </button>
              </div>
            </div>

            {/* כרטיס סיכום ההזמנה - מיועד להדפסה ולהורדת PDF */}
            <div id="printable-order-card" ref={printRef} className="bg-white p-6 rounded-2xl border space-y-6 text-gray-900" dir="rtl">
              
              {/* כותרת ולוגו העסק */}
              <div className="flex justify-between items-center border-b-2 border-orange-600 pb-4">
                <div className="flex items-center gap-3">
                  <img src={logoUrl} alt="NEW PHONE" className="w-12 h-12 object-contain rounded-full border p-0.5" />
                  <div>
                    <h2 className="text-xl font-black text-gray-900">NEW PHONE</h2>
                    <p className="text-xs text-orange-600 font-bold">הפלאפון החדש שלך</p>
                  </div>
                </div>
                <div className="text-left">
                  <div className="text-sm font-black text-orange-600">סיכום הזמנה</div>
                  <div className="text-xs font-bold text-gray-700">#{selectedOrder.id ? selectedOrder.id.slice(0, 8) : ''}</div>
                  <div className="text-[11px] text-gray-500">
                    {selectedOrder.created_at ? new Date(selectedOrder.created_at).toLocaleString('he-IL') : ''}
                  </div>
                </div>
              </div>

              {/* פרטי לקוח למשלוח */}
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-xs leading-relaxed space-y-1">
                <div className="font-bold text-gray-900 text-sm mb-1">פרטי לקוח למשלוח:</div>
                <p><strong>שם מלא:</strong> {selectedOrder.customer_name || 'לא צוין'}</p>
                <p><strong>טלפון:</strong> {selectedOrder.phone || 'לא צוין'}</p>
                <p><strong>אימייל:</strong> {selectedOrder.email || 'לא צוין'}</p>
                <p><strong>כתובת:</strong> עיר: {selectedOrder.city || ''}, רחוב: {selectedOrder.street || ''} {selectedOrder.building || ''}</p>
                {selectedOrder.notes && (
                  <p className="text-orange-700 mt-2 pt-2 border-t border-gray-200">
                    <strong>הערות לקוח:</strong> {selectedOrder.notes}
                  </p>
                )}
              </div>

              {/* טבלת מוצרים */}
              <div>
                <table className="w-full text-right text-xs border-collapse">
                  <thead>
                    <tr className="bg-orange-600 text-white font-bold">
                      <th className="p-2.5 text-center w-10">#</th>
                      <th className="p-2.5">תיאור פריט</th>
                      <th className="p-2.5 text-center w-16">כמות</th>
                      <th className="p-2.5 text-left w-24">סכום</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y border-b border-gray-200">
                    {Array.isArray(selectedOrder.items) && selectedOrder.items.map((item: any, idx: number) => {
                      const colorText = typeof item.selectedColor === 'object' ? item.selectedColor?.name : item.selectedColor;
                      return (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="p-2.5 text-center font-bold">{idx + 1}</td>
                          <td className="p-2.5 font-bold">
                            {item.name}
                            {item.selectedVariant && <div className="text-[10px] text-gray-500 font-normal">גרסה: {item.selectedVariant}</div>}
                            {colorText && <div className="text-[10px] text-gray-500 font-normal">צבע: {colorText}</div>}
                          </td>
                          <td className="p-2.5 text-center font-bold">{item.quantity || 1}</td>
                          <td className="p-2.5 text-left font-bold">₪{(item.sale_price || item.price || 0) * (item.quantity || 1)}</td>
                        </tr>
                      );
                    })}
                    <tr className="bg-orange-50/50 font-bold">
                      <td className="p-2.5 text-center">{(selectedOrder.items || []).length + 1}</td>
                      <td className="p-2.5">משלוח מהיר עד הבית</td>
                      <td className="p-2.5 text-center">1</td>
                      <td className="p-2.5 text-left">₪{selectedOrder.shipping_cost || 29}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* סיכום כספי */}
              <div className="text-left border-t-2 border-orange-600 pt-3">
                <span className="text-lg font-black text-orange-600">
                  סה"כ לתשלום: ₪{selectedOrder.total_price || 0}
                </span>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
