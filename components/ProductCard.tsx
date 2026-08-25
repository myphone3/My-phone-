import React from 'react';

export default function ProductCard(props: any) {
  return (
    <div className="border rounded-xl p-4 shadow-md bg-white">
      <h3 className="text-lg font-bold">{props.title || "מוצר"}</h3>
      <p className="text-gray-600">{props.price || ""}</p>
    </div>
  );
}
