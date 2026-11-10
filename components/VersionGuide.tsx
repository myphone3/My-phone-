'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { FEATURES, VersionInfo, featureMark, resolveVersion, splitFeatures } from '@/lib/versionGuide';
import { versionName } from '@/lib/versionPrice';
import { VersionMark } from './Logos';
import Icon from './Icon';

// הסבר והשוואה בין גרסאות: בעמוד המוצר ובמדריכים

let rowsPromise: Promise<any[]> | null = null;
function loadVersionRows() {
  if (!rowsPromise) {
    rowsPromise = (async () => {
      try {
        const { data } = await supabase.from('versions').select('*');
        return data || [];
      } catch {
        return [];
      }
    })();
  }
  return rowsPromise;
}

export function useVersionInfos(names?: string[]) {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    loadVersionRows().then(setRows);
  }, []);
  const list = names ?? rows.map((r) => String(r.name));
  // מהגרסה הפשוטה לפתוחה ביותר: לפי כמה יכולות יש בה
  const yesCount = (v: { features: Record<string, string | undefined> }) => Object.values(v.features).filter((x) => x === 'yes').length;
  return list.map((n) => resolveVersion(n, rows)).sort((a, b) => yesCount(a) - yesCount(b));
}

// כרטיס של גרסה אחת: מה יש (ירוק) ומה אין (אפור)
export function VersionCard({ v, active, onSelect }: { v: VersionInfo; active?: boolean; onSelect?: () => void }) {
  const { yes, no } = splitFeatures(v);
  return (
    <div className={`rounded-2xl border-2 p-4 space-y-3 transition ${active ? 'border-orange-500 bg-orange-50/40' : 'border-gray-100 bg-white'}`}>
      <div className="flex items-center gap-3">
        <span className="w-11 h-11 rounded-xl bg-gray-50 border flex items-center justify-center shrink-0">
          <VersionMark v={v} size={30} />
        </span>
        <div className="min-w-0 flex-1">
          <h4 className="font-black text-gray-900 text-sm leading-tight">{v.title || v.name}</h4>
          {v.bestFor && <p className="text-[11px] text-gray-500 leading-snug mt-0.5">{v.bestFor}</p>}
        </div>
        {active && <span className="text-[10px] font-black bg-orange-600 text-white px-2 py-1 rounded-lg shrink-0">נבחרה</span>}
      </div>
      {v.description && <p className="text-xs text-gray-700 leading-relaxed">{v.description}</p>}
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div className="bg-green-50 rounded-xl p-2.5 space-y-1">
          <span className="block font-black text-green-800">✓ יש</span>
          {yes.map((f) => (
            <span key={f.key} className="flex items-center gap-1.5 text-green-900">
              <Icon name={f.icon} size={13} /> {f.label}
            </span>
          ))}
        </div>
        <div className="bg-gray-50 rounded-xl p-2.5 space-y-1">
          <span className="block font-black text-gray-500">✕ אין</span>
          {no.length ? (
            no.map((f) => (
              <span key={f.key} className="flex items-center gap-1.5 text-gray-400 line-through decoration-gray-300">
                <Icon name={f.icon} size={13} /> {f.label}
              </span>
            ))
          ) : (
            <span className="block text-gray-400">הכל פתוח</span>
          )}
        </div>
      </div>
      {onSelect && !active && (
        <button type="button" onClick={onSelect} className="w-full bg-gray-900 hover:bg-black text-white py-2.5 rounded-xl text-xs font-black cursor-pointer">
          בחירת הגרסה הזו
        </button>
      )}
    </div>
  );
}

// טבלת השוואה: הגרסאות בעמודות, היכולות בשורות. רק "יש" או "אין"
export function VersionTable({ versions, selected, onSelect }: { versions: VersionInfo[]; selected?: string; onSelect?: (name: string) => void }) {
  if (!versions.length) return null;
  return (
    <div className="overflow-x-auto -mx-1 px-1">
      {versions.length > 3 && <p className="sm:hidden text-[10px] font-bold text-orange-700 mb-1">← גוללים הצידה לכל הגרסאות</p>}
      <table className="w-full text-xs border-separate border-spacing-0" style={{ minWidth: 110 + versions.length * 92 }}>
        <thead>
          <tr>
            <th className="sticky right-0 bg-white z-10 p-2 w-28 sm:w-36" />
            {versions.map((v) => {
              const active = selected === v.name;
              return (
                <th key={v.name} className="p-1.5 align-bottom">
                  <button
                    type="button"
                    disabled={!onSelect}
                    onClick={() => onSelect?.(v.name)}
                    className={`w-full rounded-xl px-2 py-2 font-black leading-tight transition flex flex-col items-center gap-1 ${
                      active ? 'bg-orange-600 text-white shadow' : 'bg-orange-50 text-gray-900 border border-orange-100'
                    } ${onSelect ? 'cursor-pointer hover:border-orange-400' : 'cursor-default'}`}
                  >
                    <VersionMark v={v} size={24} />
                    <span>{v.title || v.name}</span>
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {FEATURES.map((f, i) => (
            <tr key={f.key} className={i % 2 ? 'bg-gray-50/50' : ''}>
              <th className={`sticky right-0 z-10 text-right p-2 font-bold text-gray-700 border-b border-gray-100 leading-tight ${i % 2 ? 'bg-gray-50' : 'bg-white'}`} title={f.hint}>
                <span className="flex items-center gap-1.5">
                  <Icon name={f.icon} size={14} className="text-gray-500" /> {f.label}
                </span>
                <span className="block text-[9px] font-medium text-gray-400">{f.hint}</span>
              </th>
              {versions.map((v) => {
                const m = featureMark(v.features[f.key]);
                return (
                  <td key={v.name} className={`text-center p-1.5 border-b border-gray-100 ${selected === v.name ? 'bg-orange-50/60' : ''}`}>
                    <span className={`inline-flex items-center justify-center gap-1 min-w-[44px] h-7 px-2 rounded-full font-black ${m.cls}`} aria-label={`${f.label}: ${m.label}`}>
                      {m.text} <span className="text-[10px]">{m.label}</span>
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// מעבר בין תצוגת כרטיסים לטבלה
function ViewSwitch({ view, setView }: { view: 'cards' | 'table'; setView: (v: 'cards' | 'table') => void }) {
  return (
    <div className="inline-flex bg-gray-100 rounded-xl p-1 text-[11px] font-black">
      {([
        ['cards', 'כרטיסים'],
        ['table', 'טבלה'],
      ] as const).map(([k, label]) => (
        <button
          key={k}
          type="button"
          onClick={() => setView(k)}
          className={`px-3 py-1.5 rounded-lg cursor-pointer ${view === k ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// בעמוד המוצר: הסבר על הגרסה שנבחרה + חלון עם כל הגרסאות של המוצר
export function ProductVersionHelp({ versions, selected, onSelect }: { versions: any[]; selected: any; onSelect: (v: any) => void }) {
  const names = versions.map(versionName).filter(Boolean);
  const infos = useVersionInfos(names);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'cards' | 'table'>('cards');
  const selectedName = selected ? versionName(selected) : '';
  const current = infos.find((v) => v.name === selectedName);

  if (!names.length) return null;
  const choose = (name: string) => {
    const v = versions.find((x) => versionName(x) === name);
    if (v) onSelect(v);
    setOpen(false);
  };

  return (
    <>
      {current && (
        <div className="bg-white border border-orange-100 rounded-2xl p-3 space-y-2">
          <div className="flex items-center gap-2">
            <VersionMark v={current} size={22} />
            <b className="text-xs text-gray-900">{current.title}</b>
          </div>
          <div className="flex flex-wrap gap-1">
            {splitFeatures(current).yes.map((f) => (
              <span key={f.key} className="text-[10px] font-bold bg-green-50 text-green-800 px-2 py-0.5 rounded-lg">
                ✓ {f.label}
              </span>
            ))}
            {splitFeatures(current).no.map((f) => (
              <span key={f.key} className="text-[10px] font-bold bg-gray-50 text-gray-400 px-2 py-0.5 rounded-lg">
                ✕ {f.label}
              </span>
            ))}
          </div>
        </div>
      )}
      <button type="button" onClick={() => setOpen(true)} className="text-xs font-black text-orange-700 underline underline-offset-4 cursor-pointer">
        ❓ מה ההבדל בין הגרסאות?
      </button>

      {open && (
        <div className="fixed inset-0 z-[110] bg-black/60 flex items-end sm:items-center justify-center sm:p-4" onClick={() => setOpen(false)} dir="rtl">
          <div className="bg-white w-full sm:max-w-3xl max-h-[88vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-black text-gray-900">מה ההבדל בין הגרסאות?</h3>
                <p className="text-xs text-gray-500">אותו מכשיר, ברמות סינון שונות. בכל גרסה כתוב בדיוק מה יש ומה אין.</p>
              </div>
              <button onClick={() => setOpen(false)} className="w-9 h-9 rounded-full bg-gray-100 text-gray-500 shrink-0 cursor-pointer" aria-label="סגירה">
                ✕
              </button>
            </div>

            <ViewSwitch view={view} setView={setView} />

            {view === 'cards' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {infos.map((v) => (
                  <VersionCard key={v.name} v={v} active={v.name === selectedName} onSelect={() => choose(v.name)} />
                ))}
              </div>
            ) : (
              <VersionTable versions={infos} selected={selectedName} onSelect={choose} />
            )}

            <Link href="/guide/versions" className="block text-center bg-gray-100 hover:bg-gray-200 text-gray-800 py-3 rounded-2xl text-xs font-black">
              📖 למדריך המלא על הגרסאות
            </Link>
          </div>
        </div>
      )}
    </>
  );
}

// כל הגרסאות שבחנות (לעמוד המדריך)
export function AllVersionsTable() {
  const infos = useVersionInfos();
  const [view, setView] = useState<'cards' | 'table'>('cards');
  if (!infos.length) return <p className="text-xs text-gray-400">טוען...</p>;
  return (
    <div className="space-y-3">
      <ViewSwitch view={view} setView={setView} />
      {view === 'cards' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {infos.map((v) => (
            <VersionCard key={v.name} v={v} />
          ))}
        </div>
      ) : (
        <VersionTable versions={infos} />
      )}
    </div>
  );
}

// לוגו קטן ליד שם גרסה בכפתורי הבחירה (למשל לוגו כשר פליי)
export function VersionNameMark({ name, size = 16 }: { name: string; size?: number }) {
  const [info] = useVersionInfos([name]);
  if (!info || (!info.logo && !/כשר ?פליי|kosher ?play/i.test(name))) return null;
  return <VersionMark v={info} size={size} />;
}
