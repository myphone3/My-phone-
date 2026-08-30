'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import Link from 'next/link';

const STATUS_OPTIONS = [
  { value: 'בטיפול', label: 'בטיפול 🛠️', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'מחכה למשלוח', label: 'מחכה למשלוח ⏳', color: 'bg-orange-100 text-orange-800' },
  { value: 'נשלח', label: 'נשלח 🚚', color: 'bg-blue-100 text-blue-800' },
  { value: 'מוכן לאיסוף', label: 'מוכן לאיסוף 📦', color: 'bg-purple-100 text-purple-800' },
  { value: 'הושלם', label: 'הושלם ✅', color: 'bg-green-100 text-green-800' },
];

function getStatusStyle(status: string) {
  return STATUS_OPTIONS.find((s) => s.value === status)?.color || 'bg-gray-100 text-gray-700';
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('הכל');
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
      console.error('Error fetching orders:', error);
    } else if (data) {
      setOrders(data);
    }
    setLoading(false);
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', id);

    if (error) {
      alert('שגיאה בעדכון סטטוס ההזמנה: ' + error.message);
    } else {
      setOrders((prev) =>
        prev.map((o) => (o.id === id ? { ...o, status: newStatus } : o))
      );
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק הזמנה זו?')) return;

    const { error } = await supabase.from('orders').delete().eq('id', id);

    if (error) {
      alert('שגיאה במחיקת ההזמנה: ' + error.message);
    } else {
      fetchOrders();
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('he-IL') + ' ' + d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  };

  const parseItems = (items: any) => {
    if (!items) return [];
    if (Array.isArray(items)) return items;
    if (typeof items === 'string') {
      try {
        const parsed = JSON.parse(items);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        return [];
      }
    }
    return [items];
  };

  const filteredOrders =
    filter === 'הכל' ? orders : orders.filter((o) => o.status === filter);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 pb-12" dir="rtl">
      <header className="bg-white border-b shadow-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-black text-gray-900 tracking-tight">🛠️ פאנל ניהול חנות</h1>
            <nav className="hidden md:flex items-center gap-2">
              <Link href="/admin" className="text-gray-600 hover:bg-gray-100 px-4 py-2 rounded-xl text-xs font-bold transition">
                מוצרים 📱
              </Link>
              <Link href="/admin/orders" className="bg-black text-white px-4 py-2 rounded-xl text-xs font-bold">
                הזמנות 📦
              </Link>
            </nav>
          </div>
          <Link href="/" className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2.5 rounded-xl text-xs font-bold transition">
            חזרה לחנות 🏠
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h2 className="text-2xl font-black text-gray-900">ניהול הזמנות 📦</h2>
          <p className="text-gray-500 text-sm mt-1">כל ההזמנות שהתקבלו בחנות, כולל פרטי לקוח וסטטוס משלוח.</p>
        </div>

        {/* פילטר סטטוסים */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilter('הכל')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              filter === 'הכל' ? 'bg-black text-white' : 'bg-white border text-gray-700 hover:bg-gray-100'
            }`}
          >
            הכל ({orders.length})
          </button>
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s.value}
              onClick={() => setFilter(s.value)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                filter === s.value ? 'bg-black text-white' : 'bg-white border text-gray-700 hover:bg-gray-100'
              }`}
            >
              {s.label} ({orders.filter((o) => o.status === s.value).length})
            </button>
          ))}
        </div>

        <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
          <div className="p-4 border-b bg-gray-50/50 flex justify-between items-center">
            <span className="text-xs font-bold text-gray-500">רשימת הזמנות ({filteredOrders.length})</span>
          </div>

          {loading ? (
            <div className="text-center py-20 text-gray-500 font-medium">טוען הזמנות...</div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-20 space-y-2">
              <span className="text-4xl">📦</span>
              <p className="text-gray-500 text-sm font-medium">אין הזמנות להצגה כרגע.</p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredOrders.map((order) => {
                const items = parseItems(order.items);
                const isExpanded = expandedId === order.id;

                return (
                  <div key={order.id} className="hover:bg-gray-50/50 transition">
                    <div
                      className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : order.id)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                          <h4 className="font-bold text-sm text-gray-900">{order.customer_name || 'ללא שם'}</h4>
                          <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${getStatusStyle(order.status)}`}>
                            {order.status || 'ללא סטטוס'}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 mt-1.5">
                          {order.customer_phone && <span>📞 {order.customer_phone}</span>}
                          {order.customer_email && <span>✉️ {order.customer_email}</span>}
                          {order.shipping_method && <span>🚚 {order.shipping_method}</span>}
                          <span className="font-black text-black">₪{order.total}</span>
                          <span>{formatDate(order.created_at)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={order.status || ''}
                          onChange={(e) => handleStatusChange(order.id, e.target.value)}
                          className="border rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-black transition cursor-pointer bg-white"
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s.value} value={s.value}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleDelete(order.id)}
                          className="bg-red-50 hover:bg-red-100 text-red-600 px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
                        >
                          מחק 🗑️
                        </button>
                        <span className="text-gray-400 text-xs px-1">{isExpanded ? '▲' : '▼'}</span>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-4 pb-5 pt-1 bg-gray-50/70 border-t space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                          <div>
                            <span className="font-bold text-gray-700">כתובת למשלוח: </span>
                            <span className="text-gray-600">{order.customer_address || '—'}</span>
                          </div>
                          <div>
                            <span className="font-bold text-gray-700">אופן משלוח: </span>
                            <span className="text-gray-600">{order.shipping_method || '—'}</span>
                          </div>
                          <div>
                            <span className="font-bold text-gray-700">טלפון: </span>
                            <span className="text-gray-600">{order.customer_phone || '—'}</span>
                          </div>
                          <div>
                            <span className="font-bold text-gray-700">אימייל: </span>
                            <span className="text-gray-600">{order.customer_email || '—'}</span>
                          </div>
                        </div>

                        {items.length > 0 && (
                          <div>
                            <span className="font-bold text-gray-700 text-xs block mb-2">פריטים בהזמנה:</span>
                            <div className="space-y-2">
                              {items.map((item: any, idx: number) => (
                                <div key={idx} className="bg-white border rounded-2xl px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                                  <span className="font-bold text-gray-900">{item.name || 'מוצר'}</span>
                                  {item.selectedColor && <span className="text-gray-600">🎨 צבע: {item.selectedColor}</span>}
                                  {item.selectedVersion && <span className="text-gray-600">📀 גרסה: {item.selectedVersion}</span>}
                                  {item.selectedStorage && <span className="text-gray-600">💾 נפח: {item.selectedStorage}</span>}
                                  {item.quantity && <span className="text-gray-600">כמות: {item.quantity}</span>}
                                  {item.price && <span className="font-bold text-black">₪{item.price}</span>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
