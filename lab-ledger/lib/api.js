import { supabase } from './supabase';

// מזהה הקופה = הקישור הסודי. נשמר בטלפון.
let book = null;
export const setBook = (id) => { book = id; };

async function rpc(name, args) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.message);
  return data;
}

export const createBook = (name) => rpc('ll_create_book', { p_name: name || '' });
export const getBook = (id) => rpc('ll_get_book', { p_book: id || book });
export const updateBook = (patch) => rpc('ll_update_book', { p_book: book, p: patch });
export const addAdj = (adj) => rpc('ll_add_adj', { p_book: book, p_adj: adj });
export const saveTx = (tx) => rpc('ll_save_tx', { p_book: book, p_tx: tx });
export const deleteTx = (id) => rpc('ll_delete_tx', { p_book: book, p_id: id });

export async function uploadPhoto(blob) {
  const path = `${book}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await supabase.storage.from('ll-photos').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  if (error) throw new Error(error.message);
  return supabase.storage.from('ll-photos').getPublicUrl(path).data.publicUrl;
}
