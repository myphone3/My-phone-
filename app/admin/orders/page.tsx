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
        return Array.isArray(parsed) ? parsed : [parsed
