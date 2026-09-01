'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function AdminProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [storageFiles, setStorageFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Product Form States
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [category, setCategory] = useState('');
  const [brand, setBrand] = useState('');
  const [shortDesc, setShortDesc] = useState('');
  const [description, setDescription] = useState('');
  const [specs, setSpecs] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [variantsInput, setVariantsInput] = useState('');
  const [colors, setColors] = useState<{ name: string; hex: string; image: string }[]>([
    { name: 'שחור', hex: '#000000', image: '' }
  ]);
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDesc, setSeoDesc] = useState('');
  const [isPublished, setIsPublished] = useState(true);

  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [prodRes, storageRes] = await Promise.all([
      supabase.from('products').select('*').order('created_at', { ascending: false }),
      supabase.storage.from('products').list('', { limit: 100 })
    ]);

    if (prodRes.data) setProducts(prodRes.data);
    if (storageRes.data) {
      const files = storageRes.data.map((f: any) => {
        const { data } = supabase.storage.from('products').getPublicUrl(f.name);
        return data.publicUrl;
      });
      setStorageFiles(files);
    }
    setLoading(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `products/${fileName}`;

    const { error } = await supabase.storage.from('products').upload(filePath, file);
    if (error) {
      alert('שגיאה בהעלאת קובץ: ' + error.message);
      setUploading(false);
      return;
    }

    const { data } = supabase.storage.from('products').getPublicUrl(filePath);
    setImageUrl(data.publicUrl);
    setImages((prev) => [...prev, data.publicUrl]);
    setUploading(false);
    fetchData();
  };

  const handleAiAssistant = () => {
    if (!name) {
      alert('נא להזין תחילה את שם המוצר כדי שהסוכן יוכל לייצר עבורך טקסטים');
      return;
    }
    setAiGenerating(true);
    setTimeout(() => {
      setShortDesc(`מכשיר איכותי ומתקדם דגם ${name}, בעל ביצועים עוצמתיים ואחריות מלאה.`);
      setDescription(`הכירו את ${name}. מכשיר מושלם המשלב עיצוב חדשני, מסך איכותי ברזולוציה גבוהה, מעבד מהיר במיוחד וסוללה חזקה לאורך כל היום. מתאים במיוחד לשימוש יומיומי מתקדם.`);
      setSpecs(`מסך: איכותי וחד\nמעבד: מתקדם ועוצמתי\nסוללה: קיבולת גבוהה\nאחריות: יבואן רשמי`);
      setSeoTitle(`${name} | מחיר מיוחד משלוח מהיר עד הבית`);
      setSeoDesc(`הזמינו כעת ${name} במחיר הטוב ביותר בחנות NEW PHONE. משלוח מהיר עד הבית ושירות מעולה.`);
      setAiGenerating(false);
    }, 800);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !price) {
      alert('נא למלא לפחות שם מוצר ומחיר');
      return;
    }

    const variantsArray = variantsInput
      ? variantsInput.split(',').map((v) => v.trim()).filter(Boolean)
      : [];

    const payload = {
      name,
      price: Number(price),
      sale_price: salePrice ? Number(salePrice) : null,
      category,
      brand,
      short_description: shortDesc,
      description,
      specs,
      image_url: imageUrl || images[0] || '',
      images,
      product_variants: variantsArray,
      product_colors: colors,
      seo_title: seoTitle,
      seo_description: seoDesc,
      is_published: isPublished
    };

    if (editingId) {
      const { error } = await supabase.from('products').update(payload).eq('id', editingId);
      if (error) alert('שגיאה בעדכון המוצר: ' + error.message);
      else {
        alert('המוצר עודכן בהצלחה!');
        resetForm();
        fetchData();
      }
    } else {
      const { error } = await supabase.from('products').insert([payload]);
      if (error) alert('שגיאה בהוספת מוצר: ' + error.message);
      else {
        alert('המוצר נוסף בהצלחה!');
        resetForm();
        fetchData();
      }
    }
  };

  const resetForm = () => {
    setName('');
    setPrice('');
    setSalePrice('');
    setCategory('');
    setBrand('');
    setShortDesc('');
    setDescription('');
    setSpecs('');
    setImageUrl('');
    setImages([]);
    setVariantsInput('');
    setColors([{ name: 'שחור', hex: '#000000', image: '' }]);
    setSeoTitle('');
    setseoDesc('');
    setIsPublished(true);
    setEditingId(null);
  };

  const handleEdit = (prod: any) => {
    setEditingId(prod.id);
    setName(prod.name || '');
    setPrice(prod.price || '');
    setSalePrice(prod.sale_price || '');
    setCategory(prod.category || '');
    setBrand(prod.brand || '');
    setShortDesc(prod.short_description || '');
    setDescription(prod.description || '');
    setSpecs(prod.specs || '');
    setImageUrl(prod.image_url || '');
    setImages(prod.images || []);
    setVariantsInput(prod.product_variants ? prod.product_variants.join(', ') : '');
    setColors(prod.product_colors || [{ name: 'שחור', hex: '#000000', image: '' }]);
    setSeoTitle(prod.seo_title || '');
    setSeoDesc(prod.seo_description || '');
    setIsPublished(prod.is_published ?? true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('האם למחוק מוצר זה?')) return;
    await supabase.from('products').delete().eq('id', id);
    fetchData();
  };

  if (loading) return <div className="text-center py-20 text-gray-500 font-medium">טוען מוצרים...</div>;

  return (
    <div className="space-y-8" dir="rtl">
      <div className="bg-white p-6 rounded-3xl border shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-4 gap-3">
          <h2 className="text-base font-black text-gray-900 border-r-4 border-orange-600 pr-3">
            {editingId ? 'עריכת מוצר קיים' : 'הוספת מוצר חדש לחנות'}
          </h2>
          <div className="flex gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleAiAssistant}
              disabled={aiGenerating}
              className="flex-1 sm:flex-none bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
            >
              ✨ {aiGenerating ? 'יוצר תוכן...' : 'סוכן AI למילוי אוטומטי'}
            </button>
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className="flex-1 sm:flex-none bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              👁️ {showPreview ? 'הסתר תצוגה מקדימה' : 'תצוגה מקדימה'}
            </button>
          </div>
        </div>

        {/* תצוגה מקדימה לייב */}
        {showPreview && (
          <div className="bg-orange-50 border border-orange-200 p-6 rounded-2xl space-y-4">
            <span className="text-xs font-bold text-orange-700 bg-orange-100 px-3 py-1 rounded-full">תצוגה מקדימה ללקוח בחנות</span>
            <div className="bg-white p-4 rounded-2xl border shadow-xs grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="h-48 bg-gray-50 rounded-xl border flex items-center justify-center overflow-hidden">
                {imageUrl ? <img src={imageUrl} alt="" className="w-full h-full object-contain" /> : <span className="text-xs text-gray-400">אין תמונה</span>}
              </div>
              <div className="space-y-2">
                <h3 className="font-black text-base text-gray-900">{name || 'שם המוצר'}</h3>
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-black text-orange-600">₪{salePrice || price || '0'}</span>
                  {salePrice && <span className="text-xs text-gray-400 line-through">₪{price}</span>}
                </div>
                <p className="text-xs text-gray-600">{shortDesc || 'תיאור קצר יופיע כאן...'}</p>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSaveProduct} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">שם המוצר <span className="text-red-500">*</span></label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="שם המכשיר..." className="w-full bg-gray-50 border rounded-xl p-3 text-xs outline-none focus:border-orange-600" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">מחיר רגיל (₪) <span className="text-red-500">*</span></label>
              <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="999" className="w-full bg-gray-50 border rounded-xl p-3 text-xs outline-none focus:border-orange-600" required />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">מחיר מבצע (₪)</label>
              <input type="number" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} placeholder="799" className="w-full bg-gray-50 border rounded-xl p-3 text-xs outline-none focus:border-orange-600" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">קטגוריה</label>
              <input type="text" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="כגון: מכשירים כשרים" className="w-full bg-gray-50 border rounded-xl p-3 text-xs outline-none focus:border-orange-600" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">תמונת מותג (URL)</label>
              <input type="text" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="קישור לתמונת מותג" className="w-full bg-gray-50 border rounded-xl p-3 text-xs outline-none focus:border-orange-600" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">גרסאות / נפחי אחסון (מופרדים בפסיקים)</label>
            <input type="text" value={variantsInput} onChange={(e) => setVariantsInput(e.target.value)} placeholder="64GB, 128GB, 256GB" className="w-full bg-gray-50 border rounded-xl p-3 text-xs outline-none focus:border-orange-600" />
          </div>

          {/* העלאת קובץ תמונה ובחירה מהמדיה */}
          <div className="space-y-3 bg-gray-50 p-4 rounded-2xl border">
            <label className="block text-xs font-bold text-gray-700">תמונת מוצר ראשית (העלאת קובץ או בחירה מתוך ספריית המדיה)</label>
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <input type="file" accept="image/*" onChange={handleImageUpload} className="bg-white border rounded-xl p-2 text-xs cursor-pointer w-full sm:w-auto" />
              {uploading && <span className="text-xs text-orange-600 font-bold">מעלה קובץ...</span>}
              {imageUrl && <span className="text-xs text-green-600 font-bold">✓ תמונה נבחרה בהצלחה</span>}
            </div>

            {storageFiles.length > 0 && (
              <div>
                <span className="text-[11px] font-bold text-gray-600 block mb-1">או בחר תמונה מתוך ספריית המדיה הקיימת:</span>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {storageFiles.map((url, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => { setImageUrl(url); setImages((prev) => [...prev, url]); }}
                      className={`w-14 h-14 rounded-xl border overflow-hidden shrink-0 transition cursor-pointer bg-white ${imageUrl === url ? 'border-orange-600 ring-2 ring-orange-600/30' : 'border-gray-200'}`}
                    >
                      <img src={url} alt="" className="w-full h-full object-contain p-1" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">תיאור קצר</label>
            <input type="text" value={shortDesc} onChange={(e) => setShortDesc(e.target.value)} placeholder="משפט סיכום קצר שיופיע מתחת למחיר..." className="w-full bg-gray-50 border rounded-xl p-3 text-xs outline-none focus:border-orange-600" />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">תיאור מלא</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="תיאור מפורט על המוצר..." className="w-full bg-gray-50 border rounded-xl p-3 text-xs outline-none focus:border-orange-600"></textarea>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">מפרט מלא / מפרט טכני</label>
            <textarea value={specs} onChange={(e) => setSpecs(e.target.value)} rows={3} placeholder="הזן נתוני מפרט טכני..." className="w-full bg-gray-50 border rounded-xl p-3 text-xs outline-none focus:border-orange-600"></textarea>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t pt-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">SEO Title (כותרת בגוגל)</label>
              <input type="text" value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} placeholder="כותרת SEO..." className="w-full bg-gray-50 border rounded-xl p-3 text-xs outline-none focus:border-orange-600" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">SEO Description (תיאור בגוגל)</label>
              <input type="text" value={seoDesc} onChange={(e) => setSeoDesc(e.target.value)} placeholder="תיאור SEO..." className="w-full bg-gray-50 border rounded-xl p-3 text-xs outline-none focus:border-orange-600" />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button type="submit" className="bg-orange-600 text-white px-6 py-3.5 rounded-2xl text-xs font-black hover:bg-orange-700 transition shadow-md cursor-pointer">
              {editingId ? 'עדכן מוצר ➔' : '+ הוסף מוצר לחנות ➔'}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm} className="bg-gray-200 text-gray-800 px-6 py-3.5 rounded-2xl text-xs font-bold transition cursor-pointer">
                ביטול
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="bg-white p-6 rounded-3xl border shadow-sm space-y-4">
        <h2 className="text-base font-black text-gray-900 border-r-4 border-orange-600 pr-3">מוצרים קיימים ({products.length})</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {products.map((p) => (
            <div key={p.id} className="border rounded-2xl p-4 flex justify-between items-center bg-gray-50/50 shadow-xs">
              <div className="flex items-center gap-3">
                <img src={p.image_url} alt="" className="w-12 h-12 object-contain bg-white rounded-xl border p-1" />
                <div>
                  <h4 className="font-bold text-xs text-gray-900">{p.name}</h4>
                  <span className="text-xs text-orange-600 font-black">₪{p.price}</span>
                </div>
              </div>
              <div className="flex gap-2 text-xs">
                <button onClick={() => handleEdit(p)} className="text-blue-600 font-bold hover:underline cursor-pointer">עריכה</button>
                <button onClick={() => handleDelete(p.id)} className="text-red-500 font-bold hover:underline cursor-pointer">מחיקה</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
