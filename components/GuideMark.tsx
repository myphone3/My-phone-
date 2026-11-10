'use client';

import Icon from './Icon';
import { CertLogo } from './ProductExtras';
import { PHONE_CERT } from './KosherExplainer';

// הסמל של מדריך בכרטיסים הקטנים: במדריכי הכשרות מוצג לוגו ועדת הרבנים, וליד אייקון הנושא
export default function GuideMark({ emoji, cert, category, size = 40 }: { emoji: string; cert?: string; category?: string; size?: number }) {
  const certName = cert || (category === 'kosher' ? PHONE_CERT : undefined);
  const icon = (
    <span className="rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <Icon name={emoji} size={Math.round(size * 0.55)} />
    </span>
  );
  if (!certName) return icon;
  return (
    <span className="inline-flex items-center gap-1.5 shrink-0">
      {icon}
      <CertLogo name={certName} size={size} className="border border-gray-100 p-0.5" />
    </span>
  );
}
