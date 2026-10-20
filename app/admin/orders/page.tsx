'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);

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

  // יצירה והורדה ישירה של קובץ PDF ללא פתיחת חלונות נוספים
  const handleDownloadPDF = async () => {
    if (!selectedOrder) return;
    setGeneratingPdf(true);

    try {
      // טעינת html2pdf.js דינמית אם היא עדיין לא טעונה
      if (!(window as any).html2pdf) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
          script.onload = resolve;
          script.onerror = reject;
          document.body.appendChild(script);
        });
      }

      const element = document.getElementById('pdf-template');
      if (!element) {
        alert('שגיאה באיתור תבנית ההדפסה');
        setGeneratingPdf(false);
        return;
      }

      const shortId = selectedOrder.id ? selectedOrder.id.slice(0, 8) : 'order';
      const opt = {
        margin:       0.4,
        filename:     `Order_Summary_${shortId}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, logging: false },
        jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
      };

      // מציגים רגע את התבנית הנסתרת, ממירים ל-PDF ומחזירים למצב נסתר
      element.style.display = 'block';
      await (window as any).html2pdf().set(opt).from(element).save();
      element.style.display = 'none';

    } catch (error) {
      console.error('PDF generation error:', error);
      alert('אירעה שגיאה ביצירת הקובץ. מפעיל דיאלוג חלופי...');
      window.print();
    } finally {
      setGeneratingPdf(false);
    }
  };

  if (loading) return <div className="text-center py-20 text-gray-500 font-medium">טוען הזמנות...</div>;

  const logoUrl = 'https://iiaxizrezhczgutqijbe.supabase.co/storage/v1/object/public/product-images/IMG_6252.jpeg';

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-2 sm:p-4" dir="rtl">
      
      {/* סגנון להסתרה בעת הדפסה קלאסית */}
      <style jsx global>{`
        @media print {
          body * { visibility: hidden !important; }
          #pdf-template, #pdf-template * { visibility: visible !important; }
          #pdf-template {
            display: block !important;
            position: absolute !important;
            left: 0 !important; top: 0 !important;
            width: 100% !important;
          }
        }
      `}</style>

      {/* כותרת העמוד */}
      <div className="flex items-center justify-between my-2">
        <h1 className="text-xl font-black text-gray-900 border-r-4 border-orange-600 pr-3 flex items-center gap-2">
          <span>📋</span>
          <span>ניהול הזמנות</span>
          <span className="text-sm font-normal text-gray-500">({orders.length})</span>
        </h1>
      </div>

      {/* טבלת ההזמנות */}
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

      {/* מודל פרטי ההזמנה - מסודר ונקי */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-5 space-y-4 shadow-2xl border relative my-auto">
            
            {/* סרגל עליון: כפתור סגירה X + כפתור יצירת PDF */}
            <div className="flex items-center justify-between border-b pb-3 sticky top-0 bg-white z-10">
              <button
                onClick={() => setSelectedOrder(null)}
                className="w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center font-bold text-gray-600 cursor-pointer text-sm transition"
              >
                ✕
              </button>

              <button
                onClick={handleDownloadPDF}
                disabled={generatingPdf}
                className="bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <span>📄</span>
                <span>{generatingPdf ? 'מייצר קובץ PDF...' : 'הורד קובץ PDF'}</span>
              </button>
            </div>

            {/* כרטיס סטטוס ומזהה */}
            <div className="bg-orange-50/70 p-3.5 rounded-2xl border border-orange-200 flex items-center justify-between">
              <div>
                <span className="bg-orange-100 text-orange-800 text-[11px] font-black px-2 py-0.5 rounded-md">
                  הזמנה #{selectedOrder.id ? selectedOrder.id.slice(0, 8) : ''}
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

            {/* כרטיס פרטי הלקוח */}
            <div className="text-xs text-gray-700 bg-gray-50 p-4 rounded-2xl border space-y-1.5">
              <span className="font-bold block text-gray-900 border-b pb-1 mb-1">👤 פרטי לקוח וכתובת למשלוח:</span>
              <p><strong>שם מלא:</strong> {selectedOrder.customer_name || 'לא צוין'}</p>
              <p><strong>טלפון:</strong> <a href={`tel:${selectedOrder.phone}`} className="text-blue-600 font-bold underline">{selectedOrder.phone || 'לא צוין'}</a></p>
              <p><strong>אימייל:</strong> {selectedOrder.email || 'לא צוין'}</p>
              <p><strong>כתובת:</strong> עיר: {selectedOrder.city || ''}, רחוב: {selectedOrder.street || ''} {selectedOrder.building || ''}</p>
              {selectedOrder.notes && (
                <p className="mt-2 text-orange-700 bg-orange-50 p-2 rounded-xl border border-orange-200">
                  <strong>הערות לקוח:</strong> {selectedOrder.notes}
                </p>
              )}
            </div>

            {/* כרטיס סיכום תשלום */}
            <div className="bg-gray-50 p-3.5 rounded-2xl border text-xs flex justify-between items-center">
              <div>
                <span className="font-bold text-gray-900 block">סיכום תשלום:</span>
                <span className="text-gray-500">עלות משלוח: ₪{selectedOrder.shipping_cost || 29}</span>
              </div>
              <span className="text-base font-black text-orange-600">₪{selectedOrder.total_price || 0}</span>
            </div>

            {/* כרטיס מוצרים בהזמנה */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-gray-700 block">📦 מוצרים בהזמנה:</span>
              <div className="space-y-2 max-h-48 overflow-y-auto pl-1">
                {Array.isArray(selectedOrder.items) && selectedOrder.items.map((item: any, idx: number) => {
                  const colorText = getColorName(item.selectedColor);
                  return (
                    <div key={idx} className="flex items-center justify-between bg-gray-50/50 border p-3 rounded-xl text-xs">
                      <div className="flex items-center gap-3">
                        {item.image_url && <img src={item.image_url} alt="" className="w-10 h-10 object-contain bg-white rounded-lg border p-0.5" />}
                        <div>
                          <span className="font-bold text-gray-900 block">{item.name}</span>
                          {item.selectedVariant && <span className="text-[10px] text-gray-500">גרסה: {item.selectedVariant} | </span>}
                          {colorText && <span className="text-[10px] text-gray-500">צבע: {colorText}</span>}
                        </div>
                      </div>
                      <div className="text-left">
                        <span className="font-bold text-gray-900">כמות: {item.quantity || 1}</span>
                        <span className="text-orange-600 font-black block">₪{(item.sale_price || item.price || 0) * (item.quantity || 1)}</span>
                      </div>
                    </div>
                  );
                })}
                <div className="flex items-center justify-between bg-orange-50/50 border border-orange-200 p-3 rounded-xl text-xs">
                  <span className="font-bold text-gray-900">משלוח מהיר עד הבית</span>
                  <span className="text-orange-600 font-black">₪{selectedOrder.shipping_cost || 29}</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* תבנית נסתרת לייצור ה-PDF בלבד (נבנית ברקע ומורדת כקובץ) */}
      {selectedOrder && (
        <div id="pdf-template" style={{ display: 'none', width: '650px', padding: '24px', backgroundColor: '#ffffff', color: '#111827', fontFamily: 'system-ui, sans-serif', direction: 'rtl' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #ea580c', paddingBottom: '16px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', itemsAlign: 'center', gap: '12px' }}>
              <img src={logoUrl} alt="NEW PHONE" style={{ width: '55px', height: '55px', objectFit: 'contain', borderRadius: '50%' }} />
              <div>
                <div style={{ fontSize: '22px', fontWeight: '900', color: '#111827' }}>NEW PHONE</div>
                <div style={{ fontSize: '11px', color: '#ea580c', fontWeight: 'bold' }}>הפלאפון החדש שלך</div>
              </div>
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '15px', fontWeight: '900', color: '#ea580c' }}>סיכום הזמנה</div>
              <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#374151' }}>#{selectedOrder.id?.slice(0, 8)}</div>
              <div style={{ fontSize: '10px', color: '#6b7280' }}>{selectedOrder.created_at ? new Date(selectedOrder.created_at).toLocaleString('he-IL') : ''}</div>
            </div>
          </div>

          <div style={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px', fontSize: '13px', lineHeight: '1.6', marginBottom: '20px' }}>
            <strong>פרטי לקוח למשלוח:</strong><br />
            שם מלא: <strong>{selectedOrder.customer_name || 'לא צוין'}</strong><br />
            טלפון: {selectedOrder.phone || 'לא צוין'}<br />
            אימייל: {selectedOrder.email || 'לא צוין'}<br />
            כתובת למשלוח: עיר: {selectedOrder.city || ''}, רחוב: {selectedOrder.street || ''} {selectedOrder.building || ''}<br />
            {selectedOrder.notes && <div style={{ marginTop: '6px', color: '#c2410c' }}><strong>הערות למשלוח:</strong> {selectedOrder.notes}</div>}
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', marginTop: '10px' }}>
            <thead>
              <tr style={{ backgroundColor: '#ea580c', color: '#ffffff' }}>
                <th style={{ padding: '10px', textAlign: 'center', width: '30px' }}>#</th>
                <th style={{ padding: '10px', textAlign: 'right' }}>תיאור מוצר / פריט</th>
                <th style={{ padding: '10px', textAlign: 'center', width: '50px' }}>כמות</th>
                <th style={{ padding: '10px', textAlign: 'left', width: '80px' }}>מחיר</th>
              </tr>
            </thead>
            <tbody>
              {Array.isArray(selectedOrder.items) && selectedOrder.items.map((item: any, idx: number) => {
                const colorText = getColorName(item.selectedColor);
                return (
                  <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '10px', textAlign: 'center', fontWeight: 'bold' }}>{idx + 1}</td>
                    <td style={{ padding: '10px', fontWeight: 'bold' }}>
                      {item.name}
                      {item.selectedVariant && <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>גרסה: {item.selectedVariant}</div>}
                      {colorText && <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>צבע: {colorText}</div>}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'center', fontWeight: 'bold' }}>{item.quantity || 1}</td>
                    <td style={{ padding: '10px', textAlign: 'left', fontWeight: 'bold' }}>₪{(item.sale_price || item.price || 0) * (item.quantity || 1)}</td>
                  </tr>
                );
              })}
              <tr style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: '#fff7ed' }}>
                <td style={{ padding: '10px', textAlign: 'center', fontWeight: 'bold' }}>{(selectedOrder.items || []).length + 1}</td>
                <td style={{ padding: '10px', fontWeight: 'bold' }}>משלוח מהיר עד הבית</td>
                <td style={{ padding: '10px', textAlign: 'center', fontWeight: 'bold' }}>1</td>
                <td style={{ padding: '10px', textAlign: 'left', fontWeight: 'bold' }}>₪{selectedOrder.shipping_cost || 29}</td>
              </tr>
            </tbody>
          </table>

          <div style={{ marginTop: '20px', textAlign: 'left', fontSize: '18px', fontWeight: '900', color: '#ea580c', borderTop: '2px solid #e5e7eb', paddingTop: '14px' }}>
            סה"כ לתשלום: ₪{selectedOrder.total_price || 0}
          </div>

          <div style={{ marginTop: '30px', textAlign: 'center', fontSize: '12px', color: '#6b7280', borderTop: '1px dashed #e5e7eb', paddingTop: '12px' }}>
            תודה שקנית ב-NEW PHONE! נשמח לראותך שוב ❤️
          </div>
        </div>
      )}

    </div>
  );
}
