'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { FacetState, EMPTY_FACETS, activeCount, buildFacets, Option } from '@/lib/facets';
import { resolveVersion } from '@/lib/versionGuide';
import { VersionMark } from './Logos';
import Icon from './Icon';

// סרגל הסינון: מציג רק סינונים שרלוונטיים למוצרים שמוצגים (ראו lib/facets.ts)

let metaPromise: Promise<{ kosher: any[]; versions: any[] }> | null = null;
const loadMeta = () =>
  (metaPromise ||= Promise.all([
    supabase.from('kosher_options').select('name, image_url'),
    supabase.from('versions').select('*'),
  ])
    .then(([k, v]) => ({ kosher: k.data || [], versions: v.data || [] }))
    .catch(() => ({ kosher: [], versions: [] })));

const chip = (active: boolean) =>
  `shrink-0 text-xs font-bold px-3 py-1.5 rounded-full border-2 transition cursor-pointer whitespace-nowrap inline-flex items-center gap-1.5 ${
    active ? 'bg-orange-600 text-white border-orange-600 shadow-xs' : 'bg-white text-gray-700 border-orange-100 hover:border-orange-300'
  }`;
const Count = ({ n, active }: { n: number; active: boolean }) => (
  <span className={`text-[10px] px-1.5 rounded-full ${active ? 'bg-white/25 text-white' : 'bg-orange-50 text-orange-700'}`}>{n}</span>
);

function Row({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-black text-gray-600 shrink-0 inline-flex items-center gap-1 w-[4.5rem]">
        <Icon name={icon} size={14} className="text-orange-600" /> {title}
      </span>
      <div className="flex gap-2 overflow-x-auto no-scrollbar py-0.5 flex-1 min-w-0">{children}</div>
    </div>
  );
}

export default function SmartFilters({
  products,
  value,
  onChange,
  resultCount,
}: {
  products: any[];
  value: FacetState;
  onChange: (f: FacetState) => void;
  resultCount: number;
}) {
  const [meta, setMeta] = useState<{ kosher: any[]; versions: any[] }>({ kosher: [], versions: [] });
  useEffect(() => {
    loadMeta().then(setMeta);
  }, []);

  const f = buildFacets(products);
  const set = (patch: Partial<FacetState>) => onChange({ ...value, ...patch });
  const pick = (key: 'kosher' | 'version' | 'price', o: Option) => set({ [key]: value[key] === o.value ? '' : o.value } as Partial<FacetState>);
  const logoOf = (name: string) => meta.kosher.find((k) => String(k.name).trim() === name)?.image_url;
  const active = activeCount(value);

  if (!f.brands.length && !f.kosher.length && !f.versions.length && !f.prices.length && !f.sale) return null;

  return (
    <div className="bg-orange-50/60 border-2 border-orange-200/80 rounded-3xl p-3 sm:p-4 space-y-2.5" dir="rtl">
      <div className="flex items-center justify-between">
        <span className="text-xs font-black text-gray-900 inline-flex items-center gap-1.5">
          <Icon name="search" size={15} className="text-orange-600" /> סינון
          {active > 0 && <span className="text-[11px] font-bold text-gray-500">· {resultCount} מוצרים</span>}
        </span>
        {active > 0 && (
          <button type="button" onClick={() => onChange(EMPTY_FACETS)} className="text-[11px] font-black text-orange-700 hover:underline cursor-pointer inline-flex items-center gap-1">
            <Icon name="x" size={12} /> ניקוי הכל
          </button>
        )}
      </div>

      {f.kosher.length > 0 && (
        <Row title="כשרות" icon="kosher">
          {f.kosher.map((o) => (
            <button key={o.value} type="button" onClick={() => pick('kosher', o)} className={chip(value.kosher === o.value)}>
              {logoOf(o.value) && <img src={logoOf(o.value)} alt="" className="w-5 h-5 object-contain bg-white rounded" />}
              {o.label} <Count n={o.count} active={value.kosher === o.value} />
            </button>
          ))}
        </Row>
      )}

      {f.versions.length > 0 && (
        <Row title="גרסה" icon="settings">
          {f.versions.map((o) => {
            const info = resolveVersion(o.value, meta.versions);
            return (
              <button key={o.value} type="button" onClick={() => pick('version', o)} className={chip(value.version === o.value)} title={info.description}>
                <VersionMark v={info} size={16} />
                {info.title || o.label} <Count n={o.count} active={value.version === o.value} />
              </button>
            );
          })}
        </Row>
      )}

      {f.prices.length > 0 && (
        <Row title="מחיר" icon="wallet">
          {f.prices.map((o) => (
            <button key={o.value} type="button" onClick={() => pick('price', o)} className={chip(value.price === o.value)}>
              {o.label} <Count n={o.count} active={value.price === o.value} />
            </button>
          ))}
          {f.sale > 0 && (
            <button type="button" onClick={() => set({ sale: !value.sale })} className={chip(value.sale)}>
              <Icon name="tag" size={13} /> רק מבצעים <Count n={f.sale} active={value.sale} />
            </button>
          )}
        </Row>
      )}
      {!f.prices.length && f.sale > 0 && (
        <Row title="מבצע" icon="tag">
          <button type="button" onClick={() => set({ sale: !value.sale })} className={chip(value.sale)}>
            רק מבצעים <Count n={f.sale} active={value.sale} />
          </button>
        </Row>
      )}

      {f.brands.length > 0 && (
        <Row title="מותג" icon="star">
          {f.brands.map((o) => {
            const on = value.brands.includes(o.value);
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => set({ brands: on ? value.brands.filter((b) => b !== o.value) : [...value.brands, o.value] })}
                className={chip(on)}
              >
                {on && <Icon name="check" size={12} strokeWidth={2.6} />}
                {o.label} <Count n={o.count} active={on} />
              </button>
            );
          })}
        </Row>
      )}
    </div>
  );
}
