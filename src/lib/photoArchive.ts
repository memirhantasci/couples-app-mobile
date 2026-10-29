import { supabase } from "@/lib/supabase";
import { removeStoredFiles } from "@/lib/storageImages";
import i18n from "@/lib/i18n";

/** Galeri / harita / takvimde gösterilen bir fotoğrafın depolama yolları. */
export interface ArchivedPhotoFiles {
  id: number;
  storage_path: string;
  thumb_path?: string | null;
}

/**
 * Fotoğrafı siler: önce kayıt (yalnızca yükleyen silebilir), kayıt gerçekten silindiyse dosyalar.
 * Sıra önemli: dosyalar önce silinip kayıt silinemezse galeride açılmayan bir fotoğraf kalırdı.
 * Kayıt silinemezse hata fırlatır.
 */
export async function deleteArchivedPhoto(photo: ArchivedPhotoFiles, userId: string) {
  const { error, count } = await supabase
    .from("photo_archive")
    .delete({ count: "exact" })
    .eq("id", photo.id)
    .eq("user_id", userId);
  if (error) throw error;
  if (!count) throw new Error(i18n.t("photos.errors.deleteFailed"));

  await removeStoredFiles("photos", [photo.storage_path, photo.thumb_path]);
}
