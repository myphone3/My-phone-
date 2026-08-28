'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function ProductPage() {
  const params = useParams();
  const id = params?.id;

  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState('');
  
  // בחירות חובה של הלקוח
  const [selectedColor, setSelectedColor] = useState('');
  const [selectedVersion, setSelectedVersion] = useState('');

  useEffect(() => {
    if (!id) return;

    async function fetchProduct() {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('*');

        if (error) {
          console.error('Error fetching products:', error);
        } else if (data) {
          const found = data.find((p: any) => String(p.id) === String(id) || String(p._id) === String(id));
          setProduct(found || null);
          
          if (found) {
            // חיפוש אוטומטי של תמונה בכל שדה אפשרי באובייקט המוצר
            let imgUrl = '';
            for (const key of Object.keys(found)) {
              const val = found[key];
              if (typeof val === 'string' && (val.startsWith('http') || val.includes('/') || val.includes('.'))) {
                if (key.toLowerCase().includes('image') || key.toLowerCase().includes('img') || key.toLowerCase().includes('photo') || key.toLowerCase().includes('url')) {
                  imgUrl = val;
                  break;
                }
              } else if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'string') {
                if (key.toLowerCase().includes('image') || key.toLowerCase().includes('img')) {
                  imgUrl = val[0];
                  break;
                }
              }
            }
            if (!imgUrl) {
              imgUrl = found.image || found.images?.[0] || found.img || found.imageUrl || '';
            }
            setSelectedImage(imgUrl);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchProduct();
  }, [id]);

  if (loading) return <div className="p-12 text-center text-gray-500">טוען פרטי מוצר...</div>;
  if (!product) return <div className="p-12 text-center text-gray-500">המוצר לא נמצא</div>;

  // איסוף כל התמונות לגלרייה
  let imagesList: string[] = [];
  const rawImages = product.images || product.image || product.img || product.imageUrl;
  if (Array.isArray(rawImages)) {
    imagesList = rawImages;
  } else if (typeof rawImages === 'string' && rawImages.trim()) {
    imagesList = rawImages.split(',').map((s: string) => s.trim());
  } else if (selectedImage) {
    imagesList = [selectedImage];
  }

  const currentImage = selectedImage || imagesList[0] || '';

  // הגדרת אפשרויות צבע וגרסה לבחירה (ניתן לקחת מהניהול או להציג אפשרויות תקניות)
  const colors = product.colors || product.available_colors || ['שחור', 'לבן', 'כחול', 'אפור'];
  const versions = product.versions || product.available_versions || (product.version ? [product.version] : ['גרסה רגילה', 'גרסה מתקדמת']);

  const handleAddToCart = () => {
    if (!selectedVersion) {
      alert('אנא בחר גרסה לפני הוספה לסל');
      return;
    }
    if (!selectedColor) {
      alert('אנא בחר צבע לפני הוספה לסל');
      return;
    }
    
    alert(`המוצר נוסף לסל בהצלחה!\nגרסה: ${selectedVersion}\nצבע: ${selectedColor}`);
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 flex flex-col md:flex-row gap-8 bg-white rounded-2xl shadow-sm mt-6" dir="rtl">
      {/* אזור התמונות והגלרייה */}
      <div className="w-full md:w-1/2 flex flex-col gap-4">
        <div className="w-full h-80 md:h-96 bg-gray-50 border rounded-2xl overflow-hidden flex items-center justify-center relative p-2 shadow-inner">
          {currentImage ? (
            <img 
              src={currentImage} 
              alt={product.name} 
              className="object-contain h-full w-full"
            />
          ) : (
            <span className="text-gray-400">אין תמונה זמינה</span>
          )}
        </div>

        {imagesList.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-2">
            {imagesList.map((img: string, index: number) => (
              <button
                key={index}
                onClick={() => setSelectedImage(img)}
                className={`w-16 h-16 rounded-xl border-2 overflow-hidden flex-shrink-0 transition-all ${
                  currentImage === img ? 'border-black ring-2 ring-black/10' : 'border-gray-200 opacity-70 hover:opacity-100'
                }`}
              >
                <img src={img} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* פרטי המוצר המלאים */}
      <div className="w-full md:w-1/2 flex flex-col gap-4">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 leading-tight">{product.name}</h1>
        
        {/* תגיות מותג, קטגוריה, כשרות ונפח */}
        <div className="flex flex-wrap gap-2 items-center">
          {product.brand && (
            <span className="bg-orange-50 text-orange-700 text-sm px-3 py-1.5 rounded-lg font-medium border border-orange-100 flex items-center gap-1.5">
              {product.brand_image && <img src={product.brand_image} alt="" className="w-4 h-4 object-contain" />}
              {product.brand}
            </span>
          )}
          {product.category && (
            <span className="bg-gray-100 text-gray-700 text-sm px-3 py-1.5 rounded-lg font-medium border border-gray-200 flex items-center gap-1.5">
              {product.category_image && <img src={product.category_image} alt="" className="w-4 h-4 object-contain" />}
              {product.category}
            </span>
          )}
          {product.kosher && (
            <span className="bg-blue-50 text-blue-700 text-sm px-3 py-1.5 rounded-lg font-medium border border-blue-100">
              {product.kosher}
            </span>
          )}
          {product.kosher_type && (
            <span className="bg-blue-50 text-blue-700 text-sm px-3 py-1.5 rounded-lg font-medium border border-blue-100">
              {product.kosher_type}
            </span>
          )}
          {product.certification && (
            <span className="bg-green-50 text-green-700 text-sm px-3 py-1.5 rounded-lg font-medium border border-green-100">
              {product.certification}
            </span>
          )}
          {product.storage && (
            <span className="bg-purple-50 text-purple-700 text-sm px-3 py-1.5 rounded-lg font-medium border border-purple-100">
              נפח: {product.storage}
            </span>
          )}
          {product.ram && (
            <span className="bg-indigo-50 text-indigo-700 text-sm px-3 py-1.5 rounded-lg font-medium border border-indigo-100">
              RAM: {product.ram}
            </span>
          )}
        </div>

        {/* בחירת גרסה (חובה) */}
        <div className="flex flex-col gap-1.5 mt-2">
          <label className="text-sm font-semibold text-gray-700">בחר גרסה (שדה חובה):</label>
          <div className="flex flex-wrap gap-2">
            {(Array.isArray(versions) ? versions : [versions]).map((ver: string, idx: number) => (
              <button
                key={idx}
                type="button"
                onClick={() => setSelectedVersion(ver)}
                className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                  selectedVersion === ver 
                    ? 'bg-black text-white border-black shadow-md' 
                    : 'bg-gray-50 text-gray-800 border-gray-200 hover:bg-gray-100'
                }`}
              >
                {ver}
              </button>
            ))}
          </div>
        </div>

        {/* בחירת צבע (חובה) */}
        <div className="flex flex-col gap-1.5 mt-1">
          <label className="text-sm font-semibold text-gray-700">בחר צבע (שדה חובה):</label>
          <div className="flex flex-wrap gap-2">
            {(Array.isArray(colors) ? colors : [colors]).map((col: string, idx: number) => (
              <button
                key={idx}
                type="button"
                onClick={() => setSelectedColor(col)}
                className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                  selectedColor === col 
                    ? 'bg-black text-white border-black shadow-md' 
                    : 'bg-gray-50 text-gray-800 border-gray-200 hover:bg-gray-100'
                }`}
              >
                {col}
              </button>
            ))}
          </div>
        </div>

        <p className="text-2xl font-bold text-gray-900 mt-2">₪{product.price}</p>
        
        <button 
          onClick={handleAddToCart}
          className="w-full bg-black text-white py-4 rounded-xl font-semibold hover:bg-gray-800 transition-colors shadow-sm active:scale-[0.98]"
        >
          הוספה לסל
        </button>

        {product.description && (
          <div className="border-t pt-4 mt-2">
            <h3 className="font-semibold text-gray-800 mb-2">תיאור המוצר:</h3>
            <p className="text-gray-600 text-sm md:text-base whitespace-pre-line leading-relaxed">{product.description}</p>
          </div>
        )}
      </div>
    </div>
  );
}
