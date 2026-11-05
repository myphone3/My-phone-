// מציג ערך מפרטי העסק, או סימון צהוב כשהשדה עדיין לא מולא
export default function Fill({ value, label }: { value?: string; label: string }) {
  if (value) return <>{value}</>;
  return <span className="bg-yellow-100 text-yellow-900 rounded px-1 font-bold">[למילוי: {label}]</span>;
}
