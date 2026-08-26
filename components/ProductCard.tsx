'use client';

import React from 'react';

export default function ProductCard(props: any) {
  // חילוץ בטוח של נתוני המוצר
  const item = props.product || props;
  const productName = item.name || item.title || 'מוצר';
  const productPrice = item.price || 0;
  const productImage = item.image_url || item.image || '';
  const productId = item.id || item._id;

  // פונקציה להוספה לסל
  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation(); // מונע פתיחת עמוד פרטים כשלוחצים על הכפתור
    if (props.onAddToCart) {
      props.onAddToCart(item);
    } else {
      try {
        const existingCart = JSON.parse(localStorage.getItem('cart') || '[]');
        existingCart.push({ ...item, quantity: 1 });
        localStorage.setItem('cart', JSON.stringify(existingCart));
        alert('המוצר נוסף בהצלחה לעגלה! 🛒');
      } catch (err) {
        console.error(err);
      }
    }
  };

  // פונקציה למעבר לעמוד פרטי המוצר בלחיצה על הכרטיס
  const handleCardClick = () => {
    if (props.onClick) {
      props.onClick(item);
    } else if (productId) {
      window.location.href = `/product/${productId}`;
    }
  };

  return (
    <div 
      onClick={handleCardClick}
      className="border rounded-xl p-4 bg-white shadow-sm hover:shadow-md transition cursor-pointer flex flex-col justify-between"
    >
      {/* תצוגת תמונה */}
      <div className="w-full h-48 relative mb-3 overflow-hidden rounded-lg bg-gray-100 flex items-center justify-center">
        {productImage ? (
          <img 
            src={productImage} 
            alt={productName} 
            className="object-contain h-full w-full"
          />
        ) : (
          <span className="text-gray-400">אין תמונה</span>
        )}
      </div>

      {/* שם המוצר */}
      <h3 className="font-bold text-lg text-gray-800 mb-1">{productName}</h3>

      {/* מחיר */}
      <div className="text-blue-600 font-bold text-xl mb-3">
        ₪{productPrice}
      </div>

      {/* כפתור הוספה לסל */}
      <button 
        onClick={handleAddToCart}
        className="w-full bg-black text-white py-2 rounded-lg font-medium hover:bg-gray-800 transition flex items-center justify-center gap-2"
      >
        <span>הוספה לסל</span>
        <span>🛒</span>
      </button>
    </div>
  );
}
