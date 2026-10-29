import type { TFunction } from "i18next";

/**
 * Varsayılan (otomatik oluşturulan) özel gün kartları.
 *
 * ⚠️ Buradaki başlık ve açıklama metinleri VERİTABANINA yazılan değerlerdir: kartlar `memories.title`
 * ile eşleştirilip bulunur. Bu yüzden ASLA çevrilmez; dil değişse de aynı kalmalı (aksi halde yinelenen
 * kayıtlar oluşur). Ekranda gösterilirken `localizeDefaultMemory` ile yerelleştirilir.
 */
export const DEFAULT_MEMORY_TITLES = {
  meet: "Tanışma Yıl Dönümümüz",
  relationship: "Sevgili Olma Yıl Dönümümüz",
} as const;

export const DEFAULT_MEMORY_TITLE_LIST: string[] = [DEFAULT_MEMORY_TITLES.meet, DEFAULT_MEMORY_TITLES.relationship];

export const DEFAULT_MEMORY_DESCRIPTIONS = {
  meet: "Hikayemizin başladığı o güzel gün...",
  relationship: "Aşkımızın resmi olarak başladığı gün...",
} as const;

/**
 * Kayıt varsayılan bir özel gün kartıysa (başlığı veritabanındaki sabit başlıkla eşleşiyorsa)
 * geçerli dildeki başlık ve açıklamayı döndürür; değilse null (kullanıcının kendi metni olduğu gibi gösterilir).
 */
export function localizeDefaultMemory(
  memory: { title?: string | null },
  t: TFunction
): { title: string; description: string } | null {
  if (memory.title === DEFAULT_MEMORY_TITLES.meet) {
    return { title: t("memories.defaults.meet.title"), description: t("memories.defaults.meet.description") };
  }
  if (memory.title === DEFAULT_MEMORY_TITLES.relationship) {
    return {
      title: t("memories.defaults.relationship.title"),
      description: t("memories.defaults.relationship.description"),
    };
  }
  return null;
}
