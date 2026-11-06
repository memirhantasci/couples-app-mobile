import { supabase } from "@/lib/supabase";
import i18n from "@/lib/i18n";

/** Galeri / harita / takvimde gösterilen bir fotoğrafın depolama yolları. */
export interface ArchivedPhotoFiles {
  /** Gerçek kayıtlarda photo_archive.id (uuid); demo verisinde sayı. */
  id: string | number;
  storage_path: string;
  thumb_path?: string | null;
}

/**
 * Fotoğrafı siler (yalnızca yükleyen). Premium gerekmez: silme hakkı abonelikten bağımsızdır
 * (sunucuda delete_archived_photo). Tam boy görsel ve küçük resim, kayıt silinince sunucunun silme
 * kuyruğundan depodan kaldırılır (bkz. migrations/20261104000003_subscription_lifecycle.sql).
 * Kayıt silinemezse hata fırlatır.
 */
export async function deleteArchivedPhoto(photo: ArchivedPhotoFiles) {
  const { data: deleted, error } = await supabase.rpc("delete_archived_photo", { p_photo_id: photo.id });
  if (error) throw error;
  if (deleted !== true) throw new Error(i18n.t("photos.errors.deleteFailed"));
}
