// לוגואים קטנים שחוזרים באתר: וואטסאפ, כשר פליי ולוגו של גרסה

export function WhatsAppIcon({ size = 18, color = 'currentColor', className = '' }: { size?: number; color?: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" fill={color} className={`shrink-0 ${className}`}>
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21c5.46 0 9.91-4.45 9.91-9.91C21.95 6.45 17.5 2 12.04 2Zm5.8 14.02c-.25.69-1.44 1.33-1.98 1.37-.53.05-1.03.24-3.47-.72-2.93-1.16-4.79-4.17-4.94-4.36-.14-.19-1.18-1.57-1.18-3s.75-2.13 1.02-2.42c.26-.29.57-.36.77-.36l.55.01c.18.01.42-.07.65.5.25.59.84 2.03.91 2.18.07.14.12.31.02.5-.1.19-.14.31-.29.48-.14.17-.3.38-.43.51-.14.14-.29.3-.13.59.17.29.74 1.22 1.58 1.97 1.09.97 2 1.27 2.29 1.42.29.14.46.12.62-.07.17-.19.72-.84.91-1.13.19-.29.38-.24.65-.14.26.1 1.68.79 1.97.94.29.14.48.21.55.33.07.12.07.69-.18 1.38Z" />
    </svg>
  );
}

// סימן כשר פליי: הלוגו שהועלה בפאנל (מסך "גרסאות"), ואם אין, תגית בצבעי החנות
export function KosherPlayMark({ logo, size = 28 }: { logo?: string; size?: number }) {
  if (logo) {
    return <img src={logo} alt="כשר פליי" style={{ width: size, height: size }} className="object-contain rounded-md bg-white shrink-0" />;
  }
  return (
    <span
      style={{ width: size, height: size }}
      className="shrink-0 rounded-lg bg-gradient-to-br from-sky-500 to-blue-700 text-white inline-flex items-center justify-center shadow-sm"
      aria-label="כשר פליי"
      title="כשר פליי"
    >
      <svg viewBox="0 0 24 24" width={size * 0.55} height={size * 0.55} fill="currentColor" aria-hidden="true">
        <path d="M8 5.5v13a1 1 0 0 0 1.52.85l10.4-6.5a1 1 0 0 0 0-1.7L9.52 4.65A1 1 0 0 0 8 5.5Z" />
      </svg>
    </span>
  );
}

// לוגו או אייקון של גרסה
export function VersionMark({ v, size = 28 }: { v: { name: string; icon: string; logo?: string }; size?: number }) {
  if (/כשר ?פליי|kosher ?play/i.test(v.name)) return <KosherPlayMark logo={v.logo} size={size} />;
  if (v.logo) return <img src={v.logo} alt="" style={{ width: size, height: size }} className="object-contain rounded-md bg-white shrink-0" />;
  return (
    <span style={{ fontSize: size * 0.75, lineHeight: 1 }} className="shrink-0" aria-hidden="true">
      {v.icon}
    </span>
  );
}
