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
    <div className="space-y-6 max-w-4xl mx-auto p-2 sm:p-4" dir="rtl">
      {/* כותרת ראשית עם הפס הכתום מימין */}
      <div className="space-y-1">
        <h1 className="text-xl font-black text-gray-900 border-r-4 border-orange-600 pr-3 flex items-center gap-2">
          <span>⚙️</span>
          <span>ניהול גירסאות</span>
        </h1>
        <p className="text-xs text-gray-500 font-medium pr-4">
          הגדרת רשימת הגירסאות שיופיעו בהוספת מוצרים.
        </p>
      </div>

      {/* טופס הוספת גרסה חדשה */}
      <div className="bg-white rounded-3xl p-4 sm:p-6 border shadow-xs">
        <form onSubmit={handleSave} className="flex items-center gap-2 sm:gap-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="שם הגרסה החדשה"
            className="flex-1 min-w-0 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-xs outline-none focus:border-orange-500 transition"
            required
          />
          <button 
            type="submit" 
            className="shrink-0 bg-black hover:bg-gray-800 text-white font-black px-4 sm:px-6 py-3 rounded-2xl text-xs transition shadow-md whitespace-nowrap cursor-pointer"
          >
            + הוסף גרסה
          </button>
        </form>
      </div>

      {/* רשימת הגרסאות הקיימות */}
      <div className="bg-white rounded-3xl border shadow-xs overflow-hidden divide-y divide-gray-100">
        {loading ? (
          <div className="text-center py-16 text-xs text-gray-400 font-bold">טוען גירסאות...</div>
        ) : versions.length === 0 ? (
          <div className="text-center py-16 text-xs text-gray-400">אין גרסאות במערכת.</div>
        ) : (
          versions.map((v) => (
            <div key={v.id} className="p-4 flex justify-between items-center hover:bg-orange-50/20 transition">
              <span className="font-bold text-xs sm:text-sm text-gray-900">{v.name}</span>
              <button 
                onClick={() => handleDelete(v.id)} 
                className="bg-red-50 hover:bg-red-100 text-red-600 px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-2xs border border-red-100"
              >
                <span>מחק</span>
                <span>🗑️</span>
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
