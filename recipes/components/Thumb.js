'use client';
import { useEffect, useState } from 'react';
import { thumbOf } from '@/lib/thumbs';

// תמונה מוקטנת לכרטיס; אם עוד אין גרסה קטנה — נופלים מיד לתמונה המלאה
export default function Thumb({ src, alt = '', ...rest }) {
  const t = thumbOf(src);
  const [cur, setCur] = useState(t || src);
  useEffect(() => { setCur(thumbOf(src) || src); }, [src]);
  const small = cur === t && !!t;
  return (
    <img src={cur} alt={alt} decoding="async" crossOrigin={small ? 'anonymous' : undefined}
      onError={() => { if (small) setCur(src); }} {...rest} />
  );
}
