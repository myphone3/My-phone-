import { useState } from 'react';

export default function ProductDetails({ product }) {
  if (!product) return <div>טוען פרטי מוצר...</div>;

  // איסוף התמונות בצורה אחידה כדי שתוצאת החיפוש/הקטלוג תתאים בדיוק לעמוד הפרטים
  const imagesList = Array.isArray(product.images) && product.images.length > 0
    ? product.images
    : product.image 
      ? [product.image] 
      : [];

  // בחירת התמונה הראשונה כברירת מחדל (התמונה שמופיעה בקטלוג)
  const [selectedImage, setSelectedImage] = useState(imagesList[0] || '');

  return (
    <div className="max-w-4xl mx-auto p-4 flex flex-col md:flex-row gap-8">
      {/* אזור התמונות */}
      <div className="w-full md:w-1/2 flex flex-col gap-4">
        {/* תמונה ראשית גדולה */}
        <div className="w-full h-96 bg-white border rounded-xl overflow-hidden flex items-center justify-center shadow-sm">
          <img 
            src={selectedImage} 
            alt={product.name} 
            className="object-contain h-full w-full p-2"
          />
        </div>

        {/* גלריית תמונות ממוזערות - מציגה את כל התמונות כולל הראשונה */}
        {imagesList.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-2">
            {imagesList.map((img, index) => (
              <button
                key={index}
                onClick={() =>setSelectedImage(img)}
                className={`w-16 h-16 rounded-lg border-2 overflow-hidden flex-shrink-0 transition-all ${
                  selectedImage === img ? 'border-black ring-1 ring-black' : 'border-gray-200 opacity-70 hover:opacity-100'
                }`}
              >
                <img src={img} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* פרטי המוצר */}
      <div className="w-full md:w-1/2 flex flex-col gap-4">
        <h1 className="text-2xl font-bold">{product.name}</h1>
        <p className="text-xl font-semibold text-gray-800">₪{product.price}</p>
        <p className="text-gray-600">{product.description}</p>
      </div>
    </div>
  );
}
