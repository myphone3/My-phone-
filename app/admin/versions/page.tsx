'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import Link from 'next/link';

export default function AdminVersionsPage() {
  const [versions, setVersions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');

  useEffect(() => {
    fetchVersions();
  }, []);

  const fetchVersions = async () => {
    setLoading(true);
    const { data } = await supabase.from('versions').select('*').order('created_at', { ascending: false });
    if (data) setVersions(data);
    setLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const { error } = await supabase.from('versions').insert([{ name: name.trim() }]);
    if (error) {
      alert('שגיאה בהוספת הגרסה: ' + error.message);
    } else {
      setName('');
      fetchVersions();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('האם למחוק גרסה זו?')) return;
    const { error } = await supabase.from('versions').delete().eq('id', id);
    if (error) alert('שגיאה במחיקה: ' + error.message);
    else fetchVersions();
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-gray-900">ניהול גירסאות ⚙️</h2>
          <p className="text-gray-500 text-sm mt-1">הגדרת רשימת הגירסאות שיופיעו בהוספת מוצרים.</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 border shadow-sm">
        <form onSubmit={handleSave} className="flex gap-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="שם הגרסה החדשה (לדוגמה: כשרה רשמית)"
            className="flex-1 border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-black"
            required
          />
          <button type="submit" className="bg-black text-white px-6 py-2.5 rounded-xl text-xs font-bold hover:bg-gray-800 transition">
            + הוסף גרסה
          </button>
        </form>
      </div>

      <div className="bg-white rounded-3xl border shadow-sm overflow-hidden divide-y">
        {loading ? (
          <div className="text-center py-12 text-gray-500">טוען גירסאות...</div>
        ) : versions.length === 0 ? (
          <div className="text-center py-12 text-gray-400">אין גרסאות במערכת.</div>
        ) : (
          versions.map((v) => (
            <div key={v.id} className="p-4 flex justify-between items-center">
              <span className="font-bold text-sm text-gray-900">{v.name}</span>
              <button onClick={() => handleDelete(v.id)} className="bg-red-50 text-red-600 px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-red-100 transition">
                מחק 🗑️
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
