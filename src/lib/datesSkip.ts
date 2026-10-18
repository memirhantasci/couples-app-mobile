import { safeStorage as AsyncStorage } from "@/lib/safeStorage";

const datesSkippedKey = (userId: string) => `@dates_skipped_${userId}`;

/**
 * Kullanıcı tarih ekranında "Daha Sonra Belirle" dediyse true döner.
 * hasDates hesaplayan tüm akışlar (AuthContext, login, verify, verify-device)
 * aynı bayrağı okur; böylece atlayan kullanıcı her girişte tarih ekranına düşmez.
 */
export async function isDatesSkipped(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  return (await AsyncStorage.getItem(datesSkippedKey(userId))) === "true";
}

export async function setDatesSkipped(userId: string): Promise<void> {
  await AsyncStorage.setItem(datesSkippedKey(userId), "true");
}
