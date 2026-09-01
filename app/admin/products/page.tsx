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
  const [kosher, setKosher] = useState('');
  const [storageVal, setStorageVal] = useState('');
  const [selectedVersions, setSelectedVersions] = useState<string[]>([]);
  const [stock, setStock] = useState('10');
  const [isDraft, setIsDraft] = useState(false);

  const [shortDesc, setShortDesc] = useState('');
  const [description, setDescription] = useState('');
  const [specs, setSpecs] = useState('');
  
  // תמונות מרובות
  const [images, setImages] = useState<string[]>([]);
  const [imageUrl, setImageUrl] = useState('');
  
  const [colors, setColors] = useState<{ name: string; hex: string; image: string }[]>([
    { name: 'שחור', hex: '#000000', image: '' }
  ]);

  const [seoTitle, setSeoTitle] = useState('');
  const [seoDesc, setSeoDesc] = useState('');

  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // תצוגות מקדימות נפרדות
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
    const kosherRes = await supabase.from('kosher_types').select('*');
    
    let catRes: any = { data: [] };
    try {
      catRes = await supabase.from('categories').select('*');
    } catch (e) {}

    let versionRes: any = { data: [] };
    try {
      versionRes = await supabase.from('versions').select('*');
    } catch (e) {}

    const storageRes = await supabase.storage.from('products').list('', { limit: 100 });

    if (prodRes.data) setProducts(prodRes.data);
    if (brandRes.data) setBrandsList(brandRes.data);
    if (kosherRes.data) setKosherList(kosherRes.data);
    if (catRes.data) setCategoriesList(catRes.data);
    if (versionRes.data) setVersionsList(versionRes.data);
    
    if (storageRes.data) {
      const files = storageRes.data.map((f: any) => {
        const { data } = supabase.storage.from('products').getPublicUrl(f.name);
        return data.publicUrl;
      });
      setStorageFiles(files);
    }
    setLoading(false);
  };

  // העלאת מספר תמונות מהמכשיר
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

  const handleAiAssistant = () => {
    if (!name) {
      alert('נא להזין תחילה את שם המוצר כדי שהסוכן יוכל לייצר עבורך טקסטים');
      return;
    }
    setAiGenerating(true);
    setTimeout(() => {
      setShortDesc(`<strong>מכשיר איכותי ומתקדם</strong> דגם <em>${name}</em>, בעל ביצועים עוצמתיים ואחריות מלאה.`);
      setDescription(`הכירו את <strong>${name}</strong>.<br>מכשיר מושלם המשלב עיצוב חדשני, מסך איכותי ברזולוציה גבוהה, מעבד מהיר במיוחד וסוללה חזקה לאורך כל היום.`);
      setSpecs(`• מסך: איכותי וחד\n• מעבד: מתקדם ועוצמתי\n• סוללה: קיבולת גבוהה\n• אחריות: יבואן רשמי`);
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
      short_description: shortDesc,
      description,
      specs,
      image_url: imageUrl || images[0] || '',
      images,
      product_colors: colors,
      seo_title: seoTitle,
      seo_description: seoDesc
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
    setShortDesc('');
    setDescription('');
    setSpecs('');
    setImageUrl('');
    setImages([]);
    setColors([{ name: 'שחור', hex: '#000000', image: '' }]);
    setSeoTitle('');
    setSeoDesc('');
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
    setShortDesc(prod.short_description || '');
    setDescription(prod.description || '');
    setSpecs(prod.specs || '');
    setImageUrl(prod.image_url || '');
    setImages(prod.images || prod.image_url ? [prod.image_url] : []);
    setColors(prod.product_colors || [{ name: 'שחור', hex: '#000000', image: '' }]);
    setSeoTitle(prod.seo_title || '');
    setSeoDesc(prod.seo_description || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('האם למחוק מוצר זה?')) return;
    await supabase.from('products').delete().eq('id', id);
    fetchData();
  };

  const filteredBrands = brandsList.filter(b => b.name.toLowerCase().includes(brandSearch.toLowerCase()));

  if (loading) return <div className="text-center py-20 text-gray-500 font-medium">טוען מוצרים...</div>;

  return (
    <div className="space-y-8" dir="rtl">
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
            ✨ {aiGenerating ? 'יוצר תוכן...' : 'סוכן AI למילוי אוטומטי'}
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
            {/* בחירת קטגוריה מהרשימה */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">קטגוריה</label>
              {categoriesList.length > 0 ? (
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
              ) : (
                <input type="text" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="שם קטגוריה..." className="w-full bg-gray-50 border rounded-xl p-3 text-xs outline-none" />
              )}
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

          {/* בחירת גרסאות מתוך הניהול */}
          <div className="space-y-2 bg-gray-50 p-4 rounded-2xl border">
            <label className="block text-xs font-bold text-gray-700">בחר גרסאות מותרות למוצר זה (שדה חובה ללקוח בחנות):</label>
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
              <p className="text-xs text-gray-400">לא הוגדרו גרסאות בטאב "ניהול גרסאות".</p>
            )}
          </div>

          {/* מותג עם שורת חיפוש */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-gray-700">בחר מותג מתוך הרשימה (כולל חיפוש)</label>
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

          {/* כשרות מהרשימה */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-gray-700">בחר רמת כשרות מתוך הרשימה</label>
            {kosherList.length > 0 ? (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {kosherList.map((k) => (
                  <button
                    key={k.id}
                    type="button"
                    onClick={() => setKosher(k.name)}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-2 shrink-0 bg-white cursor-pointer ${kosher === k.name ? 'border-orange-600 bg-orange-50' : 'border-gray-200'}`}
                  >
                    {k.image_url && <img src={k.image_url} alt="" className="h-4 object-contain" />}
                    <span>{k.name}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400">לא הוגדרו כשרויות בטאב "ניהול כשרות".</p>
            )}
            <input type="text" value={kosher} onChange={(e) => setKosher(e.target.value)} placeholder="או הזן כשרות ידנית..." className="w-full bg-gray-50 border rounded-xl p-3 text-xs outline-none" />
          </div>

          {/* העלאת תמונות מרובות + ספריית מדיה */}
          <div className="space-y-3 bg-gray-50 p-4 rounded-2xl border">
            <label className="block text-xs font-bold text-gray-700">תמונות המוצר (ניתן לבחור מספר תמונות יחד מהמכשיר או מהמדיה)</label>
            <input type="file" accept="image/*" multiple onChange={handleMultipleImageUpload} className="bg-white border rounded-xl p-2 text-xs cursor-pointer w-full" />
            {uploading && <span className="text-xs text-orange-600 font-bold">מעלה קבצים...</span>}

            {images.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {images.map((img, idx) => (
                  <div key={idx} className="relative w-16 h-16 rounded-xl border bg-white shrink-0 overflow-hidden">
                    <img src={img} alt="" className="w-full h-full object-contain p-1" />
                    <button
                      type="button"
                      onClick={() => setImages(images.filter((_, i) => i !== idx))}
                      className="absolute top-0 right-0 bg-red-600 text-white text-[10px] px-1 rounded-bl"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {storageFiles.length > 0 && (
              <div>
                <span className="text-[11px] font-bold text-gray-600 block mb-1">הוסף מהמדיה הקיימת באתר:</span>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {storageFiles.map((url, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        if (!images.includes(url)) setImages([...images, url]);
                        if (!imageUrl) setImageUrl(url);
                      }}
                      className="w-12 h-12 rounded-xl border bg-white shrink-0 overflow-hidden hover:ring-2 hover:ring-orange-600"
                    >
                      <img src={url} alt="" className="w-full h-full object-contain p-1" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* צבעי המוצר ושיוך תמונה */}
          <div className="space-y-3 bg-gray-50 p-4 rounded-2xl border">
            <div className="flex justify-between items-center">
              <label className="block text-xs font-bold text-gray-700">צבעי המוצר ושיוך תמונה לכל צבע</label>
              <button
                type="button"
                onClick={() => setColors([...colors, { name: '', hex: '#000000', image: '' }])}
                className="bg-black text-white px-3 py-1.5 rounded-xl text-[11px] font-bold cursor-pointer"
              >
                + הוסף צבע
              </button>
            </div>
            
            <div className="space-y-3">
              {colors.map((col, index) => (
                <div key={index} className="bg-white p-3 rounded-xl border flex flex-col sm:flex-row gap-3 items-center">
                  <input
                    type="text"
                    placeholder="שם הצבע (לדוגמה: כחול)"
                    value={col.name}
                    onChange={(e) => {
                      const newCols = [...colors];
                      newCols[index].name = e.target.value;
                      setColors(newCols);
                    }}
                    className="bg-gray-50 border rounded-xl p-2 text-xs w-full sm:w-1/3 outline-none"
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
                  <input
                    type="text"
                    placeholder="קישור תמונה לצבע"
                    value={col.image}
                    onChange={(e) => {
                      const newCols = [...colors];
                      newCols[index].image = e.target.value;
                      setColors(newCols);
                    }}
                    className="bg-gray-50 border rounded-xl p-2 text-xs flex-1 outline-none"
                  />
                  {colors.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setColors(colors.filter((_, i) => i !== index))}
                      className="text-red-500 font-bold text-xs px-2"
                    >
                      מחק
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* תיאור קצר עם כלי עיצוב ותצוגה מקדימה נפרדת */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="block text-xs font-bold text-gray-700">תיאור קצר</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShortDesc(shortDesc + '<strong></strong>')} className="bg-gray-100 px-2 py-1 rounded text-[11px] font-bold"><b>B</b></button>
                <button type="button" onClick={() => setShortDesc(shortDesc + '<em></em>')} className="bg-gray-100 px-2 py-1 rounded text-[11px] font-bold"><i>I</i></button>
                <button type="button" onClick={() => setShowPreviewShort(!showPreviewShort)} className="text-orange-600 text-xs font-bold">👁️ תצוגה מקדימה</button>
              </div>
            </div>
            <input type="text" value={shortDesc} onChange={(e) => setShortDesc(e.target.value)} placeholder="משפט סיכום קצר..." className="w-full bg-gray-50 border rounded-xl p-3 text-xs outline-none focus:border-orange-600" />
            {showPreviewShort && (
              <div className="bg-orange-50 border p-3 rounded-xl text-xs" dangerouslySetInnerHTML={{ __html: shortDesc || 'אין תוכן' }}></div>
            )}
          </div>

          {/* תיאור מלא עם כלי עיצוב ותצוגה מקדימה נפרדת */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="block text-xs font-bold text-gray-700">תיאור מלא</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setDescription(description + '<strong></strong>')} className="bg-gray-100 px-2 py-1 rounded text-[11px] font-bold"><b>B</b></button>
                <button type="button" onClick={() => setDescription(description + '<br>')} className="bg-gray-100 px-2 py-1 rounded text-[11px] font-bold">שורה חדשה</button>
                <button type="button" onClick={() => setShowPreviewFull(!showPreviewFull)} className="text-orange-600 text-xs font-bold">👁️ תצוגה מקדימה</button>
              </div>
            </div>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="תיאור מפורט..." className="w-full bg-gray-50 border rounded-xl p-3 text-xs outline-none focus:border-orange-600"></textarea>
            {showPreviewFull && (
              <div className="bg-orange-50 border p-3 rounded-xl text-xs whitespace-pre-line" dangerouslySetInnerHTML={{ __html: description || 'אין תוכן' }}></div>
            )}
          </div>

          {/* מפרט מלא עם תצוגה מקדימה נפרדת */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="block text-xs font-bold text-gray-700">מפרט טכני מלא</label>
              <button type="button" onClick={() => setShowPreviewSpecs(!showPreviewSpecs)} className="text-orange-600 text-xs font-bold">👁️ תצוגה מקדימה</button>
            </div>
            <textarea value={specs} onChange={(e) => setSpecs(e.target.value)} rows={3} placeholder="הזן נתוני מפרט טכני..." className="w-full bg-gray-50 border rounded-xl p-3 text-xs outline-none focus:border-orange-600"></textarea>
            {showPreviewSpecs && (
              <div className="bg-orange-50 border p-3 rounded-xl text-xs font-mono whitespace-pre-line">{specs || 'אין תוכן'}</div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t pt-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">SEO Title (כותרת בגוגל)</label>
              <input type="text" value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} placeholder="כותרת SEO..." className="w-full bg-gray-50 border rounded-xl p-3 text-xs outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">SEO Description (תיאור בגוגל)</label>
              <input type="text" value={seoDesc} onChange={(e) => setSeoDesc(e.target.value)} placeholder="תיאור SEO..." className="w-full bg-gray-50 border rounded-xl p-3 text-xs outline-none" />
            </div>
          </div>

          {/* כפתור שמירה כטיוטה בתחתית הטופס */}
          <div className="bg-orange-50/50 border border-orange-200 p-4 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-xs font-black text-gray-900 block">שמור כטיוטה (לא מפורסם בחנות)</span>
              <span className="text-[11px] text-gray-500">מוצר במצב טיוטה לא יוצג ללקוחות באתר.</span>
            </div>
            <input type="checkbox" checked={isDraft} onChange={(e) => setIsDraft(e.target.checked)} className="w-5 h-5 accent-orange-600 cursor-pointer" />
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
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-orange-600 font-black">₪{p.price}</span>
                    {p.is_published === false && <span className="text-[10px] bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded">טיוטה</span>}
                  </div>
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
