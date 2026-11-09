'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { FEATURES, VersionInfo, featureMark, resolveVersion } from '@/lib/versionGuide';
import { versionName } from '@/lib/versionPrice';

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
  return list.map((n) => resolveVersion(n, rows));
}

// טבלת השוואה: הגרסאות בעמודות, היכולות בשורות
export function VersionTable({ versions, selected, onSelect }: { versions: VersionInfo[]; selected?: string; onSelect?: (name: string) => void }) {
  if (!versions.length) return null;
  return (
    <div className="overflow-x-auto -mx-1 px-1">
      {versions.length > 3 && <p className="sm:hidden text-[10px] font-bold text-orange-700 mb-1">← גוללים הצידה לכל הגרסאות</p>}
      <table className="w-full text-xs border-separate border-spacing-0" style={{ minWidth: 100 + versions.length * 88 }}>
        <thead>
          <tr>
            <th className="sticky right-0 bg-white z-10 p-2 w-24 sm:w-32" />
            {versions.map((v) => {
              const active = selected === v.name;
              return (
                <th key={v.name} className="p-1.5 align-bottom">
                  <button
                    type="button"
                    disabled={!onSelect}
                    onClick={() => onSelect?.(v.name)}
                    className={`w-full rounded-xl px-2 py-2 font-black leading-tight transition ${
                      active ? 'bg-orange-600 text-white shadow' : 'bg-orange-50 text-gray-900 border border-orange-100'
                    } ${onSelect ? 'cursor-pointer hover:border-orange-400' : 'cursor-default'}`}
                  >
                    <span className="block text-lg">{v.icon}</span>
                    {v.title || v.name}
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {FEATURES.map((f) => (
            <tr key={f.key}>
              <th className="sticky right-0 bg-white z-10 text-right p-2 font-bold text-gray-700 border-b border-gray-100 leading-tight" title={f.hint}>
                {f.icon} {f.label}
              </th>
              {versions.map((v) => {
                const m = featureMark(v.features[f.key]);
                return (
                  <td key={v.name} className={`text-center p-1.5 border-b border-gray-100 ${selected === v.name ? 'bg-orange-50/60' : ''}`}>
                    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full font-black ${m.cls}`} title={`${f.label}: ${m.label}`} aria-label={`${f.label}: ${m.label}`}>
                      {m.text}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-[10px] text-gray-400 mt-2">✓ יש · ◐ מוגבל (רק מה שאושר) · ✕ אין</p>
    </div>
  );
}

// בעמוד המוצר: הסבר על הגרסה שנבחרה + חלון השוואה בין כל הגרסאות של המוצר
export function ProductVersionHelp({ versions, selected, onSelect }: { versions: any[]; selected: any; onSelect: (v: any) => void }) {
  const names = versions.map(versionName).filter(Boolean);
  const infos = useVersionInfos(names);
  const [open, setOpen] = useState(false);
  const selectedName = selected ? versionName(selected) : '';
  const current = infos.find((v) => v.name === selectedName);

  if (!names.length) return null;
  return (
    <>
      {current?.description ? (
        <div className="bg-orange-50/60 border border-orange-100 rounded-xl p-3 text-xs text-gray-700 leading-relaxed">
          <b className="text-gray-900">
            {current.icon} {current.title}:
          </b>{' '}
          {current.description}
        </div>
      ) : null}
      {names.length > 0 && (
        <button type="button" onClick={() => setOpen(true)} className="text-xs font-black text-orange-700 underline underline-offset-4 cursor-pointer">
          ❓ מה ההבדל בין הגרסאות?
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-[110] bg-black/60 flex items-end sm:items-center justify-center sm:p-4" onClick={() => setOpen(false)} dir="rtl">
          <div className="bg-white w-full sm:max-w-2xl max-h-[88vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-black text-gray-900">מה ההבדל בין הגרסאות?</h3>
                <p className="text-xs text-gray-500">אותו מכשיר, ברמות סינון שונות. לחצו על גרסה כדי לבחור אותה.</p>
              </div>
              <button onClick={() => setOpen(false)} className="w-9 h-9 rounded-full bg-gray-100 text-gray-500 shrink-0 cursor-pointer" aria-label="סגירה">
                ✕
              </button>
            </div>

            <VersionTable
              versions={infos}
              selected={selectedName}
              onSelect={(name) => {
                const v = versions.find((x) => versionName(x) === name);
                if (v) onSelect(v);
                setOpen(false);
              }}
            />

            <ul className="space-y-2">
              {infos.map((v) => (
                <li key={v.name} className="text-xs text-gray-700 leading-relaxed">
                  <b className="text-gray-900">
                    {v.icon} {v.title}:
                  </b>{' '}
                  {v.description}
                </li>
              ))}
            </ul>

            <Link href="/guide/versions" className="block text-center bg-gray-900 text-white py-3 rounded-2xl text-xs font-black">
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
  if (!infos.length) return <p className="text-xs text-gray-400">טוען...</p>;
  return (
    <div className="space-y-4">
      <VersionTable versions={infos} />
      <ul className="space-y-2">
        {infos.map((v) => (
          <li key={v.name} className="text-sm text-gray-700 leading-relaxed">
            <b className="text-gray-900">
              {v.icon} {v.title}:
            </b>{' '}
            {v.description}
          </li>
        ))}
      </ul>
    </div>
  );
}
