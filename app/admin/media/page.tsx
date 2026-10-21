'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function AdminMedia() {
  const [mediaFiles, setMediaFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  useEffect(() => {
    fetchMediaFiles();
  }, []);

  const fetchMediaFiles = async () => {
    try {
      setLoading(true);
      const { data: rootData, error: rootError } = await supabase.storage.from('product-images').list('');
      if (rootError) throw rootError;

      let allFiles: any[] = [];

      if (rootData) {
        for (const item of rootData) {
          if (item.name && item.name !== '.gitkeep') {
            if (!item.id || item.metadata === null || item.name === 'products') {
              const { data: subData, error: subError } = await supabase.storage.from('product-images').list(item.name);
              if (!subError && subData) {
                for (const subItem of subData) {
                  if (subItem.name && subItem.name !== '.gitkeep') {
                    const filePath = `${item.name}/${subItem.name}`;
                    const { data: pub } = supabase.storage.from('product-images').getPublicUrl(filePath);
                    allFiles.push({
                      name: subItem.name,
                      path: filePath,
                      url: pub.publicUrl,
                      created_at: subItem.created_at || item.created_at
                    });
                  }
                }
              }
            } else {
              const { data: pub } = await supabase.storage.from('product-images').getPublicUrl(item.name);
              allFiles.push({
                name: item.name,
                path: item.name,
                url: pub.publicUrl,
                created_at: item.created_at
              });
            }
          }
        }
      }

      setMediaFiles(allFiles);
    } catch (err: any) {
      console.error('Error fetching media:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      setUploading(true);
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `media_${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
        
        const { error } = await supabase.storage.from('product-images').upload(fileName, file);
        if (error) throw error;
      }

      alert('התמונות הועלו בהצלחה לספריית המדיה! 🚀');
      fetchMediaFiles();
    } catch (err: any) {
      alert('שגיאה בהעלאה: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (filePath: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('האם למחוק קובץ זה מהמדיה?')) return;
    try {
      const { error } = await supabase.storage.from('product-images').remove([filePath]);
      if (error) throw error;
      setSelectedIndex(null);
      fetchMediaFiles();
    } catch (err: any) {
      alert('שגיאה במחיקה: ' + err.message);
    }
  };

  const copyToClipboard = (url: string, index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(url);
    setCopiedIndex(index);
    setTimeout(() => {
      setCopiedIndex(null);
      setSelectedIndex(null);
    }, 1500);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-2 sm:p-4" dir="rtl">
      {/* כותרת ראשית אחידה עם הפס הכתום מימין */}
      <div className="space-y-1">
        <h1 className="text-xl font-black text-gray-900 border-r-4 border-orange-600 pr-3 flex items-center gap-2">
          <span>🖼️</span>
          <span>ספריית מדיה</span>
        </h1>
        <p className="text-xs text-gray-500 font-medium pr-4">
          ניהול כל הקבצים והתמונות במערכת בצורה מהירה ומרווחת.
        </p>
      </div>

      {/* כרטיס העלאת תמונות */}
      <div className="bg-white p-6 rounded-3xl border shadow-xs text-center">
        <label className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white font-bold px-6 py-3 rounded-2xl text-xs transition cursor-pointer shadow-md">
          <span>📁</span>
          <span>{uploading ? 'מעלה קבצים...' : 'העלה תמונות חדשות'}</span>
          <input type="file" accept="image/*" multiple onChange={handleUpload} className="hidden" disabled={uploading} />
        </label>
      </div>

      {/* רשת גלריית התמונות: 4 בשורה עם תמונות גדולות וכפתורים צפים בלחיצה */}
      <div className="bg-white p-4 sm:p-6 rounded-3xl border shadow-xs space-y-4">
        <div className="flex justify-between items-center border-b pb-3">
          <h2 className="text-sm font-bold text-gray-800">
            קבצים במערכת ({mediaFiles.length})
          </h2>
          <button 
            onClick={fetchMediaFiles} 
            className="text-xs text-orange-600 hover:text-orange-700 font-bold flex items-center gap-1 cursor-pointer transition"
          >
            <span>🔄</span>
            <span>רענן מאגר</span>
          </button>
        </div>

        {loading ? (
          <div className="text-center py-16 text-xs text-gray-400 font-bold">טוען קבצים מהמדיה...</div>
        ) : mediaFiles.length === 0 ? (
          <div className="text-center py-16 text-xs text-gray-400">אין קבצים זמינים במדיה כרגע.</div>
        ) : (
          <div className="grid grid-cols-4 gap-2.5 sm:gap-4">
            {mediaFiles.map((file, idx) => (
              <div 
                key={idx} 
                onClick={() => setSelectedIndex(selectedIndex === idx ? null : idx)}
                className="relative bg-gray-50 rounded-2xl border border-gray-200 overflow-hidden aspect-square flex items-center justify-center p-1.5 cursor-pointer shadow-2xs hover:border-orange-400 transition"
              >
                {/* התמונה תופסת את כל שטח הריבוע */}
                <img 
                  src={file.url} 
                  alt="" 
                  className="max-w-full max-h-full object-contain" 
                />

                {/* שכבת כפתורים שקופה שמופיעה בלחיצה בלבד */}
                {selectedIndex === idx && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center gap-2 p-2 transition-all">
                    {copiedIndex === idx ? (
                      <span className="text-white text-xs font-black bg-green-600/90 px-2.5 py-1.5 rounded-xl shadow-xs">
                        הועתק! ✓
                      </span>
                    ) : (
                      <>
                        {/* כפתור העתקה */}
                        <button
                          onClick={(e) => copyToClipboard(file.url, idx, e)}
                          title="העתק קישור"
                          className="w-9 h-9 bg-white/90 hover:bg-white text-gray-800 rounded-xl flex items-center justify-center text-sm font-bold shadow-md transition active:scale-95"
                        >
                          📋
                        </button>

                        {/* כפתור מחיקה */}
                        <button
                          onClick={(e) => handleDelete(file.path, e)}
                          title="מחק תמונה"
                          className="w-9 h-9 bg-red-600/90 hover:bg-red-600 text-white rounded-xl flex items-center justify-center text-sm font-bold shadow-md transition active:scale-95"
                        >
                          🗑️
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
