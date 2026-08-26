import React from 'react';

export default function ProductCard(props: any) {
  return (
    <div className="border rounded-xl p-4 shadow-md bg-white flex flex-col gap-2">
      {/* תצוגת תמונה אם קיימת */}
      {props.image_url && (
        <img 
          src={props.image_url} 
          alt={props.name || "מוצר"} 
          className="w-full h-40 object-cover rounded-md"
        />
      )}
      
      {/* שם המוצר (משתמש ב-name שמגיע מ-Supabase עם גיבוי) */}
      <h3 className="text-lg font-bold">{props.name || props.title || "מוצר"}</h3>
      
      {/* מחיר המוצר */}
      <p className="text-gray-600 font-semibold">
        {props.price ? `₪${props.price}` : ""}
      </p>
    </div>
  );
}
