'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';

export default function AdminProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [brandsList, setBrandsList] = useState<any[]>([]);
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

  // טאבים לתצוגה מקדימה
  const [shortDescTab, setShortDescTab] = useState<'edit' | 'preview'>('edit');
  const [descTab, setDescTab] = useState<'edit' | 'preview'>('edit');
  const [specsTab, setSpecsTab] = useState<'edit' | 'preview'>('edit');

  // שדות הטופס
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [mainImageIdx, setMainImageIdx] = useState(0);
  const [shortDesc, setShortDesc] = useState('');
  const [description, setDescription] = useState('');
  const [specs, setSpecs] = useState('');
  const [warranty, setWarranty] = useState('');
  const [storage, setStorage] = useState('');
  const [storageOptions, setStorageOptions] = useState('');
  const [tags, setTags] = useState('');
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [stock, setStock] = useState('10');
  const [category, setCategory] = useState('');
  const [brand, setBrand] = useState('');
  const [kosherStatus, setKosherStatus] = useState('');
  const [selectedVersions, setSelectedVersions] = useState<string[]>([]);
  const [productColors, setProductColors] = useState<Array<{ name: string; hex: string; image: string }>>([]);
  const [isPublished, setIsPublished] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [prodRes, catRes, brandRes, kosherRes, verRes] = await Promise.all([
      supabase.from('products').select('*').order('created_at', { ascending: false }),
      supabase.from('categories').select('*'),
      supabase.from('brands').select('*'),
      supabase.from('kosher_options').select('*'),
      supabase.from('versions').select('*'),
    ]);

    if (prodRes.data) setProducts(prodRes.data);
    if (catRes.data) setCategories(catRes.data);
    if (brandRes.data) setBrandsList(brandRes.data);
    if (kosherRes.data) setKosherList(kosherRes.data);
    if (verRes.data) setVersionsList(verRes.data);

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
    setSalePrice('');
    setImages([]);
    setMainImageIdx(0);
    setShortDesc('');
    setDescription('');
    setSpecs('');
    setWarranty('');
    setStorage('');
    setStorageOptions('');
    setTags('');
    setSeoTitle('');
    setSeoDescription('');
    setStock('10');
    setCategory('');
    setBrand('');
    setKosherStatus('');
    setSelectedVersions([]);
    setProductColors([]);
    setIsPublished(true);
    setIsFormOpen(false);
    setShortDescTab('edit');
    setDescTab('edit');
    setSpecsTab('edit');
  };

  const handleEdit = (p: any) => {
    setEditingId(p.id);
    setName(p.name || '');
    setPrice(p.price?.toString() || '');
    setSalePrice(p.sale_price !== null && p.sale_price !== undefined ? p.sale_price.toString() : '');
    
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
    setStorage(p.storage || '');
    setStorageOptions(p.storage_options || '');
    setTags(p.tags || '');
    setSeoTitle(p.seo_title || '');
    setSeoDescription(p.seo_description || '');
    setStock(p.stock !== undefined && p.stock !== null ? p.stock.toString() : '10');
    setCategory(p.category || '');
    setBrand(p.brand || '');
    setKosherStatus(p.kosher || '');
    setSelectedVersions(p.product_versions || (p.version ? [p.version] : []));
    setProductColors(p.product_colors || []);
    setIsPublished(p.is_published !== false);
    setIsFormOpen(true);
    setShortDescTab('edit');
    setDescTab('edit');
    setSpecsTab('edit');
  };

  // 🤖 מנוע AI שיווקי מתקדם שמנתח את מה שכתבת ובונה טקסט מעוצב, ברור ומקצועי
  const handleAIEnhance = (type: 'short' | 'full' | 'specs') => {
    const rawName = name.trim() || 'המוצר';

    if (type === 'short') {
      const input = shortDesc.trim() || rawName;
      setShortDesc(`🔥 **${input}** | איכות ללא פשרות, ביצועים חלקים במיוחד ואחריות מלאה. הזמינו עכשיו במחיר משתלם!`);
    } else if (type === 'full') {
      const input = description.trim() || name || 'מוצר איכותי';
      setDescription(
        `✨ **${rawName}**\n\n` +
        `מחפשים את השילוב המושלם בין איכות, אמינות ומחיר משתלם? הגעתם למקום הנכון. ה-${rawName} מציע חווית שימוש מתקדמת, עיצוב מרשים וביצועים יוצאי דופן שיתאימו בדיוק לצרכים שלכם.\n\n` +
        `📌 **סקירה כללית:**\n${input}\n\n` +
        `🚀 **יתרונות בולטים:**\n` +
        `• **ביצועים חסרי פשרות:** עבודה חלקה, מהירה ויעילה לאורך זמן.\n` +
        `• **איכות בנייה גבוהה:** עמיד ואמין לשימוש יומיומי אינטנסיבי.\n` +
        `• **שקט נפשי:** כולל אחריות מלאה ושירות לקוחות מקצועי.\n\n` +
        `🛒 **הזמינו עכשיו ותיהנו משירות מהיר ומשלוח עד הבית!**`
      );
    } else if (type === 'specs') {
      const input = specs.trim() || 'מפרט טכני מתקדם';
      const lines = input.split('\n').map(l => l.replace(/^[•\-\*]\s*/, '').trim()).filter(Boolean);
      const formatted = lines.length > 0 
        ? lines.map(l => `• **${l.includes(':') ? l.split(':')[0] + ':' : 'מאפיין:'}** ${l.includes(':') ? l.split(':')[1] : l}`).join('\n')
        : `• **דגם:** ${rawName}\n• **תקן איכות:** אמינות גבוהה בסטנדרט מחמיר\n• **תאימות מלאה:** שימוש נוח ויעיל לכל מטרה`;
      setSpecs(formatted);
    }
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

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
    if (mainImageIdx >= index && mainImageIdx > 0) {
      setMainImageIdx(mainImageIdx - 1);
    }
  };

  const toggleVersionSelection = (verName: string) => {
    if (selectedVersions.includes(verName)) {
      setSelectedVersions(selectedVersions.filter((v) => v !== verName));
    } else {
      setSelectedVersions([...selectedVersions, verName]);
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
      alert('נא למלא שם מוצר ומחיר רגיל.');
      return;
    }

    const mainImgUrl = images.length > 0 ? images[mainImageIdx || 0] || images[0] : '';

    const productData = {
      name,
      price: parseFloat(price),
      sale_price: salePrice ? parseFloat(salePrice) : null,
      image_url: mainImgUrl,
      images: images,
      main_image_index: mainImageIdx,
      short_description: shortDesc,
      description,
      specs,
      warranty,
      storage,
      storage_options: storageOptions,
      tags: tags,
      seo_title: seoTitle,
      seo_description: seoDescription,
      stock: parseInt(stock) || 0,
      category,
      brand,
      kosher: kosherStatus,
      product_versions: selectedVersions,
      version: selectedVersions[0] || '',
      product_colors: productColors,
      is_published: isPublished,
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
          <p className="text-gray-500 text-sm mt-1">הוספה מתקדמת עם AI שיווקי חכם שעורך את המלל שלך בצורה מקצועית.</p>
        </div>
        {!isFormOpen && (
          <button type="button" onClick={() => { resetForm(); setIsFormOpen(true); }} className="bg-black text-white px-6 py-3 rounded-2xl text-xs font-bold hover:bg-gray-800 transition cursor-pointer">
            + הוסף מוצר חדש
          </button>
        )}
      </div>

      {isFormOpen && (
        <div className="bg-white rounded-3xl p-6 md:p-8 border shadow-sm space-y-6">
          <div className="flex justify-between items-center border-b pb-4">
            <h3 className="text-lg font-black text-gray-900">{editingId ? 'עריכת מוצר ✏️' : 'הוספת מוצר חדש ➕'}</h3>
            <button type="button" onClick={resetForm} className="text-gray-400 hover:text-black font-bold text-sm cursor-pointer">ביטול ✕</button>
          </div>

          <form onSubmit={handleSave} className="space-y-5">
            {/* שם ומחירים */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-1">
                <label className="block text-xs font-bold text-gray-700 mb-1">שם המוצר *</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className="w-full border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-black" placeholder="שם המוצר..." />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">מחיר רגיל (₪) *</label>
                <input type="number" step="any" value={price} onChange={(e) => setPrice(e.target.value)} required className="w-full border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-black" placeholder="699" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1 text-red-600">מחיר מבצע (₪) - אופציונלי</label>
                <input type="number" step="any" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} className="w-full border border-red-200 bg-red-50/25 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-red-500" placeholder="549" />
              </div>
            </div>

            {/* תמונות המוצר */}
            <div className="space-y-3 pt-2 border-t">
              <label className="block text-xs font-bold text-gray-700">תמונות המוצר</label>
              <div className="flex flex-wrap gap-3 items-center">
                {images.map((url, idx) => (
                  <div key={idx} className={`relative border-2 rounded-2xl p-1 bg-gray-50 w-20 h-20 flex items-center justify-center ${mainImageIdx === idx ? 'border-black' : 'border-gray-200'}`}>
                    <img src={url} alt="" className="max-h-full object-contain" />
                    <button type="button" onClick={() => removeImage(idx)} className="absolute -top-2 -left-2 bg-red-500 text-white w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shadow">✕</button>
                    <button type="button" onClick={() => setMainImageIdx(idx)} className={`absolute bottom-1 right-1 text-[9px] px-1.5 py-0.5 rounded font-bold ${mainImageIdx === idx ? 'bg-black text-white' : 'bg-gray-200 text-gray-700'}`}>
                      {mainImageIdx === idx ? 'ראשית' : 'בחר כראשית'}
                    </button>
                  </div>
                ))}
                
                <label className="border-2 border-dashed border-gray-300 rounded-2xl w-20 h-20 flex flex-col items-center justify-center cursor-pointer hover:border-black transition text-gray-500 text-xs">
                  <span>📁 העלה</span>
                  <input type="file" accept="image/*" onChange={handleAddImageFromFile} className="hidden" />
                </label>

                <button type="button" onClick={() => { setMediaTargetType('main'); setMediaModalOpen(true); }} className="border rounded-2xl px-4 h-20 text-xs font-bold bg-gray-50 hover:bg-gray-100 transition">
                  🖼️ בחר ממאגר
                </button>
              </div>
            </div>

            {/* תיאור קצר עם AI ותצוגה מקדימה */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-gray-700">תיאור קצר</label>
                  <div className="flex bg-gray-100 p-0.5 rounded-lg text-xs">
                    <button type="button" onClick={() => setShortDescTab('edit')} className={`px-3 py-1 rounded-md font-bold transition ${shortDescTab === 'edit' ? 'bg-white shadow-xs text-black' : 'text-gray-500'}`}>עריכה</button>
                    <button type="button" onClick={() => setShortDescTab('preview')} className={`px-3 py-1 rounded-md font-bold transition ${shortDescTab === 'preview' ? 'bg-white shadow-xs text-black' : 'text-gray-500'}`}>👀 תצוגה מקדימה</button>
                  </div>
                </div>
                <button type="button" onClick={() => handleAIEnhance('short')} className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-3 py-1 rounded-xl text-[11px] font-black transition cursor-pointer">✨ שפר וערוך עם AI</button>
              </div>

              {shortDescTab === 'edit' ? (
                <input type="text" value={shortDesc} onChange={(e) => setShortDesc(e.target.value)} className="w-full border rounded-xl px-4 py-2 text-sm outline-none" placeholder="כתוב כאן תיאור קצר..." />
              ) : (
                <div className="w-full border rounded-xl p-3 bg-gray-50 text-xs text-gray-800 whitespace-pre-line leading-relaxed">
                  {shortDesc ? shortDesc : <span className="text-gray-400 italic">טרם הוזן תיאור קצר.</span>}
                </div>
              )}
            </div>

            {/* תיאור מלא עם AI ותצוגה מקדימה */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-gray-700">תיאור מלא</label>
                  <div className="flex bg-gray-100 p-0.5 rounded-lg text-xs">
                    <button type="button" onClick={() => setDescTab('edit')} className={`px-3 py-1 rounded-md font-bold transition ${descTab === 'edit' ? 'bg-white shadow-xs text-black' : 'text-gray-500'}`}>עריכה</button>
                    <button type="button" onClick={() => setDescTab('preview')} className={`px-3 py-1 rounded-md font-bold transition ${descTab === 'preview' ? 'bg-white shadow-xs text-black' : 'text-gray-500'}`}>👀 תצוגה מקדימה</button>
                  </div>
                </div>
                <button type="button" onClick={() => handleAIEnhance('full')} className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-3 py-1 rounded-xl text-[11px] font-black transition cursor-pointer">✨ שפר וערוך עם AI</button>
              </div>

              {descTab === 'edit' ? (
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={6} className="w-full border rounded-xl px-4 py-2.5 text-sm outline-none" placeholder="כתוב כאן פירוט מלא..." />
              ) : (
                <div className="w-full border rounded-xl p-4 bg-gray-50 min-h-[120px] text-xs text-gray-800 whitespace-pre-line leading-relaxed">
                  {description ? description : <span className="text-gray-400 italic">טרם הוזן תיאור מלא.</span>}
                </div>
              )}
            </div>

            {/* מפרט טכני עם AI ותצוגה מקדימה */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-gray-700">מפרט טכני</label>
                  <div className="flex bg-gray-100 p-0.5 rounded-lg text-xs">
                    <button type="button" onClick={() => setSpecsTab('edit')} className={`px-3 py-1 rounded-md font-bold transition ${specsTab === 'edit' ? 'bg-white shadow-xs text-black' : 'text-gray-500'}`}>עריכה</button>
                    <button type="button" onClick={() => setSpecsTab('preview')} className={`px-3 py-1 rounded-md font-bold transition ${specsTab === 'preview' ? 'bg-white shadow-xs text-black' : 'text-gray-500'}`}>👀 תצוגה מקדימה</button>
                  </div>
                </div>
                <button type="button" onClick={() => handleAIEnhance('specs')} className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-3 py-1 rounded-xl text-[11px] font-black transition cursor-pointer">✨ שפר וערוך עם AI</button>
              </div>

              {specsTab === 'edit' ? (
                <textarea value={specs} onChange={(e) => setSpecs(e.target.value)} rows={4} className="w-full border rounded-xl px-4 py-2 text-sm outline-none" placeholder="כתוב כאן מפרט טכני (כל שורה תהפוך לנקודה בולטת)..." />
              ) : (
                <div className="w-full border rounded-xl p-4 bg-gray-50 min-h-[80px] text-xs text-gray-800 whitespace-pre-line leading-relaxed">
                  {specs ? specs : <span className="text-gray-400 italic">טרם הוזן מפרט טכני.</span>}
                </div>
              )}
            </div>

            {/* אחריות ומלאי */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">אחריות</label>
                <input type="text" value={warranty} onChange={(e) => setWarranty(e.target.value)} className="w-full border rounded-xl px-4 py-2 text-sm outline-none" placeholder="למשל: שנה אחריות יבואן" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">כמות במלאי</label>
                <input type="number" value={stock} onChange={(e) => setStock(e.target.value)} className="w-full border rounded-xl px-4 py-2 text-sm outline-none" placeholder="10" />
              </div>
            </div>

            {/* קטגוריה, מותג וכשרות */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">קטגוריה</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full border rounded-xl px-4 py-2 text-sm outline-none bg-white">
                  <option value="">בחר קטגוריה</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">מותג</label>
                <select value={brand} onChange={(e) => setBrand(e.target.value)} className="w-full border rounded-xl px-4 py-2 text-sm outline-none bg-white">
                  <option value="">בחר מותג</option>
                  {brandsList.map((b) => (
                    <option key={b.id} value={b.name}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">כשרות</label>
                <select value={kosherStatus} onChange={(e) => setKosherStatus(e.target.value)} className="w-full border rounded-xl px-4 py-2 text-sm outline-none bg-white">
                  <option value="">בחר כשרות</option>
                  {kosherList.map((k) => (
                    <option key={k.id} value={k.name}>{k.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* נפחי אחסון וגרסאות */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">אפשרויות נפח אחסון (מופרד בפסיקים)</label>
                <input type="text" value={storageOptions} onChange={(e) => setStorageOptions(e.target.value)} className="w-full border rounded-xl px-4 py-2 text-sm outline-none" placeholder="128GB, 256GB, 512GB" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">גרסאות מכשיר</label>
                <div className="flex flex-wrap gap-2 pt-1">
                  {versionsList.map((ver) => (
                    <button
                      key={ver.id}
                      type="button"
                      onClick={() => toggleVersionSelection(ver.name)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${selectedVersions.includes(ver.name) ? 'bg-black text-white border-black' : 'bg-gray-50 text-gray-700 border-gray-200'}`}
                    >
                      {ver.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* צבעים פיזיים */}
            <div className="space-y-3 pt-3 border-t">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-gray-700">צבעים פיזיים ותמונות מותאמות לצבע</label>
                <button type="button" onClick={addColorRow} className="bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-xl text-xs font-bold transition">+ הוסף צבע</button>
              </div>
              <div className="space-y-2">
                {productColors.map((col, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-gray-50 p-2 rounded-2xl border">
                    <input type="color" value={col.hex} onChange={(e) => updateColorRow(idx, 'hex', e.target.value)} className="w-8 h-8 rounded-lg cursor-pointer border-0" />
                    <input type="text" value={col.name} onChange={(e) => updateColorRow(idx, 'name', e.target.value)} placeholder="שם הצבע..." className="flex-1 border rounded-xl px-3 py-1.5 text-xs outline-none bg-white" />
                    
                    {col.image ? (
                      <img src={col.image} alt="" className="w-8 h-8 object-contain rounded-lg border bg-white" />
                    ) : (
                      <span className="text-[10px] text-gray-400">אין תמונה</span>
                    )}

                    <button type="button" onClick={() => { setActiveColorIndex(idx); setMediaTargetType('color'); setMediaModalOpen(true); }} className="bg-white border px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-gray-100 transition">
                      {col.image ? 'החלף תמונה' : 'בחר תמונה לצבע'}
                    </button>

                    <button type="button" onClick={() => removeColorRow(idx)} className="text-red-500 font-bold px-2 py-1 text-xs">✕</button>
                  </div>
                ))}
              </div>
            </div>

            {/* תגיות ו-SEO */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">תגיות (מופרד בפסיקים)</label>
                <input type="text" value={tags} onChange={(e) => setTags(e.target.value)} className="w-full border rounded-xl px-4 py-2 text-sm outline-none" placeholder="מבצע, מומלץ" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">כותרת SEO</label>
                <input type="text" value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} className="w-full border rounded-xl px-4 py-2 text-sm outline-none" placeholder="כותרת לגוגל" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">תיאור SEO</label>
                <input type="text" value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} className="w-full border rounded-xl px-4 py-2 text-sm outline-none" placeholder="תיאור קצר לגוגל" />
              </div>
            </div>

            {/* פרסום בחנות */}
            <div className="flex items-center gap-2 pt-2">
              <input type="checkbox" id="pubCheck" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} className="w-4 h-4 rounded accent-black" />
              <label htmlFor="pubCheck" className="text-xs font-bold text-gray-800 cursor-pointer">הצג מוצר זה בחנות (פעיל)</label>
            </div>

            {/* כפתורי שמירה */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <button type="button" onClick={resetForm} className="bg-gray-100 px-5 py-2.5 rounded-xl text-xs font-bold cursor-pointer">ביטול</button>
              <button type="submit" disabled={uploading} className="bg-black text-white px-6 py-2.5 rounded-xl text-xs font-bold hover:bg-gray-800 transition cursor-pointer">
                {editingId ? 'שמור שינויים' : 'הוסף מוצר לחנות'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* מודל בחירת תמונה ממאגר המדיה */}
      {mediaModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-4 max-h-[80vh] overflow-y-auto" dir="rtl">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-black text-base">בחר תמונה ממאגר המדיה</h3>
              <button onClick={() => setMediaModalOpen(false)} className="text-gray-400 hover:text-black font-bold">✕</button>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {mediaList.map((m) => (
                <div key={m.id} onClick={() => selectMediaFromLibrary(m.url)} className="border rounded-2xl p-2 bg-gray-50 h-28 flex items-center justify-center cursor-pointer hover:border-black transition">
                  <img src={m.url} alt="" className="max-h-full object-contain" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* טבלת מוצרים קיימים */}
      <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
        <div className="p-4 border-b font-black text-sm">רשימת מוצרים קיימים ({products.length})</div>
        <div className="divide-y">
          {products.map((p) => (
            <div key={p.id} className="p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <img src={p.image_url || 'https://via.placeholder.com/150'} alt="" className="w-12 h-12 object-contain rounded-xl bg-gray-50 border p-1" />
                <div>
                  <h4 className="font-bold text-sm">{p.name}</h4>
                  <div className="flex items-center gap-2 text-xs">
                    {p.sale_price ? (
                      <>
                        <span className="font-black text-red-600">₪{p.sale_price}</span>
                        <span className="text-gray-400 line-through">₪{p.price}</span>
                      </>
                    ) : (
                      <span className="font-black text-gray-900">₪{p.price}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => handleEdit(p)} className="bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer">עריכה</button>
                <button onClick={() => handleDelete(p.id)} className="bg-red-50 text-red-600 hover:bg-red-100 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer">מחיקה</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
