'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);

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

  // הפעלת מנגנון ההדפסה הישיר
  const triggerNativePrint = () => {
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 150);
  };

  if (loading) return <div className="text-center py-20 text-gray-500 font-medium">טוען הזמנות...</div>;

  return (
    <div className="space-y-6 max-w-6xl mx-auto" dir="rtl">
      {/* הגדרות CSS ייעודיות להדפסה בלבד */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #print-document, #print-document * {
            visibility: visible !important;
          }
          #print-document {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: 100% !important;
            margin: 0 !important;
            padding: 20px !important;
            background: white !important;
            z-index: 99999 !important;
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 no-print">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6 shadow-2xl border relative">
            
            <div className="flex justify-between items-center border-b pb-4">
              <div>
                <span className="bg-orange-100 text-orange-800 text-xs font-black px-2.5 py-1 rounded-md">
                  סיכום הזמנה #{selectedOrder.id ? selectedOrder.id.slice(0, 8) : ''}
                </span>
                <h2 className="text-lg font-black text-gray-900 mt-1">
                  NEW PHONE - הפלאפון החדש שלך
                </h2>
                <div className="text-xs text-gray-500 mt-0.5">
                  תאריך: {selectedOrder.created_at ? new Date(selectedOrder.created_at).toLocaleString('he-IL') : 'לא ידוע'}
                </div>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="w-9 h-9 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center font-bold text-gray-600 cursor-pointer transition"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 bg-orange-50/60 p-4 rounded-2xl border border-orange-200">
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
                  onClick={triggerNativePrint}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  🖨️ הדפס סיכום הזמנה
                </button>
                <button
                  onClick={() => deleteOrder(selectedOrder.id)}
                  className="bg-red-50 hover:bg-red-100 text-red-600 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer border border-red-200"
                >
                  🗑️ מחק
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-gray-700 bg-gray-50 p-4 rounded-2xl border">
              <div>
                <span className="font-bold block mb-1 text-gray-900">פרטי התקשרות וכתובת:</span>
                <p>📞 טלפון: <a href={`tel:${selectedOrder.phone}`} className="text-blue-600 font-bold">{selectedOrder.phone}</a></p>
                <p className="mt-1">✉️ אימייל: {selectedOrder.email || 'לא צוין'}</p>
                <p className="mt-1">📍 עיר: {selectedOrder.city || 'לא צוין'} | רחוב: {selectedOrder.street || ''} {selectedOrder.building || ''}</p>
                {selectedOrder.notes && (
                  <p className="mt-2 text-orange-700 bg-orange-50 p-2 rounded-lg border border-orange-200">
                    <strong>הערות לקוח:</strong> {selectedOrder.notes}
                  </p>
                )}
              </div>
              <div className="flex flex-col justify-between text-left sm:text-left">
                <div>
                  <span className="font-bold block mb-1 text-gray-900">סיכום תשלום:</span>
                  <p className="text-xs text-gray-600">עלות משלוח: ₪{selectedOrder.shipping_cost || 29}</p>
                </div>
                <div>
                  <span className="text-sm font-black text-orange-600 block mt-2">סה"כ לתשלום: ₪{selectedOrder.total_price || 0}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold text-gray-700 block">מוצרים בהזמנה:</span>
              <div className="space-y-2 max-h-48 overflow-y-auto pl-1">
                {Array.isArray(selectedOrder.items) && selectedOrder.items.map((item: any, idx: number) => (
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
                  <span className="text-orange-600 font-black">₪{selectedOrder.shipping_cost || 29}</span>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t text-center">
              <button
                onClick={() => setSelectedOrder(null)}
                className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold px-6 py-2.5 rounded-xl text-xs transition cursor-pointer"
              >
                סגור חלון
              </button>
            </div>

          </div>
        </div>
      )}

      {/* מסמך ההדפסה הייעודי המוסתר שנפתח ונשלח מיד להדפסה ישירה בלחיצה */}
      {selectedOrder && (
        <div id="print-document" className="hidden print:block text-right dir-rtl">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #ea580c', paddingBottom: '12px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <img src="https://iiaxizrezhczgutqijbe.supabase.co/storage/v1/object/public/product-images/IMG_6252.jpeg" alt="NEW PHONE" style={{ width: '50px', height: '50px', borderRadius: '50%', objectFit: 'contain' }} />
              <div>
                <div style={{ fontSize: '20px', fontWeight: 900, color: '#111' }}>NEW PHONE</div>
                <div style={{ fontSize: '10px', color: '#ea580c', fontWeight: 'bold' }}>הפלאפון החדש שלך</div>
              </div>
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '14px', fontWeight: 'bold' }}>הזמנה #{selectedOrder.id?.slice(0, 8)}</div>
              <div style={{ fontSize: '11px', color: '#666' }}>{selectedOrder.created_at ? new Date(selectedOrder.created_at).toLocaleString('he-IL') : ''}</div>
            </div>
          </div>

          <div style={{ background: '#f9fafb', padding: '15px', borderRadius: '12px', border: '1px solid #e5e7eb', marginBottom: '20px', fontSize: '13px', lineHeight: '1.6' }}>
            <strong>פרטי לקוח למשלוח:</strong><br />
            שם: {selectedOrder.customer_name || 'לא צוין'}<br />
            טלפון: {selectedOrder.phone || 'לא צוין'}<br />
            אימייל: {selectedOrder.email || 'לא צוין'}<br />
            כתובת: עיר: {selectedOrder.city || ''}, רחוב: {selectedOrder.street || ''} {selectedOrder.building || ''}<br />
            {selectedOrder.notes && <div><strong>הערות לקוח:</strong> {selectedOrder.notes}</div>}
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', marginTop: '10px' }}>
            <thead>
              <tr style={{ background: '#ea580c', color: 'white', textBottom: 'bold' }}>
                <th style={{ padding: '10px', textAlign: 'right' }}>#</th>
                <th style={{ padding: '10px', textAlign: 'right' }}>תיאור פריט</th>
                <th style={{ padding: '10px', textAlign: 'center' }}>כמות</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>סכום</th>
              </tr>
            </thead>
            <tbody>
              {Array.isArray(selectedOrder.items) && selectedOrder.items.map((item: any, idx: number) => (
                <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '10px' }}>{idx + 1}</td>
                  <td style={{ padding: '10px' }}><b>{item.name}</b> {item.selectedVariant ? `(${item.selectedVariant})` : ''} {item.selectedColor ? `- ${item.selectedColor.name}` : ''}</td>
                  <td style={{ padding: '10px', textAlign: 'center' }}>{item.quantity || 1}</td>
                  <td style={{ padding: '10px', textAlign: 'left' }}>₪{(item.sale_price || item.price || 0) * (item.quantity || 1)}</td>
                </tr>
              ))}
              <tr style={{ background: '#fff7ed', borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '10px' }}>{(selectedOrder.items || []).length + 1}</td>
                <td style={{ padding: '10px' }}><b>משלוח מהיר עד הבית</b></td>
                <td style={{ padding: '10px', textAlign: 'center' }}>1</td>
                <td style={{ padding: '10px', textAlign: 'left' }}>₪{selectedOrder.shipping_cost || 29}</td>
              </tr>
            </tbody>
          </table>

          <div style={{ marginTop: '20px', textAlign: 'left', fontSize: '18px', fontWeight: 'bold', color: '#ea580c', borderTop: '1px solid #eee', paddingTop: '12px' }}>
            סה"כ לתשלום: ₪{selectedOrder.total_price || 0}
          </div>
        </div>
      )}
    </div>
  );
}
