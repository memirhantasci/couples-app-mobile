import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { decode } from "base64-arraybuffer";
import { supabase } from "@/lib/supabase";

/**
 * Profil fotoğrafı (PP) — Premium'a özel.
 * Dosya her kullanıcı için tek: `avatars/${userId}/avatar.jpg` (upsert).
 * Sunucu tarafı (storage RLS + users trigger) Premium'suz yazmayı ayrıca reddeder.
 */
export const AVATAR_BUCKET = "avatars";
const AVATAR_SIZE = 512;
const AVATAR_QUALITY = 0.82;

export type AvatarSource = "camera" | "library";

export class AvatarPermissionError extends Error {
  constructor(public readonly source: AvatarSource) {
    super(source === "camera" ? "camera_permission_denied" : "library_permission_denied");
  }
}

export class AvatarPremiumRequiredError extends Error {
  constructor() {
    super("premium_required");
  }
}

const avatarPath = (userId: string) => `${userId}/avatar.jpg`;

/** Kamera ya da galeriden kare kırpılmış tek bir fotoğraf seçtirir. İptalde `null`. */
export async function pickAvatarImage(source: AvatarSource): Promise<ImagePicker.ImagePickerAsset | null> {
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  };

  let result: ImagePicker.ImagePickerResult;
  if (source === "camera") {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new AvatarPermissionError("camera");
    result = await ImagePicker.launchCameraAsync(options);
  } else {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) throw new AvatarPermissionError("library");
    result = await ImagePicker.launchImageLibraryAsync(options);
  }

  if (result.canceled || !result.assets?.[0]) return null;
  return result.assets[0];
}

/**
 * Kırpma ekranı olmayan platformlarda (web) da kare olsun diye ortadan kare kırpar,
 * en fazla 512x512'ye küçültür ve sıkıştırılmış JPEG base64 döndürür.
 */
export async function processAvatarImage(asset: Pick<ImagePicker.ImagePickerAsset, "uri" | "width" | "height">): Promise<string> {
  const context = ImageManipulator.manipulate(asset.uri);
  try {
    const { width, height } = asset;
    const side = width && height ? Math.min(width, height) : 0;
    if (side > 0 && width !== height) {
      context.crop({
        originX: Math.floor((width - side) / 2),
        originY: Math.floor((height - side) / 2),
        width: side,
        height: side,
      });
    }
    if (side === 0 || side > AVATAR_SIZE) {
      context.resize({ width: AVATAR_SIZE, height: AVATAR_SIZE });
    }

    const rendered = await context.renderAsync();
    const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: AVATAR_QUALITY, base64: true });
    rendered.release();
    if (!saved.base64) throw new Error("Fotoğraf işlenemedi.");
    return saved.base64;
  } finally {
    context.release();
  }
}

/**
 * Avatarı storage'a yükler ve `users.avatar_url`'i günceller.
 * `?v=` zaman damgası aynı dosya adına rağmen expo-image önbelleğinin yenilenmesini garanti eder.
 */
export async function uploadAvatar(params: { userId: string; isPremium: boolean; base64: string }): Promise<string> {
  // İkinci istemci kalkanı: çağıran taraf atlansa bile Premium'suz yükleme yapılmaz
  if (!params.isPremium) throw new AvatarPremiumRequiredError();

  const path = avatarPath(params.userId);
  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, decode(params.base64), { contentType: "image/jpeg", upsert: true });
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  const avatarUrl = `${data.publicUrl}?v=${Date.now()}`;

  const { error: updateError } = await supabase
    .from("users")
    .update({ avatar_url: avatarUrl })
    .eq("id", params.userId);
  if (updateError) throw updateError;

  return avatarUrl;
}

/** Avatarı kaldırır (Premium şartı yok — kullanıcı her zaman harf avatarına dönebilir). */
export async function removeAvatar(userId: string): Promise<void> {
  const { error: updateError } = await supabase
    .from("users")
    .update({ avatar_url: null })
    .eq("id", userId);
  if (updateError) throw updateError;

  // Dosya silinemese bile profil artık ona işaret etmiyor; sessizce geç
  await supabase.storage.from(AVATAR_BUCKET).remove([avatarPath(userId)]).catch(() => {});
}

/** Sunucunun Premium kalkanına (trigger P0010 / storage RLS) takılan hataları ayırt eder. */
export function isPremiumRejection(error: unknown): boolean {
  if (error instanceof AvatarPremiumRequiredError) return true;
  const e = error as { code?: string; message?: string; statusCode?: string | number } | null;
  if (!e) return false;
  if (e.code === "P0010") return true;
  const message = (e.message || "").toLowerCase();
  return message.includes("row-level security") || message.includes("premium");
}
