'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<'products' | 'banners' | 'orders'>('products');

  // --- States for Products ---
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [category, setCategory] = useState('');
  const [brand, setBrand] = useState('');
  const [description, setDescription] = useState('');
  const [shortDesc, setShortDesc] = useState('');
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

  // --- States for Banners & Settings ---
  const [banners, setBanners] = useState<any[]>([]);
  const [bannerTitle, setBannerTitle] = useState('');
  const [bannerSubtitle, setBannerSubtitle] = useState('');
  const [bannerImgUrl, setBannerImgUrl] = useState('');
  const [linkProductId, setLinkProductId] = useState('');

  // --- States for Orders ---
  const [orders, setOrders] = useState<any[]>([]);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    const [prodRes, bannerRes, orderRes] = await Promise.all([
      supabase.from('products').select('*').order('created_at', { ascending: false }),
      supabase.from('banners').select('*').order('created_at', { ascending: false }),
      supabase.from('orders').select('*').order('created_at', { ascending: false })
    ]);

    if (prodRes.data) setProducts(prodRes.data);
    if (bannerRes.data) setBanners(bannerRes.data);
    if (orderRes.data) setOrders(orderRes.data);
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
      alert('שגיאה: ' + error.message);
      setUploading(false);
      return;
    }

    const { data } = supabase.storage.from('products').getPublicUrl(filePath);
    setImageUrl(data.publicUrl);
    setImages((prev) => [...prev, data.publicUrl]);
    setUploading(false);
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
      description,
      short_description: shortDesc,
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
      if (error) alert('שגיאה בעדכון: ' + error.message);
      else {
        alert('המוצר עודכן בהצלחה!');
        resetForm();
        fetchAllData();
      }
    } else {
      const { error } = await supabase.from('products').insert([payload]);
      if (error) alert('שגיאה בהוספה: ' + error.message);
      else {
        alert('המוצר נוסף בהצלחה!');
        resetForm();
        fetchAllData();
      }
    }
  };

  const resetForm = () => {
    setName('');
    setPrice('');
    setSalePrice('');
    setCategory('');
    setBrand('');
    setDescription('');
    setShortDesc('');
    setImageUrl('');
    setImages([]);
    setVariantsInput('');
    setSeoTitle('');
    setSeoDesc('');
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
    setDescription(prod.description || '');
    setShortDesc(prod.short_description || '');
    setImageUrl(prod.image_url || '');
    setImages(prod.images || []);
    setVariantsInput(prod.product_variants ? prod.product_variants.join(', ') : '');
    setColors(prod.product_colors || []);
    setSeoTitle(prod.seo_title || '');
    setSeoDesc(prod.seo_description || '');
    setIsPublished(prod.is_published ?? true);
    setActiveTab('products');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('האם למחוק מוצר זה?')) return;
    await supabase.from('products').delete().eq('id', id);
    fetchAllData();
  };

  const handleUpdateOrderStatus = async (orderId: string, newStatus: string) => {
    const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
    if (error) alert('שגיאה בעדכון סטטוס: ' + error.message);
    else fetchAllData();
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8" dir="rtl">
      
      {/* כותרת ראשית עליונה וניקוי כפילויות */}
      <div className="flex justify-between items-center border-b pb-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900">פאנל ניהול האתר</h1>
          <p className="text-xs text-gray-500 font-medium">ניהול מלא של מוצרים, באנרים והזמנות לקוחות.</p>
        </div>
        <Link href="/" className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-xl text-xs font-bold transition">
          חזרה לחנות ➔
        </Link>
      </div>

      {/* טאבים לניווט בפאנל הניהול */}
      <div className="flex items-center gap-3 overflow-x-auto pb-2">
        <button
          onClick={() => setActiveTab('products')}
          className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition cursor-pointer shrink-0 ${activeTab === 'products' ? 'bg-orange-600 text-white shadow-sm' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}
        >
          📦 ניהול מוצרים
        </button>
        <button
          onClick={() => setActiveTab('banners')}
          className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition cursor-pointer shrink-0 ${activeTab === 'banners' ? 'bg-orange-600 text-white shadow-sm' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}
        >
          🖼️ ניהול באנרים והגדרות
        </button>
        <button
          onClick={() => setActiveTab('orders')}
          className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition cursor-pointer shrink-0 relative ${activeTab === 'orders' ? 'bg-orange-600 text-white shadow-sm' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}
        >
          📋 ניהול הזמנות ({orders.length})
        </button>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-500 font-medium">טוען נתונים...</div>
      ) : activeTab === 'products' ? (
        /* ================= טאב מוצרים ================= */
        <div className="space-y-8">
          <div className="bg-white p-6 rounded-3xl border shadow-sm space-y-6">
            <h2 className="text-base font-black text-gray-900 border-r-4 border-orange-600 pr-3">
              {editingId ? 'עריכת מוצר קיים' : 'הוספת מוצר חדש לחנות'}
            </h2>

            <form onSubmit={handleSaveProduct} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">שם המוצר</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="שם המכשיר..." className="w-full bg-gray-50 border rounded-xl p-3 text-xs outline-none focus:border-orange-600" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">מחיר (₪)</label>
                  <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="999" className="w-full bg-gray-50 border rounded-xl p-3 text-xs outline-none focus:border-orange-600" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">מחיר מבצע</label>
                  <input type="number" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} placeholder="799" className="w-full bg-gray-50 border rounded-xl p-3 text-xs outline-none focus:border-orange-600" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">קטגוריה</label>
                  <input type="text" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="כגון: מכשירים כשרים" className="w-full bg-gray-50 border rounded-xl p-3 text-xs outline-none focus:border-orange-600" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">מותג</label>
                  <input type="text" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="כגון: Xiaomi" className="w-full bg-gray-50 border rounded-xl p-3 text-xs outline-none focus:border-orange-600" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">גרסאות / נפחי אחסון (מופרדים בפסיקים)</label>
                <input type="text" value={variantsInput} onChange={(e) => setVariantsInput(e.target.value)} placeholder="64GB, 128GB, 256GB" className="w-full bg-gray-50 border rounded-xl p-3 text-xs outline-none focus:border-orange-600" />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">העלאת תמונת מוצר</label>
                <input type="file" accept="image/*" onChange={handleImageUpload} className="w-full bg-gray-50 border rounded-xl p-2 text-xs mb-2 cursor-pointer" />
                {uploading && <p className="text-[11px] text-orange-600">מעלה...</p>}
                {imageUrl && <p className="text-[11px] text-green-600">✓ תמונה נטענה בהצלחה</p>}
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">תיאור מלא</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="תיאור מלא..." className="w-full bg-gray-50 border rounded-xl p-3 text-xs outline-none focus:border-orange-600"></textarea>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="submit" className="bg-orange-600 text-white px-6 py-3 rounded-xl text-xs font-bold hover:bg-orange-700 transition cursor-pointer">
                  {editingId ? 'עדכן מוצר' : '+ הוסף מוצר לחנות'}
                </button>
                {editingId && (
                  <button type="button" onClick={resetForm} className="bg-gray-200 text-gray-800 px-6 py-3 rounded-xl text-xs font-bold transition cursor-pointer">
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
                <div key={p.id} className="border rounded-2xl p-4 flex justify-between items-center bg-gray-50/50">
                  <div className="flex items-center gap-3">
                    <img src={p.image_url} alt="" className="w-12 h-12 object-contain bg-white rounded-lg border" />
                    <div>
                      <h4 className="font-bold text-xs">{p.name}</h4>
                      <span className="text-xs text-orange-600 font-black">₪{p.price}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 text-xs">
                    <button onClick={() => handleEdit(p)} className="text-blue-600 font-bold">עריכה</button>
                    <button onClick={() => handleDelete(p.id)} className="text-red-500 font-bold">מחיקה</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : activeTab === 'banners' ? (
        /* ================= טאב באנרים ================= */
        <div className="space-y-8">
          <div className="bg-white p-6 rounded-3xl border shadow-sm space-y-6">
            <h2 className="text-base font-black text-gray-900 border-r-4 border-orange-600 pr-3">הוספת באנר חדש</h2>
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!bannerTitle) return alert('נא להזין כותרת');
              await supabase.from('banners').insert([{ title: bannerTitle, subtitle: bannerSubtitle, image_url: bannerImgUrl, link_product_id: linkProductId || null, is_active: true }]);
              setBannerTitle(''); setBannerSubtitle(''); setBannerImgUrl('');
              fetchAllData();
              alert('הבאנר נוסף בהצלחה!');
            }} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input type="text" value={bannerTitle} onChange={(e) => setBannerTitle(e.target.value)} placeholder="כותרת ראשית..." className="bg-gray-50 border rounded-xl p-3 text-xs outline-none focus:border-orange-600" />
                <input type="text" value={bannerSubtitle} onChange={(e) => setBannerSubtitle(e.target.value)} placeholder="כותרת משנה..." className="bg-gray-50 border rounded-xl p-3 text-xs outline-none focus:border-orange-600" />
              </div>
              <input type="file" accept="image/*" onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const path = `banners/${Date.now()}.${file.name.split('.').pop()}`;
                await supabase.storage.from('products').upload(path, file);
                const { data } = supabase.storage.from('products').getPublicUrl(path);
                setBannerImgUrl(data.publicUrl);
              }} className="bg-gray-50 border rounded-xl p-2 text-xs w-full" />
              <button type="submit" className="bg-black text-white px-6 py-3 rounded-xl text-xs font-bold">+ הוסף באנר</button>
            </form>
          </div>

          <div className="bg-white p-6 rounded-3xl border shadow-sm space-y-4">
            <h2 className="text-base font-black text-gray-900 border-r-4 border-orange-600 pr-3">באנרים קיימים</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {banners.map((b) => (
                <div key={b.id} className="border rounded-2xl p-4 flex justify-between items-center bg-gray-50/50">
                  <div>
                    <h3 className="font-black text-sm">{b.title}</h3>
                    <p className="text-xs text-gray-500">{b.subtitle}</p>
                  </div>
                  <button onClick={async () => { await supabase.from('banners').delete().eq('id', b.id); fetchAllData(); }} className="bg-red-50 text-red-600 px-3 py-1.5 rounded-xl text-xs font-bold">מחיקה</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* ================= טאב הזמנות ================= */
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border shadow-sm space-y-6">
            <h2 className="text-base font-black text-gray-900 border-r-4 border-orange-600 pr-3">הזמנות לקוחות שנכנסו לחנות ({orders.length})</h2>
            
            {orders.length === 0 ? (
              <p className="text-xs text-gray-500 py-10 text-center">אין הזמנות חדשות במערכת כרגע.</p>
            ) : (
              <div className="space-y-4">
                {orders.map((order) => (
                  <div key={order.id} className="border rounded-2xl p-5 bg-gray-50/50 space-y-3">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-3 gap-2">
                      <div>
                        <h3 className="font-black text-sm text-gray-900">לקוח: {order.customer_name}</h3>
                        <p className="text-xs text-gray-600">📞 טלפון: <span className="font-bold">{order.phone}</span> | 📍 כתובת: <span className="font-bold">{order.address}</span></p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-400">{new Date(order.created_at).toLocaleString('he-IL')}</span>
                        <select
                          value={order.status || 'חדש'}
                          onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value)}
                          className="bg-white border rounded-xl px-3 py-1.5 text-xs font-bold outline-none focus:border-orange-600"
                        >
                          <option value="חדש">חדש 🟡</option>
                          <option value="בטיפול">בטיפול 🔵</option>
                          <option value="הושלם">הושלם 🟢</option>
                          <option value="בוטל">בוטל 🔴</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <span className="text-xs font-bold text-gray-700 block">מוצרים בהזמנה:</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {order.items?.map((item: any, idx: number) => (
                          <div key={idx} className="bg-white border rounded-xl p-2.5 flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              {item.image_url && <img src={item.image_url} alt="" className="w-8 h-8 object-contain rounded border" />}
                              <div>
                                <span className="font-bold block truncate max-w-[150px]">{item.name}</span>
                                <span className="text-[10px] text-gray-500">
                                  {item.selectedVariant && `גרסה: ${item.selectedVariant} `}
                                  {item.selectedColor && `צבע: ${item.selectedColor.name}`}
                                  {` | כמות: ${item.quantity || 1}`}
                                </span>
                              </div>
                            </div>
                            <span className="font-black text-orange-600">₪{(item.sale_price || item.price || 0) * (item.quantity || 1)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t text-sm font-black">
                      <span>סה״כ לתשלום בהזמנה:</span>
                      <span className="text-orange-600 text-base">₪{order.total_price}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
