'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    setLoading(true);
    // שליפת משתמשים רשומים או לקוחות שהשאירו אימייל בהזמנות (מסונן ללא כפילויות)
    const { data, error } = await supabase.from('orders').select('customer_name, email, phone, created_at');
    
    if (data) {
      // סינון כפילויות לפי אימייל
      const uniqueMap = new Map();
      data.forEach((item: any) => {
        if (item.email && !uniqueMap.has(item.email)) {
          uniqueMap.set(item.email, item);
        }
      });
      setCustomers(Array.from(uniqueMap.values()));
    }
    setLoading(false);
  };

  if (loading) return <div className="text-center py-20 text-gray-500 font-medium">טוען לקוחות רשומים...</div>;

  return (
    <div className="space-y-6" dir="rtl">
      {/* כותרת נקייה בדיוק כמו בניהול קטגוריות */}
      <div className="flex items-center justify-between my-2">
        <h1 className="text-xl font-black text-gray-900 border-r-4 border-orange-600 pr-3 flex items-center gap-2">
          <span>👥</span>
          <span>ניהול לקוחות רשומים</span>
          <span className="text-sm font-normal text-gray-500">({customers.length})</span>
        </h1>
      </div>

      <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-gray-50 border-b text-gray-700 font-bold">
              <tr>
                <th className="p-4">#</th>
                <th className="p-4">שם הלקוח</th>
                <th className="p-4">אימייל</th>
                <th className="p-4">טלפון</th>
                <th className="p-4">תאריך הצטרפות / הזמנה ראשונה</th>
              </tr>
            </thead>
            <tbody className="divide-y text-gray-800">
              {customers.length > 0 ? (
                customers.map((cust, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 transition">
                    <td className="p-4 font-bold text-gray-500">{idx + 1}</td>
                    <td className="p-4 font-black text-gray-900">{cust.customer_name || 'לא צוין'}</td>
                    <td className="p-4 text-blue-600 font-bold">{cust.email}</td>
                    <td className="p-4">{cust.phone || 'לא צוין'}</td>
                    <td className="p-4 text-gray-500">
                      {cust.created_at ? new Date(cust.created_at).toLocaleDateString('he-IL') : 'לא ידוע'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-gray-400">
                    אין עדיין לקוחות רשומים במערכת.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
