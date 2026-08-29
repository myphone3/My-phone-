'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function AdminPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [kosherOptions, setKosherOptions] = useState<any[]>([]);
  const [mediaFiles, setMediaFiles] = useState<string[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [uploadingMain, setUploadingMain] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [showMediaPickerModal, setShowMediaPickerModal] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<'main' | 'gallery'>('main');

  const [relatedSearch, setRelatedSearch] = useState('');
  const [upsellSearch, setUpsellSearch] = useState('');

  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('');
  const [brand, setBrand] = useState('');
  const [kosher, setKosher] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [shortDesc, setShortDesc] = useState('');
  const [description, setDescription] = useState('');
  const [specs, setSpecs] = useState('');
  
  const [warranty, setWarranty] = useState('');
  const [version, setVersion] = useState('');
  const [storage, setStorage] = useState('');
  const [colors, setColors] = useState('');
  const [stock, setStock] = useState('10');
  
  const [colorImages, setColorImages] = useState<Record<string, string>>({});
  const [relatedIds, setRelatedIds] = useState<string[]>([]);
  const [upsellProductId, setUpsellProductId] = useState('');
  const [upsellPrice, setUpsellPrice] = useState('');

  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [seoKeywords, setSeoKeywords] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
    fetchMediaFiles();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data: prodData } = await supabase.from('products').select('*').order('id', { ascending: false });
    const { data: catData } = await supabase.from('categories').select('*');
    const { data: brandData } = await supabase.from('brands').select('*');
    const { data: kosherData } = await supabase.from('kosher_options').select('*');

    if (prodData) setProducts(prodData);
    if (catData) setCategories(catData);
    if (brandData) setBrands(brandData);
    if (kosherData) setKosherOptions(kosherData);
    setLoading(false);
  };

  const fetchMediaFiles = async () => {
    const { data } = await supabase.storage.from('product-images').list('', { limit: 200 });
    if (data) {
      const urls = data.map(file => {
        const { data: pub } = supabase.storage.from('product-images').getPublicUrl(file.name);
        return pub.publicUrl;
      });
      setMediaFiles(urls);
    }
  };

  const handleMainImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadingMain(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `prod_main_${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('product-images').upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data: pubData } = supabase.storage.from('product-images').getPublicUrl(fileName);
      if (pubData) {
        setImageUrl(pubData.publicUrl);
        fetchMediaFiles();
      }
    } catch (err: any) {
      alert('שגיאה: ' + err.message);
    } finally {
      setUploadingMain(false);
    }
  };

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    try {
      setUploadingGallery(true);
      const newUrls: string[] = [...imageUrls];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `prod_gal_${Date.now()}_${i}_${Math.random().toString(36).substring(2)}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('product-images').upload(fileName, file);
        if (uploadError) throw uploadError;
        const { data: pubData } = supabase.storage.from('product-images').getPublicUrl(fileName);
        if (pubData) newUrls.push(pubData.publicUrl);
      }
      setImageUrls(newUrls);
      fetchMediaFiles();
    } catch (err: any) {
      alert('שגיאה: ' + err.message);
    } finally {
      setUploadingGallery(false);
    }
  };

  const selectExistingImage = (url: string) => {
    if (pickerTarget === 'main') {
      setImageUrl(url);
    } else {
      setImageUrls([...imageUrls, url]);
    }
    setShowMediaPickerModal(false);
  };

  const removeGalleryImage = (indexToRemove: number) => {
    setImageUrls(imageUrls.filter((_, index) => index !== indexToRemove));
  };

  const handleRelatedToggle = (id: string) => {
    if (relatedIds.includes(id)) {
      setRelatedIds(relatedIds.filter(item => item !== id));
    } else {
      setRelatedIds([...relatedIds, id]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalMainImage = imageUrl || imageUrls[0] || '';
    const finalImageUrls = imageUrls.length > 0 ? imageUrls : (finalMainImage ? [finalMainImage] : []);

    const productData = {
      name,
      price: parseFloat(price) || 0,
      category,
      brand,
      kosher,
      image_url: finalMainImage,
      image_urls: finalImageUrls,
      short_description: shortDesc,
      description,
      specs,
      warranty,
      version,
      storage,
      colors,
      stock: parseInt(stock) || 0,
      color_images: colorImages,
      related_ids: relatedIds,
      upsell_product_id: upsellProductId || null,
      upsell_price: upsellPrice ? parseFloat(upsellPrice) : null,
      seo_title: seoTitle,
      seo_description: seoDescription,
      seo_keywords: seoKeywords,
    };

    if (editingId) {
      const { error } = await supabase.from('products').update(productData).eq('id', editingId);
      if (error) alert('שגיאה: ' + error.message);
      else { alert('המוצר עודכן בהצלחה! 🎉'); resetForm(); fetchData(); }
    } else {
      const { error } = await supabase.from('products').insert([productData]);
      if (error) alert('שגיאה: ' + error.message);
      else { alert('המוצר נוסף בהצלחה! 📦'); resetForm(); fetchData(); }
    }
  };

  const handleEdit = (p: any) => {
    setEditingId(p.id);
    setName(p.name || '');
    setPrice(p.price || '');
    setCategory(p.category || '');
    setBrand(p.brand || '');
    setKosher(p.kosher || '');
    setImageUrl(p.image_url || '');

    let parsedGallery: string[] = [];
    if (Array.isArray(p.image_urls)) {
      parsedGallery = p.image_urls;
    } else if (typeof p.image_urls === 'string') {
      try { parsedGallery = JSON.parse(p.image_urls); } catch (e) { parsedGallery = p.image_urls.split(',').map((s: string) => s.trim()).filter(Boolean); }
    }
    setImageUrls(parsedGallery.length > 0 ? parsedGallery : (p.image_url ? [p.image_url] : []));

    setShortDesc(p.short_description || '');
    setDescription(p.description || '');
    setSpecs(p.specs || '');
    setWarranty(p.warranty || '');
    setVersion(p.version || '');
    setStorage(p.storage || '');
    setColors(p.colors || '');
    setStock(p.stock !== undefined && p.stock !== null ? p.stock.toString() : '10');
    setColorImages(p.color_images || {});
    setRelatedIds(p.related_ids || []);
    setUpsellProductId(p.upsell_product_id || '');
    setUpsellPrice(p.upsell_price ? p.upsell_price.toString() : '');
    setSeoTitle(p.seo_title || '');
    setSeoDescription(p.seo_description || '');
    setSeoKeywords(p.seo_keywords || '');
    setIsFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('האם למחוק מוצר זה?')) return;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) alert('שגיאה במחיקה: ' + error.message);
    else fetchData();
  };

  const resetForm = () => {
    setEditingId(null); setName(''); setPrice(''); setCategory(''); setBrand('');
    setKosher(''); setImageUrl(''); setImageUrls([]); setShortDesc('');
    setDescription(''); setSpecs(''); setWarranty(''); setVersion(''); setStorage('');
    setColors(''); setStock('10'); setColorImages({}); setRelatedIds([]); setUpsellProductId(''); setUpsellPrice('');
    setSeoTitle(''); setSeoDescription(''); setSeoKeywords('');
    setIsFormOpen(false);
  };

  const filteredProducts = products.filter(p => 
    p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.brand?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectableProducts = products.filter(p => p.id !== editingId);
  const filteredRelatedOptions = selectableProducts.filter(p => p.name?.toLowerCase().includes(relatedSearch.toLowerCase()));
  const filteredUpsellOptions = selectableProducts.filter(p => p.name?.toLowerCase().includes(upsellSearch.toLowerCase()));
  const colorList = colors ? colors.split(',').map(c => c.trim()).filter(Boolean) : [];

  return (
    <div className="space-y-8 pb-12" dir="rtl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border">
        <div>
          <h1 className="text-2xl font-black text-gray-900">ניהול מוצרים 📦</h1>
          <p className="text-gray-500 text-sm mt-1">נהל את כל המוצרים בחנות, הוסף חדשים ועדכן מלאי ומבצעים.</p>
        </div>
        {!isFormOpen && (
          <button 
            onClick={() => { resetForm(); setIsFormOpen(true); }}
            className="bg-black text-white px-6 py-3 rounded-xl font-bold hover:bg-gray-800 transition shadow-md flex items-center gap-2"
          >
            <span>הוסף מוצר חדש</span>
            <span className="text-lg">➕</span>
          </button>
        )}
      </div>

      {isFormOpen && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl shadow-sm border space-y-6">
          <div className="flex justify-between items-center border-b pb-3">
            <h2 className="text-lg font-bold text-gray-800">
              {editingId ? 'עריכת מוצר קיים ✏️' : 'הוספת מוצר חדש ➕'}
            </h2>
            <button 
              type="button" 
              onClick={resetForm}
              className="text-gray-400 hover:text-gray-700 font-bold text-sm bg-gray-100 px-3 py-1.5 rounded-lg"
            >
              סגור טופס ✕
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">שם המוצר</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="שם המוצר..." className="w-full border rounded-xl p-3 outline-none focus:ring-2 focus:ring-black" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">מחיר (₪)</label>
              <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" className="w-full border rounded-xl p-3 outline-none focus:ring-2 focus:ring-black" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">קטגוריה</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full border rounded-xl p-3 outline-none focus:ring-2 focus:ring-black bg-white">
                <option value="">בחר קטגוריה...</option>
                {categories.map((c) => (<option key={c.id} value={c.name}>{c.name}</option>))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">מותג</label>
              <select value={brand} onChange={(e) => setBrand(e.target.value)} className="w-full border rounded-xl p-3 outline-none focus:ring-2 focus:ring-black bg-white">
                <option value="">בחר מותג...</option>
                {brands.map((b) => (<option key={b.id} value={b.name}>{b.name}</option>))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">כשרות</label>
              <select value={kosher} onChange={(e) => setKosher(e.target.value)} className="w-full border rounded-xl p-3 outline-none focus:ring-2 focus:ring-black bg-white">
                <option value="">בחר כשרות...</option>
                {kosherOptions.map((k) => (<option key={k.id} value={k.name}>{k.name}</option>))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">אחריות</label>
              <input type="text" value={warranty} onChange={(e) => setWarranty(e.target.value)} placeholder="זמן אחריות..." className="w-full border rounded-xl p-3 outline-none focus:ring-2 focus:ring-black" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">גרסה</label>
              <input type="text" value={version} onChange={(e) => setVersion(e.target.value)} placeholder="הקלד גרסה..." className="w-full border rounded-xl p-3 outline-none focus:ring-2 focus:ring-black" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">נפח אחסון</label>
              <input type="text" value={storage} onChange={(e) => setStorage(e.target.value)} placeholder="הקלד נפח אחסון..." className="w-full border rounded-xl p-3 outline-none focus:ring-2 focus:ring-black" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">צבעים (מופרדים בפסיקים `,`)</label>
              <input type="text" value={colors} onChange={(e) => setColors(e.target.value)} placeholder="שחור, לבן, כחול..." className="w-full border rounded-xl p-3 outline-none focus:ring-2 focus:ring-black" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">כמות מלאי כללית</label>
              <input type="number" value={stock} onChange={(e) => setStock(e.target.value)} placeholder="10" className="w-full border rounded-xl p-3 outline-none focus:ring-2 focus:ring-black" />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">תמונה ראשית</label>
              <div className="flex gap-2">
                <input type="file" accept="image/*" onChange={handleMainImageUpload} className="w-full border rounded-xl p-2 text-sm bg-gray-50 cursor-pointer" />
                <button type="button" onClick={() => { setPickerTarget('main'); setShowMediaPickerModal(true); }} className="bg-gray-200 text-gray-800 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap hover:bg-gray-300">
                  בחר מהמדיה 🖼️
                </button>
              </div>
              {uploadingMain && <p className="text-xs text-blue-600 mt-1">מעלה...</p>}
              {imageUrl && <div className="mt-2 flex items-center gap-2"><img src={imageUrl} alt="" className="w-10 h-10 object-cover rounded border" /><span className="text-xs text-green-600 font-bold">נבחרה תמונה ראשית ✓</span></div>}
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-bold text-gray-700">תמונות נוספות לגלריה</label>
              <button type="button" onClick={() => { setPickerTarget('gallery'); setShowMediaPickerModal(true); }} className="bg-gray-200 text-gray-800 px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-gray-300">
                הוסף מהמדיה הקיימת 🖼️
              </button>
            </div>
            <input type="file" accept="image/*" multiple onChange={handleGalleryUpload} className="w-full border rounded-xl p-2 text-sm bg-gray-50 cursor-pointer" />
            {uploadingGallery && <p className="text-xs text-blue-600 mt-1">מעלה תמונות...</p>}
            {imageUrls.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {imageUrls.map((url, index) => (
                  <div key={index} className="relative w-16 h-16 rounded-lg border overflow-hidden bg-gray-100">
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    <button type="button" onClick={() => removeGalleryImage(index)} className="absolute top-0 right-0 bg-red-600 text-white w-5 h-5 flex items-center justify-center text-xs">×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {colorList.length > 0 && (
            <div className="bg-gray-50 p-4 rounded-2xl border space-y-3">
              <h3 className="text-sm font-bold text-gray-900 border-b pb-2">🎨 התאמת תמונה לפי צבע</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {colorList.map((color) => (
                  <div key={color} className="bg-white p-3 rounded-xl border space-y-2">
                    <span className="text-xs font-bold text-gray-800 block">צבע: {color}</span>
                    <div className="flex items-center gap-2">
                      <select 
                        value={colorImages[color] || ''} 
                        onChange={(e) => setColorImages({ ...colorImages, [color]: e.target.value })}
                        className="w-full border rounded-lg p-2 text-xs bg-gray-50 outline-none"
                      >
                        <option value="">בחר תמונה לצבע...</option>
                        {imageUrls.concat(imageUrl ? [imageUrl] : []).map((imgUrl, i) => (
                          <option key={i} value={imgUrl}>תמונה #{i + 1} ({imgUrl.slice(-15)})</option>
                        ))}
                      </select>
                    </div>
                    {colorImages[color] && (
                      <img src={colorImages[color]} alt={color} className="w-10 h-10 object-cover rounded border" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">תיאור קצר</label>
            <input type="text" value={shortDesc} onChange={(e) => setShortDesc(e.target.value)} placeholder="תיאור קצר..." className="w-full border rounded-xl p-3 outline-none focus:ring-2 focus:ring-black" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">תיאור מלא</label>
              <textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="תיאור מורחב..." className="w-full border rounded-xl p-3 outline-none focus:ring-2 focus:ring-black" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">מפרט טכני</label>
              <textarea rows={4} value={specs} onChange={(e) => setSpecs(e.target.value)} placeholder="נתונים טכניים..." className="w-full border rounded-xl p-3 outline-none focus:ring-2 focus:ring-black font-mono text-sm" />
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-2xl border space-y-4">
            <h3 className="text-sm font-bold text-gray-900 border-b pb-2">🎁 הגדרת פופ-אפ מבצע בעגלה</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-700">חפש ובחר מוצר מוצע במבצע</label>
                <input type="text" value={upsellSearch} onChange={(e) => setUpsellSearch(e.target.value)} placeholder="🔍 חפש מוצר לפופ-אפ..." className="w-full border rounded-xl p-2.5 text-xs bg-white outline-none focus:ring-2 focus:ring-black" />
                <select value={upsellProductId} onChange={(e) => setUpsellProductId(e.target.value)} className="w-full border rounded-xl p-2.5 bg-white outline-none focus:ring-2 focus:ring-black text-sm">
                  <option value="">ללא מוצר מבצע</option>
                  {filteredUpsellOptions.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} (₪{p.price})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">מחיר מבצע מיוחד (₪)</label>
                <input type="number" value={upsellPrice} onChange={(e) => setUpsellPrice(e.target.value)} placeholder="למשל: 49" className="w-full border rounded-xl p-2.5 bg-white outline-none focus:ring-2 focus:ring-black mt-6" />
              </div>
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-2xl border space-y-3">
            <h3 className="text-sm font-bold text-gray-900 border-b pb-2">⭐ פריטים שאולי יעניינו אותך</h3>
            <input type="text" value={relatedSearch} onChange={(e) => setRelatedSearch(e.target.value)} placeholder="🔍 חפש מוצרים רלוונטיים..." className="w-full md:w-80 border rounded-xl p-2.5 text-xs bg-white outline-none focus:ring-2 focus:ring-black" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-48 overflow-y-auto p-2 bg-white rounded-xl border">
              {filteredRelatedOptions.map((p) => (
                <label key={p.id} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-xs ${relatedIds.includes(p.id) ? 'bg-black text-white border-black' : 'bg-gray-50'}`}>
                  <input type="checkbox" checked={relatedIds.includes(p.id)} onChange={() => handleRelatedToggle(p.id)} className="hidden" />
                  <span className="truncate">{p.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" className="bg-black text-white px-6 py-3 rounded-xl font-bold hover:bg-gray-800 transition shadow-md">
              {editingId ? 'עדכן מוצר 💾' : 'שמור מוצר חדש 🚀'}
            </button>
            <button type="button" onClick={resetForm} className="bg-gray-200 text-gray-700 px-6 py-3 rounded-xl font-bold">ביטול ❌</button>
          </div>
        </form>
      )}

      {showMediaPickerModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-3xl w-full max-h-[80vh] overflow-y-auto shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-bold text-gray-900">בחר תמונה מספריית המדיה 🖼️</h3>
              <button type="button" onClick={() => setShowMediaPickerModal(false)} className="bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-bold">סגור ✕</button>
            </div>
            {mediaFiles.length === 0 ? (
              <p className="text-gray-400 text-center py-8">אין תמונות בספריית המדיה.</p>
            ) : (
              <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                {mediaFiles.map((url, i) => (
                  <div key={i} onClick={() => selectExistingImage(url)} className="w-full h-28 bg-gray-50 rounded-xl border p-2 cursor-pointer hover:border-black transition flex items-center justify-center overflow-hidden">
                    <img src={url} alt="" className="w-full h-full object-contain" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="bg-white p-6 rounded-2xl shadow-sm border space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 border-b pb-4">
          <h2 className="text-lg font-bold text-gray-800">מוצרים קיימים ({filteredProducts.length})</h2>
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="🔍 חפש מוצר לפי שם, מותג או קטגוריה..." className="w-full md:w-80 border rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-black bg-gray-50" />
        </div>

        {filteredProducts.length === 0 ? (
          <p className="text-gray-400 text-sm">לא נמצאו מוצרים תואמים לחיפוש.</p>
        ) : (
          <div className="space-y-3">
            {filteredProducts.map((p) => (
              <div key={p.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-xl border">
                <div className="flex items-center gap-4">
                  <img src={p.image_url || p.image_urls?.[0]} alt="" className="w-14 h-14 object-contain bg-white rounded border p-1" />
                  <div>
                    <h3 className="font-bold text-gray-900">{p.name}</h3>
                    <span className="text-xs bg-gray-200 px-2 py-0.5 rounded">₪{p.price}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleEdit(p)} className="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg text-xs font-bold">ערוך ✏️</button>
                  <button onClick={() => handleDelete(p.id)} className="bg-red-50 text-red-600 px-3 py-1.5 rounded-lg text-xs font-bold">מחק 🗑️</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
