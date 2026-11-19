import { hueOf } from '@/lib/kb';

// לוגו של חברה (אם הועלה), אחרת האות הראשונה על צבע קבוע
export default function CoLogo({ co, size = 44 }) {
  if (!co) return null;
  const st = { width: size, height: size, borderRadius: Math.round(size * 0.26), fontSize: Math.round(size * 0.42) };
  if (co.logo_url) return <span className="co-logo img" style={st}><img src={co.logo_url} alt="" /></span>;
  return <span className="co-logo" style={{ ...st, background: hueOf(co.name) }}>{String(co.name).trim().charAt(0).toUpperCase()}</span>;
}
