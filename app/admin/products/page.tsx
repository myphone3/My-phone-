'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function AdminProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [brandsList, setBrandsList] = useState<any[]>([]);
  const [kosherList, setKosherList] = useState<any[]>([]);
  const [versionsList, setVersionsList] = useState<any[]>([]);
  const [categoriesList, setCategoriesList] = useState<any[]>([]);
  const [storageFiles, setStorageFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Product Form States
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [category, setCategory] = useState('');
  const [brand, setBrand] = useState('');
  const [brandSearch, setBrandSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [kosher, setKosher] = useState('');
  const [storageVal, setStorageVal] = useState('');
  const [selectedVersions, setSelectedVersions] = useState<string[]>([]);
  const [stock, setStock] = useState('10');
  const [isDraft, setIsDraft] = useState(false);

  // מצבי אחריות
  const [showWarranty, setShowWarranty] = useState(true);
  const [warrantyDuration, setWarrantyDuration] = useState('');

  const [shortDesc, setShortDesc] = useState('');
  const [description, setDescription] = useState('');
  const [specs, setSpecs] = useState('');
  
  const [images, setImages] = useState<string[]>([]);
  const [imageUrl, setImageUrl] = useState('');
  
  const [showMediaModal, setShowMediaModal] = useState(false);
  
  const [colors, setColors] = useState<{ name: string; hex: string; image: string }[]>([
    { name: 'שחור', hex: '#000000', image: '' }
  ]);

  // מוצרים שתמיד באים יחד
  const [bundledItems, setBundledItems] = useState<{ name: string; price: string }[]>([]);

  // מוצרים שאולי יעניינו אותך + חיפוש
  const [relatedProductIds, setRelatedProductIds] = useState<string[]>([]);
  const [relatedSearch, setRelatedSearch] = useState('');

  // מוצר בהנחה בקניית מוצר (Upsell Popup) + חיפוש
  const [upsellProductId, setUpsellProductId] = useState('');
  const [upsellDiscountType, setUpsellDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [upsellDiscountValue, setUpsellDiscountValue] = useState('');
  const [upsellSearch, setUpsellSearch] = useState('');

  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');


  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [showPreviewShort, setShowPreviewShort] = useState(false);
  const [showPreviewFull, setShowPreviewFull] = useState(false);
  const [showPreviewSpecs, setShowPreviewSpecs] = useState(false);
  
  const [aiGenerating, setAiGenerating] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    
    const prodRes = await supabase.from('products').select('*').order('created_at', { ascending: false });
    const brandRes = await supabase.from('brands').select('*');
    const kosherRes = await supabase.from('kosher_options').select('*');
    const catRes = await supabase.from('categories').select('*');
    const versionRes = await supabase.from('versions').select('*');

    if (prodRes.data) setProducts(prodRes.data);
    if (brandRes.data) setBrandsList(brandRes.data);

    if (kosherRes.data) {
      setKosherList(kosherRes.data.map((k: any) => ({
        id: k.id,
        name: k.name || k.title || k.label || k.kosher_name
      })));
    }

    if (catRes.data) {
      setCategoriesList(catRes.data.map((c: any) => ({
        id: c.id,
        name: c.name || c.title || c.label
      })));
    }

    if (versionRes.data) {
      setVersionsList(versionRes.data.map((v: any) => ({
        id: v.id,
        name: v.name || v.title || v.label
      })));
    }

    let filesList: string[] = [];
    const bucketsToTry = ['products', 'media', 'public', 'images', 'uploads', 'product-images'];
    for (const bucket of bucketsToTry) {
      try {
        const storageRes = await supabase.storage.from(bucket).list('', { limit: 100 });
        if (storageRes.data && storageRes.data.length > 0) {
          const mapped = storageRes.data.map((f: any) => {
            const { data } = supabase.storage.from(bucket).getPublicUrl(f.name);
            return data.publicUrl;
          });
          filesList = [...filesList, ...mapped];
        }
      } catch (e) {}
    }
    setStorageFiles(filesList);
    setLoading(false);
  };

  const handleMultipleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const newUrls: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${i}.${fileExt}`;
      const filePath = `products/${fileName}`;

      const { error } = await supabase.storage.from('products').upload(filePath, file);
      if (!error) {
        const { data } = await supabase.storage.from('products').getPublicUrl(filePath);
        newUrls.push(data.publicUrl);
      }
    }

    const updatedImages = [...images, ...newUrls];
    setImages(updatedImages);
    if (!imageUrl && updatedImages.length > 0) setImageUrl(updatedImages[0]);
    setUploading(false);
    fetchData();
  };

    const handleAiAssistant = async () => {
    try {
      setAiGenerating(true);
      
      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      if (!apiKey) {
        alert('נא להגדיר את מפתח ה-API תחת NEXT_PUBLIC_GEMINI_API_KEY ב-Vercel');
        setAiGenerating(false);
        return;
      }

      const rawInfoText = `שם המוצר: ${name || ''}\nתיאור קצר: ${shortDesc || ''}\nתיאור מלא: ${description || ''}\nמפרט: ${specs || ''}`;

      const prompt = `אתה מומחה ניסוח, עריכה ועיצוב תוכן לחנות הסלולר והמכשירים הכשרים "NEW PHONE".
המשתמש סיפק נתונים טכניים ותיאור אמיתי על המוצר: "${name || 'מוצר'}".
המידע הגולמי שהוזן:
"""
${rawInfoText}
"""

הנחיות קריטיות לעבודה:
1. אל תמציא נתונים, תכונות או פיצ'רים שלא קיימים במידע הגולמי שהוזן. התבסס אך ורק על העובדות והנתונים האמיתיים שנמסרו.
2. התפקיד שלך הוא לקחת את הנתונים האמיתיים האלו ולערוך, לסדר ולעצב אותם בצורה מקצועית, נקייה ומשכנעת בפורמט Markdown עבור חנות "NEW PHONE".
3. החזר אך ורק אובייקט JSON תקין לחלוטין (ללא שום טקסט או מעטפת מסביב) במבנה הבא בדיוק:
{
  "shortDesc": "תיאור קצר ומדויק המבוסס על הנתונים עם אימוג'י ב-Markdown",
  "description": "סקירה מקצועית ומסודרת המבוססת אך ורק על הנתונים עם כותרות ## ב-Markdown",
  "specs": "מפרט טכני מסודר ומדויק לפי הנתונים עם נקודות • ב-Markdown",
  "seoTitle": "כותרת SEO מדויקת ומקצועית ל-NEW PHONE",
  "seoDescription": "תיאור SEO מדויק ל-NEW PHONE"
}`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json"
          }
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error?.message || 'שגיאה בתקשורת מול ג׳מיני');
      }

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error('לא התקבלה תשובה מהמודל');
      }

      let jsonStr = text.trim();
      jsonStr = jsonStr.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }

      const parsedData = JSON.parse(jsonStr);
      
      if (parsedData.shortDesc) setShortDesc(parsedData.shortDesc);
      if (parsedData.description) setDescription(parsedData.description);
      if (parsedData.specs) setSpecs(parsedData.specs);
      if (parsedData.seoTitle) setSeoTitle(parsedData.seoTitle);
      if (parsedData.seoDescription) setSeoDescription(parsedData.seoDescription);

    } catch (err: any) {
      console.error('AI error:', err);
      alert('שגיאה בהפעלת ה-AI: ' + (err.message || 'שגיאה לא ידועה'));
    } finally {
      setAiGenerating(false);
    }
  };


  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !price) {
      alert('נא למלא לפחות שם מוצר ומחיר');
      return;
    }

    const payload = {
      name,
      price: Number(price),
      sale_price: salePrice ? Number(salePrice) : null,
      category,
      brand,
      kosher,
      storage: storageVal,
      product_variants: selectedVersions,
      stock: Number(stock) || 0,
      is_published: !isDraft,
      show_warranty: showWarranty,
      warranty_duration: warrantyDuration,
      short_description: shortDesc,
      description,
      specs,
      image_url: imageUrl || images[0] || '',
      images,
      product_colors: colors,
      frequently_bought_together: bundledItems,
      related_products: relatedProductIds,
      upsell_discount_item: upsellProductId ? {
        productId: upsellProductId,
        discountType: upsellDiscountType,
        discountValue: Number(upsellDiscountValue) || 0
      } : null,
      seo_title: seoTitle,
      seo_description: seoDescription
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
    setKosher('');
    setStorageVal('');
    setSelectedVersions([]);
    setStock('10');
    setIsDraft(false);
    setShowWarranty(true);
    setWarrantyDuration('');
    setShortDesc('');
    setDescription('');
    setSpecs('');
    setImageUrl('');
    setImages([]);
    setColors([{ name: 'שחור', hex: '#000000', image: '' }]);
    setBundledItems([]);
    setRelatedProductIds([]);
    setRelatedSearch('');
    setUpsellProductId('');
    setUpsellDiscountType('percent');
    setUpsellDiscountValue('');
    setUpsellSearch('');
    setSeoTitle('');
    setSeoDescription('');
    setEditingId(null);
  };

  const handleEdit = (prod: any) => {
    setEditingId(prod.id);
    setName(prod.name || '');
    setPrice(prod.price || '');
    setSalePrice(prod.sale_price || '');
    setCategory(prod.category || '');
    setBrand(prod.brand || '');
    setKosher(prod.kosher || '');
    setStorageVal(prod.storage || '');
    setSelectedVersions(prod.product_variants || []);
    setStock(prod.stock?.toString() || '10');
    setIsDraft(prod.is_published === false);
    setShowWarranty(prod.show_warranty ?? true);
    setWarrantyDuration(prod.warranty_duration || '');
    setShortDesc(prod.short_description || '');
    setDescription(prod.description || '');
    setSpecs(prod.specs || '');
    setImageUrl(prod.image_url || '');
    setImages(prod.images || (prod.image_url ? [prod.image_url] : []));
    setColors(prod.product_colors || [{ name: 'שחור', hex: '#000000', image: '' }]);
    setBundledItems(prod.frequently_bought_together || []);
    setRelatedProductIds(prod.related_products || []);
    if (prod.upsell_discount_item) {
      setUpsellProductId(prod.upsell_discount_item.productId || '');
      setUpsellDiscountType(prod.upsell_discount_item.discountType || 'percent');
      setUpsellDiscountValue(prod.upsell_discount_item.discountValue?.toString() || '');
    } else {
      setUpsellProductId('');
      setUpsellDiscountValue('');
    }
    setSeoTitle(prod.seo_title || '');
    setSeoDescription(prod.seo_description);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('האם למחוק מוצר זה?')) return;
    await supabase.from('products').delete().eq('id', id);
    fetchData();
  };

  const parseMarkdownPreview = (text: string) => {
    if (!text) return '';
    return text
      .replace(/^## (.*$)/gm, '<h2 class="text-sm font-black text-gray-900 mt-2 mb-1">$1</h2>')
      .replace(/^### (.*$)/gm, '<h3 class="text-xs font-bold text-gray-800 mt-1 mb-1">$1</h3>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br />');
  };

  const filteredBrands = brandsList.filter(b => b.name.toLowerCase().includes(brandSearch.toLowerCase()));
  const filteredProducts = products.filter(p => p.name?.toLowerCase().includes(productSearch.toLowerCase()));

  const relatedSearchProducts = products.filter(p => p.id !== editingId && p.name?.toLowerCase().includes(relatedSearch.toLowerCase()));
  const upsellSearchProducts = products.filter(p => p.id !== editingId && p.name?.toLowerCase().includes(upsellSearch.toLowerCase()));

  if (loading) {
    return <div className="text-center py-20 text-gray-500 font-medium">טוען מוצרים...</div>;
  }

  return (
    <div className="space-y-8 max-w-full overflow-hidden" dir="rtl">
      <div className="bg-white p-6 rounded-3xl border shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-4 gap-3">
          <h2 className="text-base font-black text-gray-900 border-r-4 border-orange-600 pr-3">
            {editingId ? 'עריכת מוצר קיים' : 'הוספת מוצר חדש לחנות'}
          </h2>
          <button
            type="button"
            onClick={handleAiAssistant}
            disabled={aiGenerating}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            ✨ {aiGenerating ? 'סוכן AI מייצר תוכן...' : 'סוכן AI למילוי אוטומטי'}
          </button>
        </div>

        <form onSubmit={handleSaveProduct} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">שם המוצר <span className="text-red-500">*</span></label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="שם המכשיר..." className="w-full bg-gray-50 border rounded-xl p-3 text-xs outline-none focus:border-orange-600" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">מחיר רגיל (₪) <span className="text-red-500">*</span></label>
              <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="999" className="w-full bg-gray-50 border rounded-xl p-3 text-xs outline-none focus:border-orange-600" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">מחיר מבצע (₪)</label>
              <input type="number" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} placeholder="799" className="w-full bg-gray-50 border rounded-xl p-3 text-xs outline-none focus:border-orange-600" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">קטגוריה</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-gray-50 border rounded-xl p-3 text-xs outline-none focus:border-orange-600"
              >
                <option value="">בחר קטגוריה מהרשימה...</option>
                {categoriesList.map((cat) => (
                  <option key={cat.id} value={cat.name}>{cat.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">נפח אחסון</label>
              <input type="text" value={storageVal} onChange={(e) => setStorageVal(e.target.value)} placeholder="128GB" className="w-full bg-gray-50 border rounded-xl p-3 text-xs outline-none focus:border-orange-600" />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">מלאי (כמות יחידות)</label>
              <input type="number" value={stock} onChange={(e) => setStock(e.target.value)} placeholder="10" className="w-full bg-gray-50 border rounded-xl p-3 text-xs outline-none focus:border-orange-600" />
            </div>
          </div>

          {/* ניהול אחריות */}
          <div className="space-y-4 bg-gray-50 p-4 rounded-2xl border">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-gray-900">הצג שורת אחריות בכרטיס מוצר</span>
              <input
                type="checkbox"
                checked={showWarranty}
                onChange={(e) => setShowWarranty(e.target.checked)}
                className="w-5 h-5 accent-orange-600 cursor-pointer"
              />
            </div>

            {showWarranty && (
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-700">משך האחריות (לדוגמה: שנה / שנתיים / 3 חודשים):</label>
                <input
                  type="text"
                  value={warrantyDuration}
                  onChange={(e) => setWarrantyDuration(e.target.value)}
                  placeholder="לדוגמה: שנה"
                  className="w-full bg-white border rounded-xl p-3 text-xs outline-none focus:border-orange-600"
                />
              </div>
            )}
          </div>

          <div className="space-y-2 bg-gray-50 p-4 rounded-2xl border">
            <label className="block text-xs font-bold text-gray-700">בחר גרסאות מותרות למוצר זה:</label>
            {versionsList.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {versionsList.map((ver) => {
                  const isSelected = selectedVersions.includes(ver.name);
                  return (
                    <button
                      key={ver.id}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          setSelectedVersions(selectedVersions.filter(v => v !== ver.name));
                        } else {
                          setSelectedVersions([...selectedVersions, ver.name]);
                        }
                      }}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${isSelected ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-gray-800 border-gray-200'}`}
                    >
                      {ver.name} {isSelected ? '✓' : ''}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-gray-400">לא הוגדרו גרסאות.</p>
            )}
          </div>

          {/* מוצרים שתמיד באים יחד */}
          <div className="space-y-3 bg-gray-50 p-4 rounded-2xl border overflow-hidden">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <label className="block text-xs font-bold text-gray-700">מוצרים שתמיד באים יחד (אופציונלי)</label>
              <button
                type="button"
                onClick={() => setBundledItems([...bundledItems, { name: '', price: '' }])}
                className="bg-black text-white px-3 py-1.5 rounded-xl text-[11px] font-bold cursor-pointer"
              >
                + הוסף מוצר נלווה
              </button>
            </div>
            <div className="space-y-2">
              {bundledItems.map((bundle, idx) => (
                <div key={idx} className="flex flex-col sm:flex-row gap-2 items-center bg-white p-3 rounded-xl border w-full">
                  <input
                    type="text"
                    placeholder="שם המוצר הנלווה (לדוגמה: מגן זכוכית)"
                    value={bundle.name}
                    onChange={(e) => {
                      const updated = [...bundledItems];
                      updated[idx].name = e.target.value;
                      setBundledItems(updated);
                    }}
                    className="bg-gray-50 border rounded-lg p-2 text-xs flex-1 w-full sm:w-auto outline-none"
                  />
                  <input
                    type="number"
                    placeholder="מחיר (₪)"
                    value={bundle.price}
                    onChange={(e) => {
                      const updated = [...bundledItems];
                      updated[idx].price = e.target.value;
                      setBundledItems(updated);
                    }}
                    className="bg-gray-50 border rounded-lg p-2 text-xs w-full sm:w-28 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setBundledItems(bundledItems.filter((_, i) => i !== idx))}
                    className="text-red-500 font-bold text-xs px-2 self-end sm:self-center cursor-pointer"
                  >
                    ✕ הסר
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* מוצרים שאולי יעניינו אותך עם חיפוש */}
          <div className="space-y-3 bg-gray-50 p-4 rounded-2xl border">
            <div className="flex justify-between items-center">
              <label className="block text-xs font-bold text-gray-900">מוצרים שאולי יעניינו אותך (יוצגו בתחתית עמוד המוצר)</label>
              <span className="text-[11px] text-gray-500 font-bold">{relatedProductIds.length} נבחרו</span>
            </div>
            <input
              type="text"
              placeholder="חפש מוצר להוספה להמלצות..."
              value={relatedSearch}
              onChange={(e) => setRelatedSearch(e.target.value)}
              className="w-full bg-white border rounded-xl p-2.5 text-xs outline-none focus:border-orange-600"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 bg-white rounded-xl border">
              {relatedSearchProducts.length > 0 ? (
                relatedSearchProducts.map((p) => {
                  const isSelected = relatedProductIds.includes(p.id);
                  return (
                    <div
                      key={p.id}
                      onClick={() => {
                        if (isSelected) {
                          setRelatedProductIds(relatedProductIds.filter(id => id !== p.id));
                        } else {
                          setRelatedProductIds([...relatedProductIds, p.id]);
                        }
                      }}
                      className={`p-2 rounded-xl border text-xs cursor-pointer flex items-center justify-between gap-2 transition ${isSelected ? 'border-orange-600 bg-orange-50 font-bold' : 'border-gray-200 hover:bg-gray-50'}`}
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <img src={p.image_url || p.images?.[0]} alt="" className="w-8 h-8 object-contain bg-white rounded border p-0.5 shrink-0" />
                        <span className="truncate">{p.name}</span>
                      </div>
                      <span className="shrink-0">{isSelected ? '✓' : '+'}</span>
                    </div>
                  );
                })
              ) : (
                <p className="col-span-full text-center text-xs text-gray-400 py-4">לא נמצאו מוצרים תואמים לחיפוש.</p>
              )}
            </div>
          </div>

          {/* מוצר בהנחה בקניית מוצר (Upsell Popup) עם חיפוש ותמונות */}
          <div className="space-y-3 bg-orange-50/50 p-4 rounded-2xl border border-orange-200">
            <label className="block text-xs font-bold text-gray-900">🎁 מוצר בהנחה שיוצג בחלון קופץ בעת הוספה לעגלה (אופציונלי)</label>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <select
                value={upsellDiscountType}
                onChange={(e: any) => setUpsellDiscountType(e.target.value)}
                className="bg-white border rounded-xl p-3 text-xs outline-none"
              >
                <option value="percent">הנחת אחוזים (%)</option>
                <option value="fixed">הנחת סכום (₪)</option>
              </select>

              <input
                type="number"
                placeholder="סכום או אחוז הנחה (לדוגמה: 20)"
                value={upsellDiscountValue}
                onChange={(e) => setUpsellDiscountValue(e.target.value)}
                className="bg-white border rounded-xl p-3 text-xs outline-none"
              />
            </div>

            <div className="space-y-2">
              <input
                type="text"
                placeholder="חפש מוצר מבצע נלווה לפי שם..."
                value={upsellSearch}
                onChange={(e) => setUpsellSearch(e.target.value)}
                className="w-full bg-white border rounded-xl p-2.5 text-xs outline-none focus:border-orange-600"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 bg-white rounded-xl border">
                <div
                  onClick={() => setUpsellProductId('')}
                  className={`p-2 rounded-xl border text-xs cursor-pointer flex items-center gap-2 ${!upsellProductId ? 'border-orange-600 bg-orange-50 font-bold' : 'border-gray-200'}`}
                >
                  <span>🚫 ללא מוצר מבצע</span>
                </div>
                {upsellSearchProducts.map((p) => {
                  const isSelected = upsellProductId === p.id;
                  return (
                    <div
                      key={p.id}
                      onClick={() => setUpsellProductId(p.id)}
                      className={`p-2 rounded-xl border text-xs cursor-pointer flex items-center justify-between gap-2 transition ${isSelected ? 'border-orange-600 bg-orange-50 font-bold' : 'border-gray-200 hover:bg-gray-50'}`}
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <img src={p.image_url || p.images?.[0]} alt="" className="w-10 h-10 object-contain bg-white rounded-lg border p-0.5 shrink-0" />
                        <div className="overflow-hidden">
                          <h4 className="truncate font-bold text-gray-900">{p.name}</h4>
                          <span className="text-[11px] text-orange-600">₪{p.price}</span>
                        </div>
                      </div>
                      <span className="shrink-0">{isSelected ? '✓ בחירה פעילה' : 'בחר'}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-gray-700">בחר מותג מתוך הרשימה</label>
            <input
              type="text"
              placeholder="חפש מותג..."
              value={brandSearch}
              onChange={(e) => setBrandSearch(e.target.value)}
              className="w-full bg-gray-50 border rounded-xl p-2.5 text-xs outline-none mb-2"
            />
            <div className="flex gap-2 overflow-x-auto pb-2">
              {filteredBrands.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setBrand(b.image_url || b.name)}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-2 shrink-0 bg-white cursor-pointer ${brand === (b.image_url || b.name) ? 'border-orange-600 bg-orange-50' : 'border-gray-200'}`}
                >
                  {b.image_url && <img src={b.image_url} alt="" className="h-4 object-contain" />}
                  <span>{b.name}</span>
                </button>
              ))}
            </div>
            <input type="text" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="או הזן קישור לתמונת מותג..." className="w-full bg-gray-50 border rounded-xl p-3 text-xs outline-none" />
          </div>

          {/* כשרות */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-gray-700">בחר רמת כשרות מהרשימה המנוהלת</label>
            <select
              value={kosher}
              onChange={(e) => setKosher(e.target.value)}
              className="w-full bg-gray-50 border rounded-xl p-3 text-xs outline-none focus:border-orange-600"
            >
              <option value="">ללא כשרות / בחר מהרשימה...</option>
              {kosherList.map((k) => (
                <option key={k.id} value={k.name}>{k.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-3 bg-gray-50 p-4 rounded-2xl border">
            <label className="block text-xs font-bold text-gray-700">תמונות המוצר</label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input type="file" accept="image/*" multiple onChange={handleMultipleImageUpload} className="bg-white border rounded-xl p-2 text-xs cursor-pointer flex-1" />
              <button
                type="button"
                onClick={() => setShowMediaModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                🖼️ בחר מתוך ספריית המדיה ({storageFiles.length})
              </button>
            </div>
            {uploading && <span className="text-xs text-orange-600 font-bold">מעלה קבצים...</span>}

            {images.length > 0 && (
              <div className="space-y-1 pt-2">
                <span className="text-[11px] font-bold text-gray-600 block">תמונות שנבחרו למוצר:</span>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {images.map((img, idx) => (
                    <div key={idx} className="relative w-16 h-16 rounded-xl border bg-white shrink-0 overflow-hidden shadow-xs">
                      <img src={img} alt="" className="w-full h-full object-contain p-1" />
                      <button
                        type="button"
                        onClick={() => setImages(images.filter((_, i) => i !== idx))}
                        className="absolute top-0 right-0 bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded-bl cursor-pointer font-bold"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {showMediaModal && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
              <div className="bg-white w-full max-w-2xl rounded-3xl p-6 space-y-4 shadow-xl max-h-[80vh] flex flex-col" dir="rtl">
                <div className="flex justify-between items-center border-b pb-3">
                  <h3 className="font-black text-sm text-gray-900">בחר תמונות מתוך ספריית המדיה של האתר</h3>
                  <button
                    type="button"
                    onClick={() => setShowMediaModal(false)}
                    className="bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    סגור ✕
                  </button>
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-6 gap-3 overflow-y-auto p-2 flex-1">
                  {storageFiles.map((url, idx) => {
                    const isSelected = images.includes(url);
                    return (
                      <div
                        key={idx}
                        onClick={() => {
                          if (!images.includes(url)) {
                            setImages([...images, url]);
                            if (!imageUrl) setImageUrl(url);
                          } else {
                            setImages(images.filter(i => i !== url));
                          }
                        }}
                        className={`relative h-24 rounded-xl border overflow-hidden cursor-pointer transition bg-gray-50 flex items-center justify-center p-1 ${isSelected ? 'border-orange-600 ring-2 ring-orange-600/40 bg-orange-50' : 'border-gray-200 hover:border-gray-400'}`}
                      >
                        <img src={url} alt="" className="w-full h-full object-contain" />
                        {isSelected && (
                          <span className="absolute top-1 right-1 bg-orange-600 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold shadow-xs">
                            ✓
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="border-t pt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowMediaModal(false)}
                    className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-2.5 rounded-xl text-xs font-bold cursor-pointer shadow-sm"
                  >
                    אישור וסיום בחירת תמונות ({images.length} נבחרו)
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3 bg-gray-50 p-4 rounded-2xl border">
            <div className="flex justify-between items-center">
              <label className="block text-xs font-bold text-gray-700">צבעי המוצר ושיוך תמונה חזותית לכל צבע</label>
              <button
                type="button"
                onClick={() => setColors([...colors, { name: '', hex: '#000000', image: '' }])}
                className="bg-black text-white px-3 py-1.5 rounded-xl text-[11px] font-bold cursor-pointer"
              >
                + הוסף צבע
              </button>
            </div>
            
            <div className="space-y-4">
              {colors.map((col, index) => (
                <div key={index} className="bg-white p-4 rounded-2xl border space-y-3">
                  <div className="flex flex-col sm:flex-row gap-3 items-center">
                    <input
                      type="text"
                      placeholder="שם הצבע (לדוגמה: כחול)"
                      value={col.name}
                      onChange={(e) => {
                        const newCols = [...colors];
                        newCols[index].name = e.target.value;
                        setColors(newCols);
                      }}
                      className="bg-gray-50 border rounded-xl p-2.5 text-xs w-full sm:w-1/3 outline-none"
                    />
                    <input
                      type="color"
                      value={col.hex}
                      onChange={(e) => {
                        const newCols = [...colors];
                        newCols[index].hex = e.target.value;
                        setColors(newCols);
                      }}
                      className="w-10 h-10 rounded-xl border cursor-pointer p-1 bg-white"
                    />
                    <span className="text-xs text-gray-500 flex-1">
                      {col.image ? '✓ תמונה משויכת לצבע' : 'לא נבחרה תמונה לצבע זה'}
                    </span>
                    {colors.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setColors(colors.filter((_, i) => i !== index))}
                        className="text-red-500 font-bold text-xs px-2"
                      >
                        מחק צבע
                      </button>
                    )}
                  </div>

                  {images.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[11px] font-bold text-gray-600 block">בחר תמונה לצבע זה מתוך תמונות המוצר:</span>
                      <div className="flex gap-2 overflow-x-auto pb-2">
                        {images.map((imgUrl, imgIdx) => {
                          const isSelected = col.image === imgUrl;
                          return (
                            <div
                              key={imgIdx}
                              onClick={() => {
                                const newCols = [...colors];
                                newCols[index].image = imgUrl;
                                setColors(newCols);
                              }}
                              className={`relative w-14 h-14 rounded-xl border overflow-hidden cursor-pointer shrink-0 transition bg-gray-50 flex items-center justify-center p-0.5 ${isSelected ? 'border-orange-600 ring-2 ring-orange-600/50 bg-orange-50' : 'border-gray-200 hover:border-gray-400'}`}
                            >
                              <img src={imgUrl} alt="" className="w-full h-full object-contain" />
                              {isSelected && (
                                <span className="absolute bottom-0 right-0 bg-orange-600 text-white text-[9px] px-1 rounded-tl font-bold">
                                  ✓
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="block text-xs font-bold text-gray-700">תיאור קצר</label>
              <button type="button" onClick={() => setShowPreviewShort(!showPreviewShort)} className="text-orange-600 text-xs font-bold">👁️ תצוגה מקדימה</button>
            </div>
            <input type="text" value={shortDesc} onChange={(e) => setShortDesc(e.target.value)} placeholder="משפט סיכום קצר..." className="w-full bg-gray-50 border rounded-xl p-3 text-xs outline-none" />
            {showPreviewShort && <div className="bg-orange-50 border p-3 rounded-xl text-xs" dangerouslySetInnerHTML={{ __html: parseMarkdownPreview(shortDesc) }}></div>}
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="block text-xs font-bold text-gray-700">תיאור מלא</label>
              <button type="button" onClick={() => setShowPreviewFull(!showPreviewFull)} className="text-orange-600 text-xs font-bold">👁️ תצוגה מקדימה</button>
            </div>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="תיאור מפורט..." className="w-full bg-gray-50 border rounded-xl p-3 text-xs outline-none"></textarea>
            {showPreviewFull && <div className="bg-orange-50 border p-3 rounded-xl text-xs whitespace-pre-line" dangerouslySetInnerHTML={{ __html: parseMarkdownPreview(description) }}></div>}
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="block text-xs font-bold text-gray-700">מפרט טכני מלא</label>
              <button type="button" onClick={() => setShowPreviewSpecs(!showPreviewSpecs)} className="text-orange-600 text-xs font-bold">👁️ תצוגה מקדימה</button>
            </div>
            <textarea value={specs} onChange={(e) => setSpecs(e.target.value)} rows={3} placeholder="מפרט טכני..." className="w-full bg-gray-50 border rounded-xl p-3 text-xs outline-none"></textarea>
            {showPreviewSpecs && <div className="bg-orange-50 border p-3 rounded-xl text-xs whitespace-pre-line" dangerouslySetInnerHTML={{ __html: parseMarkdownPreview(specs) }}></div>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t pt-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">SEO Title</label>
              <input type="text" value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} className="w-full bg-gray-50 border rounded-xl p-3 text-xs outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">SEO Description</label>
            <input type="text" value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} className=... />
            </div>
          </div>

          <div className="bg-orange-50/50 border border-orange-200 p-4 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-xs font-black text-gray-900 block">שמור כטיוטה</span>
            </div>
            <input type="checkbox" checked={isDraft} onChange={(e) => setIsDraft(e.target.checked)} className="w-5 h-5 accent-orange-600 cursor-pointer" />
          </div>

          <div className="flex gap-3 pt-4">
            <button type="submit" className="bg-orange-600 text-white px-6 py-3.5 rounded-2xl text-xs font-black hover:bg-orange-700 transition shadow-md cursor-pointer">
              {editingId ? 'עדכן מוצר ➔' : '+ הוסף מוצר לחנות ➔'}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm} className="bg-gray-200 text-gray-800 px-6 py-3.5 rounded-2xl text-xs font-bold transition cursor-pointer">ביטול</button>
            )}
          </div>
        </form>
      </div>

      <div className="bg-white p-6 rounded-3xl border shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-4 gap-3">
          <h2 className="text-base font-black text-gray-900 border-r-4 border-orange-600 pr-3">
            מוצרים קיימים ({filteredProducts.length})
          </h2>
          <input
            type="text"
            placeholder="חפש מוצר קיים לפי שם..."
            value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)}
            className="w-full sm:w-64 bg-gray-50 border rounded-xl p-2.5 text-xs outline-none"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {filteredProducts.map((p) => (
            <div key={p.id} className="border rounded-2xl p-4 flex justify-between items-center bg-gray-50/50 shadow-xs">
              <div className="flex items-center gap-2">
                <img src={p.image_url} alt="" className="w-10 h-10 object-contain bg-white rounded-xl border p-1" />
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
