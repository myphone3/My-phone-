'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import Link from 'next/link';

export default function AdminProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [kosherList, setKosherList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // שדות הטופס המלאים
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [shortDesc, setShortDesc] = useState('');
  const [description, setDescription] = useState('');
  const [specs, setSpecs] = useState('');
  const [warranty, setWarranty] = useState('');
  const [version, setVersion] = useState('');
  const [storage, setStorage] = useState('');
  const [colors, setColors] = useState('');
  const [stock, setStock] = useState('10');
  const [category, setCategory] = useState('');
  const [kosherStatus, setKosherStatus] = useState('');
  const [colorImages, setColorImages] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [prodRes, catRes, kosherRes] = await Promise.all([
      supabase.from('products').select('*').order('created_at', { ascending: false }),
      supabase.from('categories').select('*'),
      supabase.from('kosher').select('*')
    ]);

    if (prodRes.data) setProducts(prodRes.data);
    if (catRes.data) setCategories(catRes.data);
    if (kosherRes.data) setKosherList(kosherRes.data);
    setLoading(false);
  };

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setPrice('');
    setImageUrl('');
    setShortDesc('');
    setDescription('');
    setSpecs('');
    setWarranty('');
    setVersion('');
    setStorage('');
    setColors('');
    setStock('10');
    setCategory('');
    setKosherStatus('');
    setColorImages({});
    setIsFormOpen(false);
  };

  const handleEdit = (p: any) => {
    setEditingId(p.id);
    setName(p.name || '');
    setPrice(p.price?.toString() || '');
    setImageUrl(p.image_url || '');
    setShortDesc(p.short_description || '');
    setDescription(p.description || '');
    setSpecs(p.specs || '');
    setWarranty(p.warranty || '');
    setVersion(p.version || '');
    setStorage(p.storage || '');
    setColors(p.colors || '');
    setStock(p.stock !== undefined && p.stock !== null ? p.stock.toString() : '10');
    setCategory(p.category || '');
    setKosherStatus(p.kosher || '');
    setColorImages(p.color_images || {});
    setIsFormOpen(true);
  };

  // העלאת קובץ תמונה ל-Supabase Storage
  const uploadImageFile = async (file: File): Promise<string | null> => {
    try {
      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${fileName}`;

      // ניסיון העלאה לbucket בשם images
      let { error: uploadError } = await supabase.storage
        .from('images')
        .upload(filePath, file);

      let bucketName = 'images';

      if (uploadError) {
        // אם ה-bucket בשם images לא קיים, ננסה products
        const { error: err2 } = await supabase.storage
          .from('products')
          .upload(filePath, file);
        
        if (err2) {
          alert('שגיאה בהעלאת הקובץ ל-Supabase Storage: ' + err2.message);
          setUploading(false);
          return null;
        }
        bucketName = 'products';
      }

      const { data } = supabase.storage.from(bucketName).getPublicUrl(filePath);
      setUploading(false);
      return data.publicUrl;
    } catch (err: any) {
      console.error(err);
      setUploading(false);
      alert('שגיאה בהעלאת התמונה');
      return null;
    }
  };

  const handleMainImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const publicUrl = await uploadImageFile(file);
    if (publicUrl) setImageUrl(publicUrl);
  };

  const handleColorImageFileChange = async (color: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const publicUrl = await uploadImageFile(file);
    if (publicUrl) {
      setColorImages((prev) => ({
        ...prev,
        [color.trim()]: publicUrl,
      }));
    }
  };

  const handleColorImageTextChange = (color: string, url: string) => {
    setColorImages((prev) => ({
      ...prev,
      [color.trim()]: url,
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !price) {
      alert('נא למלא לפחות את שם המוצר והמחיר.');
      return;
    }

    const productData = {
      name,
      price: parseFloat(price),
      image_url: imageUrl,
      short_description: shortDesc,
      description,
      specs,
      warranty,
      version,
      storage,
      colors,
      stock: parseInt(stock) || 0,
      category,
      kosher: kosherStatus,
      color_images: colorImages,
    };

    if (editingId) {
      const { error } = await supabase
        .from('products')
        .update(productData)
        .eq('id', editingId);

      if (error) {
        alert('שגיאה בעדכון המוצר: ' + error.message);
      } else {
        resetForm();
        fetchData();
      }
    } else {
      const { error } = await supabase
        .from('products')
        .insert([productData]);

      if (error) {
        alert('שגיאה בהוספת המוצר: ' + error.message);
      } else {
        resetForm();
        fetchData();
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק מוצר זה?')) return;

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);

    if (error) {
      alert('שגיאה במחיקת המוצר: ' + error.message);
    } else {
      fetchData();
    }
  };

  const colorList = colors ? colors.split(',').map((c) => c.trim()).filter(Boolean) : [];

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-900">ניהול מוצרים 📦</h2>
          <p className="text-gray-500 text-sm mt-1">הוספה, עריכה מלאה וניהול מלאי המוצרים בחנות.</p>
        </div>

        {!isFormOpen && (
          <button
            onClick={() => { resetForm(); setIsFormOpen(true); }}
            className="bg-black text-white px-6 py-3 rounded-2xl text-xs font-bold hover:bg-gray-800 transition shadow-sm cursor-pointer"
          >
            + הוסף מוצר חדש
          </button>
        )}
      </div>

      {isFormOpen && (
        <div className="bg-white rounded-3xl p-6 md:p-8 border shadow-sm space-y-6">
          <div className="flex justify-between items-center border-b pb-4">
            <h3 className="text-lg font-black text-gray-900">
              {editingId ? 'עריכת מוצר קיים ✏️' : 'הוספת מוצר חדש ➕'}
            </h3>
            <button
              onClick={resetForm}
              className="text-gray-400 hover:text-black font-bold text-sm px-3 py-1.5 rounded-xl hover:bg-gray-100 transition cursor-pointer"
            >
              ביטול ✕
            </button>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">שם המוצר *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-black transition"
                  placeholder="לדוגמה: Xiaomi Qin F25 Pro"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">מחיר (₪) *</label>
                <input
                  type="number"
                  step="any"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  required
                  className="w-full border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-black transition"
                  placeholder="699"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">תמונה ראשית (העלאת קובץ או קישור)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleMainImageChange}
                  className="w-full border rounded-xl px-3 py-2 text-xs outline-none focus:border-black bg-white transition mb-1 cursor-pointer"
                />
                <input
                type="text"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className="w-full border rounded-xl px-3 py-2 text-xs outline-none focus:border-black transition text-gray-500"
                placeholder="או הדבק קישור לתמונה כאן..."
              />
              {uploading && <span className="text-xs text-blue-600 font-bold">מעלה תמונה... ⏳</span>}
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">קטגוריה</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-black transition bg-white"
                >
                  <option value="">בחר קטגוריה</option>
                  {categories.map((cat) => (
                    <option key={cat.id || cat.name} value={cat.name}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">כשרות</label>
                <select
                  value={kosherStatus}
                  onChange={(e) => setKosherStatus(e.target.value)}
                  className="w-full border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-black transition bg-white"
                >
                  <option value="">בחר רמת כשרות</option>
                  {kosherList.map((k) => (
                    <option key={k.id || k.name} value={k.name}>
                      {k.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">גרסה</label>
                <input
                  type="text"
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  className="w-full border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-black transition"
                  placeholder="כשרה / גלובלית"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">נפח אחסון</label>
                <input
                  type="text"
                  value={storage}
                  onChange={(e) => setStorage(e.target.value)}
                  className="w-full border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-black transition"
                  placeholder="128GB"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">כמות במלאי</label>
                <input
                  type="number"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  className="w-full border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-black transition"
                  placeholder="10"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">צבעים (מופרדים בפסיק)</label>
              <input
                type="text"
                value={colors}
                onChange={(e) => setColors(e.target.value)}
                className="w-full border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-black transition"
                placeholder="שחור, לבן, כחול"
              />
            </div>

            {/* בחירת קובץ או קישור תמונה לכל צבע */}
            {colorList.length > 0 && (
              <div className="bg-gray-50 p-4 rounded-2xl space-y-3 border">
                <span className="text-xs font-black text-gray-700 block">תמונות לפי צבע:</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {colorList.map((color) => (
                    <div key={color} className="space-y-1.5 bg-white p-3 rounded-xl border">
                      <label className="block text-xs text-gray-800 font-bold">צבע: {color}</label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleColorImageFileChange(color, e)}
                        className="w-full border rounded-lg px-2 py-1 text-xs outline-none bg-white cursor-pointer mb-1"
                      />
                      <input
                        type="text"
                        value={colorImages[color] || ''}
                        onChange={(e) => handleColorImageTextChange(color, e.target.value)}
                        className="w-full border rounded-lg px-2 py-1 text-xs outline-none text-gray-500"
                        placeholder={`או הדבק קישור תמונה ל-${color}`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">תיאור קצר</label>
              <input
                type="text"
                value={shortDesc}
                onChange={(e) => setShortDesc(e.target.value)}
                className="w-full border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-black transition"
                placeholder="משפט תיאור קצר שמופיע בכרטיס המוצר"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">תיאור מלא</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-black transition"
                placeholder="פירוט מלא על המוצר..."
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">מפרט טכני</label>
                <input
                  type="text"
                  value={specs}
                  onChange={(e) => setSpecs(e.target.value)}
                  className="w-full border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-black transition"
                  placeholder="מסך 5.0 אינץ', סוללה 3000mAh"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">אחריות</label>
                <input
                  type="text"
                  value={warranty}
                  onChange={(e) => setWarranty(e.target.value)}
                  className="w-full border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-black transition"
                  placeholder="שנה אחריות יבואן רשמי"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={resetForm}
                className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                ביטול
              </button>
              <button
                type="submit"
                disabled={uploading}
                className="bg-black text-white px-6 py-2.5 rounded-xl text-xs font-bold hover:bg-gray-800 transition cursor-pointer shadow-sm disabled:opacity-50"
              >
                {uploading ? 'מעלה קבצים...' : editingId ? 'שמור שינויים' : 'הוסף מוצר לחנות'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-gray-50/50 flex justify-between items-center">
          <span className="text-xs font-bold text-gray-500">רשימת מוצרים קיימים ({products.length})</span>
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-500 font-medium">טוען מוצרים...</div>
        ) : products.length === 0 ? (
          <div className="text-center py-20 space-y-2">
            <span className="text-4xl">📱</span>
            <p className="text-gray-500 text-sm font-medium">אין מוצרים במערכת כרגע.</p>
          </div>
        ) : (
          <div className="divide-y">
            {products.map((p) => (
              <div key={p.id} className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-gray-50/50 transition">
                <div className="flex items-center gap-4">
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name} className="w-14 h-14 object-contain rounded-2xl border bg-white" />
                  ) : (
                    <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center text-xl">📦</div>
                  )}
                  <div>
                    <h4 className="font-bold text-sm text-gray-900">{p.name}</h4>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                      <span className="font-black text-black">₪{p.price}</span>
                      {p.category && <span className="bg-gray-100 px-2 py-0.5 rounded-md">קטגוריה: {p.category}</span>}
                      {p.kosher && <span className="bg-amber-50 text-amber-800 px-2 py-0.5 rounded-md">כשרות: {p.kosher}</span>}
                      {p.stock !== undefined && <span>מלאי: {p.stock}</span>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    onClick={() => handleEdit(p)}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    ערוך ✏️
                  </button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    מחק 🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
