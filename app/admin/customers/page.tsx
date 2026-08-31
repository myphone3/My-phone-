'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const { data } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
      if (data) {
        setCustomers(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h2 className="text-2xl font-black text-gray-900">לקוחות והודעות 👥</h2>
        <p className="text-gray-500 text-sm mt-1">רשימת הלקוחות וההזמנות במערכת.</p>
      </div>

      <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-gray-50/50">
          <span className="text-xs font-bold text-gray-500">הזמנות ולקוחות ({customers.length})</span>
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-500">טוען נתונים...</div>
        ) : customers.length === 0 ? (
          <div className="text-center py-20 text-gray-400 space-y-2">
            <span className="text-4xl">👥</span>
            <p className="text-sm font-medium">אין לקוחות או הזמנות במערכת כרגע.</p>
          </div>
        ) : (
          <div className="divide-y">
            {customers.map((order, idx) => (
              <div key={order.id || idx} className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-gray-50/50 transition">
                <div className="space-y-1">
                  <h4 className="font-black text-sm text-gray-900">{order.customer_name || order.name || 'לקוח ללא שם'}</h4>
                  <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                    {order.phone && <span>📞 {order.phone}</span>}
                    {order.email && <span>✉️ {order.email}</span>}
                    {order.address && <span>📍 {order.address}</span>}
                  </div>
                </div>
                <div className="text-xs font-bold bg-gray-100 px-3 py-1.5 rounded-xl">
                  ₪{order.total_price || order.price || 0}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
