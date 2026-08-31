'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';

export default function AdminProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [kosherList, setKosherList] = useState<any[]>([]);
  const [versionsList, setVersionsList] = useState<any[]>([]);
  const [mediaList, setMediaList] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [mediaModalOpen, setMediaModalOpen] = useState(false);
  const [mediaTargetType, setMediaTargetType] = useState<'main' | 'color'>('main');
  const [activeColorIndex, setActiveColorIndex] = useState<number | null>(null);

  // שדות הטופס
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [mainImageIdx, setMainImageIdx] = useState(0);
  const [shortDesc, setShortDesc] = useState('');
  const [description, setDescription] = useState('');
  const [specs, setSpecs] = useState('');
  const [warranty, setWarranty] = useState('');
  const [version, setVersion] = useState('');
  const [storage, setStorage] = useState('');
  const [stock, setStock] = useState('10');
  const [category, setCategory] = useState('');
  const [kosherStatus, setKosherStatus] = useState('');
  const [productColors, setProductColors] = useState<Array<{ name: string; hex: string; image: string }>>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [prodRes, catRes, kosherRes, verRes] = await Promise.all([
      supabase.from('products').select('*').order('created_at', { ascending: false }),
      supabase.from('categories').select('*'),
      supabase.from('kosher').select('*'),
      supabase.from('versions').select('*'),
    ]);

    if (prodRes.data) setProducts(prodRes.data);
    if (catRes.data) setCategories(catRes.data);
    if (kosherRes.data) setKosherList(kosherRes.data);
    if (verRes.data) setVersionsList(verRes.data);

    // שליפה ישירה מתיקיית product-images ב-Supabase Storage
    let allMedia: any[] = [];
    const { data: files } = await supabase.storage.from('product-images').list();
    if (files) {
      for (const file of files) {
        if (file.name && file.name !== '.emptyFolderPlaceholder') {
          const { data: pub } = supabase.storage.from('product-images').getPublicUrl(file.name);
          if (pub?.publicUrl) allMedia.push({ id: file.id || file.name, url: pub.publicUrl });
        }
      }
    }

    setMediaList(allMedia);
    setLoading(false);
  };

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setPrice('');
    setImages([]);
    setMainImageIdx(0);
    setShortDesc('');
    setDescription('');
    setSpecs('');
    setWarranty('');
    setVersion('');
    setStorage('');
    setStock('10');
    setCategory('');
    setKosherStatus('');
    setProductColors([]);
    setIsFormOpen(false);
  };

  const handleEdit = (p: any) => {
    setEditingId(p.id);
    setName(p.name || '');
    setPrice(p.price?.toString() || '');
    
    let loadedImages = p.images || [];
    if (loadedImages.length === 0 && p.image_url) {
      loadedImages = [p.image_url];
    }
    setImages(loadedImages);
    setMainImageIdx(p.main_image_index || 0);

    setShortDesc(p.short_description || '');
    setDescription(p.description || '');
    setSpecs(p.specs || '');
    setWarranty(p.warranty || '');
    setVersion(p.version || '');
    setStorage(p.storage || '');
    setStock(p.stock !== undefined && p.stock !== null ? p.stock.toString() : '10');
    setCategory(p.category || '');
    setKosherStatus(p.kosher || '');
    setProductColors(p.product_colors || []);
    setIsFormOpen(true);
  };

  const uploadFile = async (file: File): Promise<string | null> => {
    try {
      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage.from('product-images').upload(fileName, file);
      if (uploadError) {
        alert('שגיאה בהעלאת קובץ: ' + uploadError.message);
        setUploading(false);
        return null;
      }

      const { data } = supabase.storage.from('product-images').getPublicUrl(fileName);
      setUploading(false);
      return data.publicUrl;
    } catch (err) {
      setUploading(false);
      return null;
    }
  };

  const handleAddImageFromFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadFile(file);
    if (url) {
      setImages((prev) => [...prev, url]);
      fetchData();
    }
  };

  const addColorRow = () => {
    setProductColors([...productColors, { name: '', hex: '#000000', image: '' }]);
  };

  const updateColorRow = (index: number, field: string, value: string) => {
    const updated = [...productColors];
    updated[index] = { ...updated[index], [field]: value };
    setProductColors(updated);
  };

  const removeColorRow = (index: number) => {
    setProductColors(productColors.filter((_, i) => i !== index));
  };

  const handleColorImageFromFile = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadFile(file);
    if (url) {
      updateColorRow(index, 'image', url);
      fetchData();
    }
  };

  const selectMediaFromLibrary = (url: string) => {
    if (!url) return;
    if (mediaTargetType === 'main') {
      setImages((prev) => [...prev, url]);
    } else if (mediaTargetType === 'color' && activeColorIndex !== null) {
      updateColorRow(activeColorIndex, 'image', url);
    }
    setMediaModalOpen(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !price) {
      alert('נא למלא שם מוצר ומחיר.');
      return;
    }

    const mainImgUrl = images.length > 0 ? images[mainImageIdx || 0] || images[0] : '';

    const productData = {
      name,
      price: parseFloat(price),
      image_url: mainImgUrl,
      images: images,
      main_image_index: mainImageIdx,
      short_description: shortDesc,
      description,
      specs,
      warranty,
      version,
      storage,
      stock: parseInt(stock) || 0,
      category,
      kosher: kosherStatus,
      product_colors: productColors,
    };

    if (editingId) {
      const { error } = await supabase.from('products').update(productData).eq('id', editingId);
      if (error) alert('שגיאה בעדכון: ' + error.message);
      else { resetForm(); fetchData(); }
    } else {
      const { error } = await supabase.from('products').insert([productData]);
      if (error) alert('שגיאה בהוספה: ' + error.message);
      else { resetForm(); fetchData(); }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('האם למחוק מוצר זה?')) return;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) alert('שגיאה במחיקה: ' + error.message);
    else fetchData();
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-900">ניהול מוצרים 📦</h2>
          <p className="text-gray-500 text-sm mt-1">הוספה מתקדמת הכוללת גלריית תמונות, צבעים פיזיים, כשרות וגירסאות.</p>
        </div>
        {!isFormOpen && (
          <button type="button" onClick={() => { resetForm(); setIsFormOpen(true); }} className="bg-black text-white px-6 py-3 rounded-2xl text-xs font-bold hover:bg-gray-800 transition">
            + הוסף מוצר חדש
          </button>
        )}
      </div>

      {isFormOpen && (
        <div className="bg-white rounded-3xl p-6 md:p-8 border shadow-sm space-y-6">
          <div className="flex justify-between items-center border-b pb-4">
            <h3 className="text-lg font-black text-gray-900">{editingId ? 'עריכת מוצר ✏️' : 'הוספת מוצר חדש ➕'}</h3>
            <button type="button" onClick={resetForm} className="text-gray-400 hover:text-black font-bold text-sm">ביטול ✕</button>
          </div>

          <form onSubmit={handleSave} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">שם המוצר *</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className="w-full border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-black" placeholder="שם המוצר..." />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">מחיר (₪) *</label>
                <input type="number" step="any" value={price} onChange={(e) => setPrice(e.target.value)} required className="w-full border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-black" placeholder="699" />
              </div>
            </div>

            {/* גלריית תמונות ובחירת תמונה ראשית */}
            <div className="bg-gray-50 p-4 rounded-2xl border space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-black text-gray-800">גלריית תמונות למוצר (סמן איזה מהן היא הראשית):</span>
                <div className="flex gap-2">
                  <label className="bg-black text-white px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer hover:bg-gray-800 transition">
                    + העלה מהמכשיר
                    <input type="file" accept="image/*" onChange={handleAddImageFromFile} className="hidden" />
                  </label>
                  <button type="button" onClick={() => { setMediaTargetType('main'); setMediaModalOpen(true); }} className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-3 py-1.5 rounded-xl text-xs font-bold transition">
                    📂 בחר מהמדיה
                  </button>
                </div>
              </div>

              {images.length === 0 ? (
                <p className="text-xs text-gray-400">טרם נוספו תמונות למוצר.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {images.map((imgUrl, idx) => (
                    <div key={idx} className={`relative bg-white p-2 rounded-xl border-2 flex flex-col items-center gap-2 ${mainImageIdx === idx ? 'border-black shadow-sm' : 'border-transparent'}`}>
                      <img src={imgUrl} alt="product" className="w-20 h-20 object-contain rounded-lg bg-gray-50" />
                      <div className="flex items-center justify-between w-full text-xs">
                        <button type="button" onClick={() => setMainImageIdx(idx)} className={`px-2 py-1 rounded-lg font-bold ${mainImageIdx === idx ? 'bg-black text-white' : 'bg-gray-100 text-gray-700'}`}>
                          {mainImageIdx === idx ? '⭐ ראשית' : 'הגדר כראשית'}
                        </button>
                        <button type="button" onClick={() => setImages(images.filter((_, i) => i !== idx))} className="text-red-500 font-bold px-1">✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* קטגוריה, כשרות, גרסה */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">קטגוריה</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full border rounded-xl px-4 py-2.5 text-sm outline-none bg-white">
                  <option value="">בחר קטגוריה</option>
                  {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">כשרות (מתוך ניהול כשרויות)</label>
                <select value={kosherStatus} onChange={(e) => setKosherStatus(e.target.value)} className="w-full border rounded-xl px-4 py-2.5 text-sm outline-none bg-white">
                  <option value="">בחר רמת כשרות</option>
                  {kosherList.map((k) => <option key={k.id} value={k.name}>{k.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">גרסה (מתוך ניהול גירסאות)</label>
                <select value={version} onChange={(e) => setVersion(e.target.value)} className="w-full border rounded-xl px-4 py-2.5 text-sm outline-none bg-white">
                  <option value="">בחר גרסה</option>
                  {versionsList.map((v) => <option key={v.id} value={v.name}>{v.name}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">נפח אחסון</label>
                <input type="text" value={storage} onChange={(e) => setStorage(e.target.value)} className="w-full border rounded-xl px-4 py-2.5 text-sm outline-none" placeholder="128GB" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">כמות במלאי</label>
                <input type="number" value={stock} onChange={(e) => setStock(e.target.value)} className="w-full border rounded-xl px-4 py-2.5 text-sm outline-none" placeholder="10" />
              </div>
            </div>

            {/* ניהול צבעים פיזיים ותמונות לצבע */}
            <div className="bg-gray-50 p-4 rounded-2xl border space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-black text-gray-800">צבעים פיזיים ותמונות מותאמות לצבע:</span>
                <button type="button" onClick={addColorRow} className="bg-black text-white px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-gray-800 transition">
                  + הוסף צבע
                </button>
              </div>

              {productColors.length === 0 ? (
                <p className="text-xs text-gray-400">לא הוגדרו צבעים למוצר זה.</p>
              ) : (
                <div className="space-y-3">
                  {productColors.map((col, idx) => (
                    <div key={idx} className="bg-white p-3 rounded-2xl border flex flex-col sm:flex-row gap-3 items-center">
                      <div className="w-full sm:w-1/4">
                        <label className="block text-xs text-gray-500 mb-1">שם הצבע</label>
                        <input type="text" value={col.name} onChange={(e) => updateColorRow(idx, 'name', e.target.value)} className="w-full border rounded-xl px-3 py-1.5 text-xs" placeholder="לדוגמה: כחול כהה" />
                      </div>
                      <div className="w-full sm:w-1/6">
                        <label className="block text-xs text-gray-500 mb-1">צבע פיזי (Hex)</label>
                        <div className="flex items-center gap-2">
                          <input type="color" value={col.hex || '#000000'} onChange={(e) => updateColorRow(idx, 'hex', e.target.value)} className="w-10 h-8 rounded-lg cursor-pointer border" />
                          <span className="text-xs font-mono">{col.hex}</span>
                        </div>
                      </div>
                      <div className="w-full sm:w-2/4 flex items-end gap-2">
                        <div className="flex-1">
                          <label className="block text-xs text-gray-500 mb-1">תמונה לצבע זה</label>
                          <input type="text" value={col.image || ''} onChange={(e) => updateColorRow(idx, 'image', e.target.value)} className="w-full border rounded-xl px-3 py-1.5 text-xs" placeholder="קישור תמונה או בחר מהמדיה..." />
                        </div>
                        <label className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition whitespace-nowrap">
                          העלה קובץ
                          <input type="file" accept="image/*" onChange={(e) => handleColorImageFromFile(idx, e)} className="hidden" />
                        </label>
                        <button type="button" onClick={() => { setActiveColorIndex(idx); setMediaTargetType('color'); setMediaModalOpen(true); }} className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-3 py-1.5 rounded-xl text-xs font-bold transition">
                          📂 מדיה
                        </button>
                      </div>
                      <button type="button" onClick={() => removeColorRow(idx)} className="text-red-500 font-bold self-end sm:self-center p-2">✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">תיאור קצר</label>
              <input type="text" value={shortDesc} onChange={(e) => setShortDesc(e.target.value)} className="w-full border rounded-xl px-4 py-2.5 text-sm outline-none" placeholder="משפט קצר בכרטיס המוצר" />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">תיאור מלא</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full border rounded-xl px-4 py-2.5 text-sm outline-none" placeholder="פירוט מלא..." />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <button type="button" onClick={resetForm} className="bg-gray-100 px-5 py-2.5 rounded-xl text-xs font-bold">ביטול</button>
              <button type="submit" disabled={uploading} className="bg-black text-white px-6 py-2.5 rounded-xl text-xs font-bold hover:bg-gray-800 transition disabled:opacity-50">
                {uploading ? 'מעלה קבצים...' : editingId ? 'שמור שינויים' : 'הוסף מוצר לחנות'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* מודל בחירת תמונה מספריית המדיה */}
      {mediaModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-black text-base">בחר תמונה מספריית המדיה</h3>
              <button type="button" onClick={() => setMediaModalOpen(false)} className="text-gray-400 font-bold">✕ סגור</button>
            </div>
            {mediaList.length === 0 ? (
              <p className="text-center py-12 text-gray-400">אין תמונות באחסון האתר.</p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {mediaList.map((m, idx) => (
                  <div key={m.id || idx} onClick={() => selectMediaFromLibrary(m.url)} className="border rounded-2xl p-2 cursor-pointer hover:border-black transition flex flex-col items-center bg-gray-50">
                    <img src={m.url} alt="media" className="w-24 h-24 object-contain rounded-xl bg-white" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* רשימת מוצרים */}
      <div className="bg-white rounded-3xl border shadow-sm overflow-hidden divide-y">
        <div className="p-4 bg-gray-50/50">
          <span className="text-xs font-bold text-gray-500">רשימת מוצרים קיימים ({products.length})</span>
        </div>
        {loading ? (
          <div className="text-center py-20 text-gray-500">טוען מוצרים...</div>
        ) : products.length === 0 ? (
          <div className="text-center py-20 text-gray-400">אין מוצרים במערכת כרגע.</div>
        ) : (
          products.map((p) => (
            <div key={p.id} className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-gray-50/50 transition">
              <div className="flex items-center gap-4">
                <img src={p.image_url || 'https://via.placeholder.com/60'} alt={p.name} className="w-14 h-14 object-contain rounded-2xl border bg-white" />
                <div>
                  <h4 className="font-bold text-sm text-gray-900">{p.name}</h4>
                  <div className="flex items-center gap-2 text-xs text-gray-500 mt-1 flex-wrap">
                    <span className="font-black text-black">₪{p.price}</span>
                    {p.category && <span className="bg-gray-100 px-2 py-0.5 rounded-md">קטגוריה: {p.category}</span>}
                    {p.kosher && <span className="bg-amber-50 text-amber-800 px-2 py-0.5 rounded-md">כשרות: {p.kosher}</span>}
                    {p.version && <span className="bg-blue-50 text-blue-800 px-2 py-0.5 rounded-md">גרסה: {p.version}</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => handleEdit(p)} className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-1.5 rounded-xl text-xs font-bold transition">ערוך ✏️</button>
                <button type="button" onClick={() => handleDelete(p.id)} className="bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-xl text-xs font-bold transition">מחק 🗑️</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
