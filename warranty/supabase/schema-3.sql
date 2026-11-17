-- שדרוג 3: תמונת מוצר נפרדת מתמונת הקבלה (מוצגת בגדול ברשימה)
alter table public.wr_receipts add column if not exists product_photo text;
-- wr_save_receipt עודכנה לשמור את product_photo (רק קישור מהדלי wr-photos). הגרסה המלאה הורצה כמיגרציה warranty_product_photo.
