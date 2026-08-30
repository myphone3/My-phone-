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
  const [filter, setFilter] = useState
