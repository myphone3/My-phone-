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
      <div className="bg-white p-6 rounded-3xl border shadow-sm flex justify-between items-center">
        <div>
          <h1 className="text-base font-black text-gray-900 border-r-4 border-orange-600 pr-3">
            ניהול לקוחות רשומים ({customers.length})
          </h1>
          <p className="text-xs text-gray-500 mt-1">רשימת לקוחות ייחודית המזוהה לפי כתובת אימייל במערכת.</p>
        </div>
        <button
          onClick={fetchCustomers}
          className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
        >
          🔄 רענן רשימה
        </button>
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
