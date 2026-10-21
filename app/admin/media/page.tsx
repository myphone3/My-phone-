'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

// לשוניות הספרייה. כל לשונית נקבעת לפי טבלאות במסד שמכילות את התמונה.
// tables = שמות טבלאות מוכרים, keywords = מילים שמזהות טבלאות נוספות אוטומטית
const CATEGORIES = [
  { key: 'banners', label: 'באנרים', tables: ['banners'], keywords: ['banner'] },
  { key: 'products', label: 'מוצרים', tables: ['products'], keywords: ['product'] },
  { key: 'brands', label: 'מותגים', tables: ['brands'], keywords: ['brand'] },
  { key: 'categories', label: 'קטגוריות', tables: ['categories'], keywords: ['categor'] },
  {
    key: 'kosher',
    label: 'כשרויות',
    tables: ['kosher', 'kashrut', 'kosher_certifications', 'kosher_types', 'kosher_options', 'kosher_labels'],
    keywords: ['kosher', 'kashr', 'hechsher', 'certif'],
  },
];

// תיקיות באחסון שמזוהות אוטומטית (גיבוי נוסף)
const FOLDER_TO_CATEGORY: Record<string, string> = {
  banners: 'banners',
  products: 'products',
  brands: 'brands',
  categories: 'categories',
  kosher: 'kosher',
  kashrut: 'kosher',
};

export default function AdminMedia() {
  const [mediaFiles, setMediaFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<{ file: any } | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>('all');

  useEffect(() => {
    fetchMediaFiles();
  }, []);

  // מנסה לקבל את רשימת הטבלאות האמיתיות מהמסד
  const discoverTables = async (): Promise<string[]> => {
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!url || !key) return [];
      const res = await fetch(`${url}/rest/v1/`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      });
      if (!res.ok) return [];
      const spec = await res.json();
      return Object.keys(spec.definitions || spec.components?.schemas || {});
    } catch (e) {
      return [];
    }
  };

  // טוען את תוכן הטבלאות של כל קטגוריה כטקסט אחד, כדי לבדוק אם תמונה מופיעה בו
  const fetchUsage = async (): Promise<Record<string, string>> => {
    const discovered = await discoverTables();
    const usage: Record<string, string> = {};

    await Promise.all(
      CATEGORIES.map(async (cat) => {
        const matched = discovered.filter((t) =>
          cat.keywords.some((k) => t.toLowerCase().includes(k))
        );
        const tables = Array.from(new Set([...cat.tables, ...matched]));
        let haystack = '';
        await Promise.all(
          tables.map(async (table) => {
            try {
              const { data, error } = await supabase.from(table).select('*');
              if (!error && data) haystack += JSON.stringify(data);
            } catch (e) {}
          })
        );
        usage[cat.key] = haystack;
      })
    );
    return usage;
  };

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
                      folder: item.name,
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
                folder: '',
                url: pub.publicUrl,
                created_at: item.created_at
              });
            }
          }
        }
      }

      // זיהוי אוטומטי: באילו קטגוריות התמונה בשימוש (לפי שם הקובץ)
      const usage = await fetchUsage();
      allFiles = allFiles.map((file) => {
        const cats: string[] = [];
        for (const cat of CATEGORIES) {
          const h = usage[cat.key] || '';
          if (h && (h.includes(file.name) || h.includes(encodeURIComponent(file.name)))) {
            cats.push(cat.key);
          }
        }
        const folderCat = FOLDER_TO_CATEGORY[file.folder];
        if (folderCat && !cats.includes(folderCat)) cats.push(folderCat);
        return { ...file, categories: cats };
      });

      // מיון מהחדש לישן
      allFiles.sort(
        (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      );

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
      e.target.value = '';
    }
  };

  const handleDelete = async (filePath: string) => {
    if (!confirm('האם למחוק קובץ זה מהמדיה?')) return;
    try {
      const { error } = await supabase.storage.from('product-images').remove([filePath]);
      if (error) throw error;
      setPreviewFile(null);
      fetchMediaFiles();
    } catch (err: any) {
      alert('שגיאה במחיקה: ' + err.message);
    }
  };

  const copyToClipboard = (url: string, path: string) => {
    navigator.clipboard.writeText(url);
    setCopiedPath(path);
    setTimeout(() => {
      setCopiedPath(null);
    }, 1500);
  };

  const countFor = (key: string) => mediaFiles.filter((f) => f.categories.includes(key)).length;

  const filteredFiles =
    activeFilter === 'all'
      ? mediaFiles
      : mediaFiles.filter((f) => f.categories.includes(activeFilter));

  const tabClass = (active: boolean) =>
    `shrink-0 px-3.5 py-2 rounded-2xl text-xs font-bold transition cursor-pointer border ${
      active
        ? 'bg-orange-600 text-white border-orange-600 shadow-md'
        : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-orange-50'
    }`;

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-2 sm:p-4" dir="rtl">
      
      {/* כותרת ראשית אחידה עם הפס הכתום */}
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

      {/* רשת גלריית התמונות: 4 בשורה */}
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

        {/* לשוניות סינון */}
        {!loading && mediaFiles.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              className={tabClass(activeFilter === 'all')}
            >
              הכול ({mediaFiles.length})
            </button>
            {CATEGORIES.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setActiveFilter(c.key)}
                className={tabClass(activeFilter === c.key)}
              >
                {c.label} ({countFor(c.key)})
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="text-center py-16 text-xs text-gray-400 font-bold">טוען קבצים מהמדיה...</div>
        ) : filteredFiles.length === 0 ? (
          <div className="text-center py-16 text-xs text-gray-400">אין קבצים בקטגוריה הזו.</div>
        ) : (
          <div className="grid grid-cols-4 gap-2.5 sm:gap-4">
            {filteredFiles.map((file) => (
              <div 
                key={file.path} 
                onClick={() => setPreviewFile({ file })}
                className="relative bg-gray-50 rounded-2xl border border-gray-200 overflow-hidden aspect-square flex items-center justify-center p-1.5 cursor-pointer shadow-2xs hover:border-orange-500 hover:scale-102 transition group"
              >
                <img 
                  src={file.url} 
                  alt="" 
                  className="max-w-full max-h-full object-contain" 
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* חלון צף מוגדל (Modal) לצפייה בתמונה + כפתורי פעולה */}
      {previewFile && (
        <div 
          className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          onClick={() => setPreviewFile(null)}
        >
          <div 
            className="bg-white rounded-3xl max-w-lg w-full p-5 space-y-4 shadow-2xl border relative flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            {/* כפתור סגירה */}
            <button
              onClick={() => setPreviewFile(null)}
              className="absolute top-4 left-4 w-9 h-9 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full flex items-center justify-center font-bold text-sm transition cursor-pointer"
            >
              ✕
            </button>

            <h3 className="font-bold text-sm text-gray-800 text-center w-full border-b pb-2">
              תצוגת תמונה מוגדלת
            </h3>

            {/* תמונה בגודל מלא */}
            <div className="w-full max-h-[50vh] flex items-center justify-center bg-gray-50 rounded-2xl p-2 border">
              <img 
                src={previewFile.file.url} 
                alt="" 
                className="max-w-full max-h-[45vh] object-contain rounded-xl"
              />
            </div>

            {/* כפתורי פעולה: העתקה ומחיקה */}
            <div className="flex gap-3 w-full pt-2">
              <button
                onClick={() => copyToClipboard(previewFile.file.url, previewFile.file.path)}
                className="flex-1 bg-orange-600 hover:bg-orange-700 text-white py-3 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                <span>{copiedPath === previewFile.file.path ? '✓ הועתק!' : '📋 העתק קישור לתמונה'}</span>
              </button>

              <button
                onClick={() => handleDelete(previewFile.file.path)}
                className="bg-red-50 hover:bg-red-100 text-red-600 px-5 py-3 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer border border-red-100"
              >
                <span>🗑️</span>
                <span>מחק</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
