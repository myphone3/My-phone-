import { drawingSvg } from '@/lib/drawings';

// ציור למוצר: ציור משלנו לפי השם (צבע, אחד/כמה, סוג), ואם אין — האימוג'י
export default function ItemPic({ name, emoji, size }) {
  const svg = drawingSvg(name || '');
  if (svg) return <span className="pic" style={size ? { width: size, height: size } : undefined} dangerouslySetInnerHTML={{ __html: svg }} />;
  return <span style={size ? { fontSize: size * 0.8 } : undefined}>{emoji}</span>;
}
