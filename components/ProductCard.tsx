import React from 'react';

export default function ProductCard(props: any) {
  // בדיקה מקיפה שתופסת כל דרך שבה הנתונים מגיעים
  const item = props.product || props;
  const productName = item.name || item.title || "מוצר";
  const productPrice = item.price;
  const productImage = item.image_url || item.image;

  return (
    <div className="border rounded-xl p-4 shadow-md bg-white flex flex-col gap-2">
      {/* תצוגת תמונה */}
      {productImage && (
        <img 
          src={productImage} 
          alt={productName} 
          className="w-full h-40 object-cover rounded-md"
        />
      )}
      
      {/* שם המוצר האמיתי */}
      <h3 className="text-lg font-bold">{productName}</h3>
      
      {/* מחיר המוצר */}
      <p className="text-gray-600 font-semibold">
        {productPrice ? `₪${productPrice}` : ""}
      </p>
    </div>
  );
}
