'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { FEATURES, FeatureKey, FeatureValue, featureMark, isKosherPlay, resolveVersion } from '@/lib/versionGuide';
import { showToast } from '@/lib/toast';
import { VersionMark } from '@/components/Logos';

// גרסאות: השם מופיע בבחירת גרסה במוצר, והתיאור והיכולות מוצגים ללקוחות ב"מה ההבדל בין הגרסאות?" ובמדריך.

export default function AdminVersionsPage() {
  const [versions, setVersions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ description: string; image_url: string; features: Partial<Record<FeatureKey, FeatureValue>> }>({ description: '', image_url: '', features: {} });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchVersions();
  }, []);

  const fetchVersions = async () => {
    setLoading(true);
    const { data } = await supabase.from('versions').select('*').order('created_at', { ascending: false });
    if (data) setVersions(data);
    setLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const { error } = await supabase.from('versions').insert([{ name: name.trim() }]);
    if (error) {
      showToast('שגיאה בהוספת הגרסה: ' + error.message, { kind: 'error' });
    } else {
      setName('');
      fetchVersions();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('האם למחוק גרסה זו?')) return;
    const { error } = await supabase.from('versions').delete().eq('id', id);
    if (error) showToast('שגיאה במחיקה: ' + error.message, { kind: 'error' });
    else fetchVersions();
  };

  const startEdit = (v: any) => {
    const info = resolveVersion(v.name, versions);
    setDraft({ description: info.description, image_url: v.image_url || '', features: { ...info.features } });
    setEditing(v.id);
  };

  const uploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `version_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from('product-images').upload(fileName, file);
      if (error) throw error;
      const { data } = supabase.storage.from('product-images').getPublicUrl(fileName);
      setDraft((d) => ({ ...d, image_url: data.publicUrl }));
    } catch (err: any) {
      showToast('העלאת הלוגו נכשלה: ' + err.message, { kind: 'error' });
    } finally {
      setUploading(false);
    }
  };

  const saveDetails = async (id: string) => {
    setSaving(true);
    const { error } = await supabase.from('versions').update({ description: draft.description.trim() || null, features: draft.features, image_url: draft.image_url || null }).eq('id', id);
    setSaving(false);
    if (error) {
      showToast(
        error.message.includes('column') ? 'צריך קודם להריץ ב-Supabase את הקובץ supabase/2026-11-versions-logo.sql' : 'השמירה נכשלה: ' + error.message,
        { kind: 'error' }
      );
      return;
    }
    showToast('נשמר ✓', { kind: 'success' });
    setEditing(null);
    fetchVersions();
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-2 sm:p-4" dir="rtl">
      <div className="space-y-1">
        <h1 className="text-xl font-black text-gray-900 border-r-4 border-orange-600 pr-3 flex items-center gap-2">
          <span>⚙️</span>
          <span>ניהול גירסאות</span>
        </h1>
        <p className="text-xs text-gray-500 font-medium pr-4">
          הגרסאות שמופיעות בהוספת מוצרים. לכל גרסה אפשר לכתוב הסבר ולסמן מה יש בה. הלקוחות רואים את זה בעמוד המוצר
          (&quot;מה ההבדל בין הגרסאות?&quot;) ובמדריך באתר.
        </p>
      </div>

      <div className="bg-white rounded-3xl p-4 sm:p-6 border shadow-xs">
        <form onSubmit={handleSave} className="flex items-center gap-2 sm:gap-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="שם הגרסה החדשה"
            className="flex-1 min-w-0 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-xs outline-none focus:border-orange-500 transition"
            required
          />
          <button type="submit" className="shrink-0 bg-black hover:bg-gray-800 text-white font-black px-4 sm:px-6 py-3 rounded-2xl text-xs transition shadow-md whitespace-nowrap cursor-pointer">
            + הוסף גרסה
          </button>
        </form>
      </div>

      <div className="bg-white rounded-3xl border shadow-xs overflow-hidden divide-y divide-gray-100">
        {loading ? (
          <div className="text-center py-16 text-xs text-gray-400 font-bold">טוען גירסאות...</div>
        ) : versions.length === 0 ? (
          <div className="text-center py-16 text-xs text-gray-400">אין גרסאות במערכת.</div>
        ) : (
          versions.map((v) => {
            const info = resolveVersion(v.name, versions);
            const isEditing = editing === v.id;
            return (
              <div key={v.id} className="p-4 space-y-3">
                <div className="flex justify-between items-start gap-3">
                  <div className="min-w-0">
                    <span className="font-black text-sm text-gray-900 flex items-center gap-2">
                      <VersionMark v={info} size={22} /> {v.name}
                    </span>
                    {!isEditing && <p className="text-xs text-gray-500 mt-1 leading-relaxed">{info.description || 'אין הסבר עדיין'}</p>}
                    {!isEditing && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {FEATURES.filter((f) => info.features[f.key] === 'yes').map((f) => (
                          <span key={f.key} className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${featureMark(info.features[f.key]).cls}`}>
                            {f.icon} {f.label}
                          </span>
                        ))}
                      </div>
                    )}
                    {!v.description && !isEditing && <p className="text-[10px] text-amber-700 mt-1.5">ההסבר הזה הוא ברירת מחדל. כדאי לבדוק שהוא נכון ולשמור.</p>}
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    {!isEditing && (
                      <button onClick={() => startEdit(v)} className="bg-orange-50 hover:bg-orange-100 text-orange-700 px-3 py-1.5 rounded-xl text-xs font-bold border border-orange-200 cursor-pointer">
                        ✏️ הסבר ויכולות
                      </button>
                    )}
                    <button onClick={() => handleDelete(v.id)} className="bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-xl text-xs font-bold border border-red-100 cursor-pointer">
                      🗑️
                    </button>
                  </div>
                </div>

                {isEditing && (
                  <div className="bg-gray-50 rounded-2xl p-3 space-y-3">
                    <label className="block text-xs font-bold text-gray-700 space-y-1">
                      <span>הסבר ללקוח (משפט או שניים)</span>
                      <textarea
                        value={draft.description}
                        onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                        rows={3}
                        maxLength={400}
                        className="w-full bg-white border rounded-xl p-2.5 text-xs font-normal"
                      />
                    </label>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="w-12 h-12 rounded-xl bg-white border flex items-center justify-center">
                        <VersionMark v={{ name: v.name, icon: info.icon, logo: draft.image_url || undefined }} size={34} />
                      </span>
                      <label className="bg-white border rounded-xl px-3 py-2 text-xs font-bold text-gray-700 cursor-pointer hover:bg-gray-50">
                        {uploading ? 'מעלה...' : draft.image_url ? '🖼️ החלפת לוגו' : '🖼️ העלאת לוגו לגרסה'}
                        <input type="file" accept="image/*" className="hidden" onChange={uploadLogo} disabled={uploading} />
                      </label>
                      {draft.image_url && (
                        <button type="button" onClick={() => setDraft((d) => ({ ...d, image_url: '' }))} className="text-xs text-red-600 font-bold cursor-pointer">
                          הסרה
                        </button>
                      )}
                      {isKosherPlay(v.name) && <span className="text-[10px] text-gray-500">הלוגו של כשר פליי יוצג בכל מקום שמופיעה הגרסה</span>}
                    </div>
                    <div>
                      <span className="block text-xs font-bold text-gray-700 mb-1.5">מה יש בגרסה? (לחיצה מחליפה בין יש לאין)</span>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {FEATURES.map((f) => {
                          const value: FeatureValue = draft.features[f.key] === 'yes' ? 'yes' : 'no';
                          const m = featureMark(value);
                          return (
                            <button
                              key={f.key}
                              type="button"
                              onClick={() =>
                                setDraft((d) => ({ ...d, features: { ...d.features, [f.key]: value === 'yes' ? 'no' : 'yes' } }))
                              }
                              className="flex items-center justify-between gap-2 bg-white border rounded-xl px-3 py-2 text-xs cursor-pointer"
                            >
                              <span className="font-bold text-gray-800">
                                {f.icon} {f.label}
                              </span>
                              <span className={`px-2 py-0.5 rounded-lg font-black ${m.cls}`}>
                                {m.text} {m.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => saveDetails(v.id)} disabled={saving} className="bg-orange-600 hover:bg-orange-700 text-white px-5 py-2.5 rounded-xl text-xs font-black cursor-pointer disabled:opacity-60">
                        {saving ? 'שומר...' : 'שמירה'}
                      </button>
                      <button onClick={() => setEditing(null)} className="bg-white border text-gray-600 px-4 py-2.5 rounded-xl text-xs font-bold cursor-pointer">
                        ביטול
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
