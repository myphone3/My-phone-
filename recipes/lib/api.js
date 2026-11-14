import { supabase } from './supabase';

async function rpc(name, args) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.message);
  return data;
}

export const createKitchen = (name) => rpc('rc_create_kitchen', { p_name: name || '' });
export const getKitchen = (id) => rpc('rc_get_kitchen', { p_kitchen: id });
export const updateKitchen = (id, { name = null, music = null }) => rpc('rc_update_kitchen', { p_kitchen: id, p_name: name, p_music: music });
export const saveRecipe = (kitchen, recipe) => rpc('rc_save_recipe', { p_kitchen: kitchen, p_recipe: recipe });
export const setFavorite = (kitchen, id, value) => rpc('rc_set_favorite', { p_kitchen: kitchen, p_id: id, p_value: value });
export const markCooked = (kitchen, id) => rpc('rc_mark_cooked', { p_kitchen: kitchen, p_id: id });
export const deleteRecipe = (kitchen, id) => rpc('rc_delete_recipe', { p_kitchen: kitchen, p_id: id });

// העלאת תמונה לאחסון, מחזיר כתובת ציבורית
export async function uploadImage(kitchen, blob) {
  const path = `${kitchen}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await supabase.storage.from('rc-photos').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  if (error) throw new Error(error.message);
  return supabase.storage.from('rc-photos').getPublicUrl(path).data.publicUrl;
}
