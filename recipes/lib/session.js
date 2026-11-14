'use client';
// מצב המתכון הפתוח (שלב, סימוני מצרכים, מנות). כשהמתכון מוצג בטלוויזיה — משותף איתה.
import { useCallback, useEffect, useState } from 'react';

export function useRecipeSession(cast, recipe, follow) {
  const active = cast.state.recipeId === recipe.id;
  const [local, setLocal] = useState({ step: 0, servings: null, checked: {}, page: 0 });

  // "הטלוויזיה עוקבת": פתיחת מתכון בטלפון פותחת אותו גם בטלוויזיה
  useEffect(() => {
    if (follow && !active) cast.update({ screen: 'recipe', recipeId: recipe.id, step: 0, servings: null, checked: {}, page: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipe.id, follow]);

  const s = active ? cast.state : local;
  const set = useCallback((patch) => {
    if (active) cast.update(typeof patch === 'function' ? (st) => patch(st) : patch);
    else setLocal((l) => ({ ...l, ...(typeof patch === 'function' ? patch(l) : patch) }));
  }, [active, cast]);

  // הצגה בטלוויזיה (גם כשהמעקב כבוי)
  const show = useCallback((screen = 'recipe', extra = {}) => {
    cast.update({ screen, recipeId: recipe.id, step: s.step || 0, servings: s.servings ?? null, checked: s.checked || {}, page: s.page || 0, ...extra });
  }, [cast, recipe.id, s]);

  return { s, set, active, show };
}
