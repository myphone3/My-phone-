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

  // טאב תצוגה מקדימה לתיאור
  const [descTab, setDescTab] = useState<'edit' | 'preview'>('edit');

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
    setDescTab('edit');
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
    setDescTab('edit');
  };

  const handleAIEnhance = (type: 'short' | 'full') => {
    if (!name) {
      alert('נא להזין קודם את שם המוצר כדי שה-AI ידע מה לנסח.');
      return;
    }
    if (type === 'short') {
      setShortDesc(`🔥 ${name} - מכשיר מעולה באיכות גבוהה, אחריות מלאה ומחיר משתלם במיוחד! הזמינו עכשיו.`);
    } else {
      setDescription(`✨ ${name}\n\nיתרונות מרכזיים:\n• מכשיר איכותי ואמין בסטנדרט גבוה.\n• מתאים לשימוש יומיומי חלק ומהיר.\n• אחריות ושירות מלאים מחנות הסלולר.`);
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
          <p className="text-gray-500 text-sm mt-1">הוספה מתקדמת עם מחיר מבצע ותצוגה מקדימה.</p>
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
                <input type="number" step="any" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} className="w-full border border-red-200 bg-red-50/20 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-red-500" placeholder="549" />
              </div>
            </div>

            {/* תיאור מלא עם תצוגה מקדימה */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-gray-700">תיאור מלא</label>
                  <div className="flex bg-gray-100 p-0.5 rounded-lg text-xs">
                    <button type="button" onClick={() => setDescTab('edit')} className={`px-3 py-1 rounded-md font-bold transition ${descTab === 'edit' ? 'bg-white shadow-xs text-black' : 'text-gray-500'}`}>עריכה</button>
                    <button type="button" onClick={() => setDescTab('preview')} className={`px-3 py-1 rounded-md font-bold transition ${descTab === 'preview' ? 'bg-white shadow-xs text-black' : 'text-gray-500'}`}>👀 תצוגה מקדימה באתר</button>
                  </div>
                </div>
                <button type="button" onClick={() => handleAIEnhance('full')} className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-3 py-1 rounded-xl text-[11px] font-black transition">✨ שפר עם AI</button>
              </div>

              {descTab === 'edit' ? (
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5} className="w-full border rounded-xl px-4 py-2.5 text-sm outline-none" placeholder="פירוט מלא על המוצר..." />
              ) : (
                <div className="w-full border rounded-xl p-4 bg-gray-50 min-h-[120px] text-xs text-gray-800 whitespace-pre-line leading-relaxed">
                  {description ? description : <span className="text-gray-400 italic">טרם הוזן תיאור לתצוגה מקדימה.</span>}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <button type="button" onClick={resetForm} className="bg-gray-100 px-5 py-2.5 rounded-xl text-xs font-bold">ביטול</button>
              <button type="submit" disabled={uploading} className="bg-black text-white px-6 py-2.5 rounded-xl text-xs font-bold hover:bg-gray-800 transition">
                {editingId ? 'שמור שינויים' : 'הוסף מוצר לחנות'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
