-- יומן בונוסים: מכירות מהקופה (מכשירים שנמכרו על שמי, לפי חודש)
-- register = { "2026-11": { "count": 12, "rate": 10 }, ... }
alter table public.settings add column if not exists register jsonb;
