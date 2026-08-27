'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function AdminProductsFullManager() {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [product, setProduct] = useState({
    name: '',
    price: '',
    category: '',
    brand: '',
    kosher: 'ועדת הרבנים המאושרת',
    stock: '',
    short_description: '',
    description: '',
    specs: '',
    image_urls: [] as string[],
    seo_title: '',
    seo_description: ''
  });

  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchProducts();
    fetchCategoriesAndBrands();
  }, []);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase.from('products').select('*');
      if (error) throw error;
      if (data) setProducts(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchCategoriesAndBrands = async () => {
    try {
      const catRes = await supabase.from('categories').select('*');
      if (catRes.data) setCategories(catRes.data);

      const brandRes = await supabase.from('brands').select('*');
      if (brandRes.data) setBrands(brandRes.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleMultipleImagesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      const files = e.target.files;
      if (!files || files.length === 0) return;

      const newUrls: string[] = [...product.image_urls];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${i}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
          .from('product-images')
          .getPublicUrl(filePath);

        if (data?.publicUrl) {
          newUrls.push(data.publicUrl);
        }
      }

      setProduct({ ...product, image_urls: newUrls });
      setMessage('התמונות הועלו בהצלחה!');
    } catch (err: any) {
      alert('שגיאה בהעלאת תמונות: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (indexToRemove: number) => {
    setProduct({
      ...product,
      image_urls: product.image_urls.filter((_, index) => index !== indexToRemove)
    });
  };

  const setAsPrimaryImage = (indexToSet: number) => {
    const urls = [...product.image_urls];
    const [selectedUrl] = urls.splice(indexToSet, 1);
    urls.unshift(selectedUrl);
    setProduct({ ...product, image_urls: urls });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const productData = {
        name: product.name,
        price: Number(product.price),
        category: product.category || categories[0]?.name || 'כללי',
        brand: product.brand || brands[0]?.name || 'כללי',
        kosher: product.kosher,
        stock: Number(product.stock),
        short_description: product.short_description,
        description: product.description,
        specs: product.specs,
        image_url: product.image_urls[0] || '',
        image_urls: product.image_urls,
        seo_title: product.seo_title,
        seo_description: product.seo_description
      };

      if (editingId) {
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', editingId);

        if (error) throw error;
        setMessage('המוצר עודכן בהצלחה!');
      } else {
        const { error } = await supabase.from('products').insert([productData]);
        if (error) throw error;
        setMessage('המוצר נוסף בהצלחה לחנות!');
      }

      resetForm();
      fetchProducts();
    } catch (err: any) {
      console.error(err);
      setMessage('שגיאה בשמירת המוצר: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (p: any) => {
    setEditingId(p.id);
    setProduct({
      name: p.name || '',
      price: p.price || '',
      category: p.category || '',
      brand: p.brand || '',
      kosher: p.kosher || 'ועדת הרבנים המאושרת',
      stock: p.stock || '',
      short_description: p.short_description || '',
      description: p.description || '',
      specs: p.specs || '',
      image_urls: p.image_urls || (p.image_url ? [p.image_url] : []),
      seo_title: p.seo_title || '',
      seo_description: p.seo_description || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק מוצר זה?')) return;
    try {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
      fetchProducts();
    } catch (err: any) {
      alert('שגיאה במחיקת המוצר: ' + err.message);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setProduct({
      name: '',
      price: '',
      category: categories[0]?.name || '',
      brand: brands[0]?.name || '',
      kosher: 'ועדת הרבנים המאושרת',
      stock: '',
      short_description: '',
      description: '',
      specs: '',
      image_urls: [],
      seo_title: '',
      seo_description: ''
    });
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">
          {editingId ? "עריכת מוצר קיים" : "ניהול והוספת מוצרים מתקדם"}
        </h1>
        {editingId && (
          <button 
            type="button" 
            onClick={resetForm} 
            className="text-xs bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg"
          >
            ביטול עריכה
          </button>
        )}
      </div>

      {message && (
        <div className={`p-4 rounded-xl text-sm font-medium ${message.includes('שגיאה') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl shadow-sm border space-y-5">
        <h2 className="text-lg font-bold text-gray-800 border-b pb-3">
          {editingId ? "עריכת פרטי המוצר" : "הוספת מוצר חדש עם בחירת מותג, קטגוריה וכשרות"}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">שם המוצר</label>
            <input 
              type="text" 
              value={product.name}
              onChange={(e) => setProduct({...product, name: e.target.value})}
              className="w-full border rounded-xl p-3 outline-none focus:ring-2 focus:ring-black"
              placeholder="לדוגמה: מכשיר כשר טאצ'"
              required 
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">מחיר (₪)</label>
            <input 
              type="number" 
              value={product.price}
              onChange={(e) => setProduct({...product, price: e.target.value})}
              className="w-full border rounded-xl p-3 outline-none focus:ring-2 focus:ring-black"
              placeholder="450"
              required 
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">קטגוריה</label>
            <select
              value={product.category}
              onChange={(e) => setProduct({...product, category: e.target.value})}
              className="w-full border rounded-xl p-3 outline-none focus:ring-2 focus:ring-black bg-white"
            >
              <option value="">בחר קטגוריה...</option>
              {categories.map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">מותג</label>
            <select
              value={product.brand}
              onChange={(e) => setProduct({...product, brand: e.target.value})}
              className="w-full border rounded-xl p-3 outline-none focus:ring-2 focus:ring-black bg-white"
            >
              <option value="">בחר מותג...</option>
              {brands.map((b) => (
                <option key={b.id} value={b.name}>{b.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">רמת כשרות</label>
            <select
              value={product.kosher}
              onChange={(e) => setProduct({...product, kosher: e.target.value})}
              className="w-full border rounded-xl p-3 outline-none focus:ring-2 focus:ring-black bg-white font-medium text-blue-900"
            >
              <option value="ועדת הרבנים המאושרת">ועדת הרבנים המאושרת</option>
              <option value="הדרן">הדרן</option>
              <option value="מהודר">מהודר</option>
              <option value="אוצר ביד">אוצר ביד</option>
              <option value="נטו כשר">נטו כשר</option>
              <option value="אחר">אחר</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">כמות במלאי</label>
            <input 
              type="number" 
              value={product.stock}
              onChange={(e) => setProduct({...product, stock: e.target.value})}
              className="w-full border rounded-xl p-3 outline-none focus:ring-2 focus:ring-black"
              placeholder="10"
            />
          </div>
        </div>

        <div className="border-2 border-dashed border-gray-200 p-4 rounded-2xl bg-gray-50 space-y-3">
          <label className="block text-sm font-semibold text-gray-700">תמונות המוצר (ניתן לבחור כמה תמונות יחד)</label>
          <input 
            type="file" 
            accept="image/*"
            multiple
            onChange={handleMultipleImagesUpload}
            className="w-full text-sm file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-black file:text-white hover:file:bg-gray-800"
          />
          {uploading && <p className="text-xs text-blue-600">מעלה תמונות לענן...</p>}

          {product.image_urls.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-600">לחץ על הגדר כראשית כדי לבחור איזו תמונה תופיע ראשונה:</p>
              <div className="flex flex-wrap gap-4">
                {product.image_urls.map((url, index) => (
                  <div key={index} className="relative group bg-white p-2 rounded-xl border shadow-sm flex flex-col items-center gap-2">
                    <img src={url} alt={`תמונה ${index + 1}`} className="w-20 h-20 object-cover rounded-lg" />
                    
                    {index === 0 ? (
                      <span className="bg-black text-white text-[10px] px-2 py-0.5 rounded-full font-bold">תמונה ראשית</span>
                    ) : (
                      <button 
                        type="button"
                        onClick={() => setAsPrimaryImage(index)}
                        className="text-[10px] bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded transition"
                      >
                        הגדר כראשית
                      </button>
                    )}

                    <button 
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute -top-2 -left-2 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs shadow hover:bg-red-700"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">תיאור קצר (מופיע בכרטיס המוצר)</label>
            <input 
              type="text"
              value={product.short_description}
              onChange={(e) => setProduct({...product, short_description: e.target.value})}
              className="w-full border rounded-xl p-3 outline-none focus:ring-2 focus:ring-black"
              placeholder="משפט תיאור קצר..."
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">תיאור מלא ומפורט</label>
            <textarea 
              rows={4}
              value={product.description}
              onChange={(e) => setProduct({...product, description: e.target.value})}
              className="w-full border rounded-xl p-3 outline-none focus:ring-2 focus:ring-black"
              placeholder="כל המידע המלא שהלקוח צריך לדעת על המוצר..."
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">מפרט טכני מלא</label>
            <textarea 
              rows={3}
              value={product.specs}
              onChange={(e) => setProduct({...product, specs: e.target.value})}
              className="w-full border rounded-xl p-3 outline-none focus:ring-2 focus:ring-black"
              placeholder="מעבד, זיכרון, מסך, סוללה וכדומה..."
            />
          </div>
        </div>

        <div className="border-t pt-4 space-y-4 bg-gray-50 p-4 rounded-xl">
          <h3 className="font-bold text-gray-800 text-sm">הגדרות SEO (קידום בגוגל)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">כותרת SEO (Meta Title)</label>
              <input 
                type="text"
                value={product.seo_title}
                onChange={(e) => setProduct({...product, seo_title: e.target.value})}
                className="w-full border rounded-xl p-2.5 text-sm bg-white"
                placeholder="כותרת שתופיע בגוגל..."
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">תיאור SEO (Meta Description)</label>
              <input 
                type="text"
                value={product.seo_description}
                onChange={(e) => setProduct({...product, seo_description: e.target.value})}
                className="w-full border rounded-xl p-2.5 text-sm bg-white"
                placeholder="תיאור קצר שיופיע בתוצאות החיפוש בגוגל..."
              />
            </div>
          </div>
        </div>

        <button 
          type="submit" 
          disabled={loading || uploading}
          className="w-full bg-black text-white py-4 rounded-xl font-bold hover:bg-gray-800 transition shadow-md text-base"
        >
          {loading ? "שומר במערכת..." : (editingId ? "עדכן מוצר 💾" : "הוסף מוצר חדש לחנות 🚀")}
        </button>
      </form>

      <div className="bg-white p-6 rounded-2xl shadow-sm border space-y-4">
        <h2 className="text-lg font-bold text-gray-800">כל המוצרים במערכת ({products.length})</h2>
        {products.length === 0 ? (
          <p className="text-gray-400 text-sm">אין עדיין מוצרים במערכת.</p>
        ) : (
          <div className="space-y-3">
            {products.map((p) => (
              <div key={p.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border">
                <div className="flex items-center gap-4">
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name} className="w-12 h-12 object-cover rounded-xl border" />
                  ) : (
                    <div className="w-12 h-12 bg-gray-200 rounded-xl flex items-center justify-center text-xs text-gray-500">אין תמונה</div>
                  )}
                  <div>
                    <p className="font-bold text-gray-900">{p.name}</p>
                    <p className="text-xs text-gray-500">
                      קטגוריה: {p.category || 'כללי'} | מותג: {p.brand || 'ללא'} | כשרות: {p.kosher || 'ועדת הרבנים'} | מחיר: ₪{p.price}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleEdit(p)}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-3 py-1.5 rounded-lg text-xs font-medium transition"
                  >
                    ערוך ✏️
                  </button>
                  <button 
                    onClick={() => handleDelete(p.id)}
                    className="bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-lg text-xs font-medium transition"
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
