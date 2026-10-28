/**
 * Sekme olarak bellekte kalan form ekranları (add-memory, add-photo, add-daily-note) kapatılınca
 * yok edilmez: bir sonraki açılışta eski taslak ya da düzenlenen eski kayıt görünürdü. Eskiden bunu
 * ekran her odaklandığında formu silerek çözüyorlardı; ama menüye (üst modal) girip dönmek de
 * odaklanma sayılıyor ve yazılan metin ile seçilen fotoğraf kayboluyordu.
 *
 * Çözüm: formu açan her yönlendirme yeni bir `entry` parametresi taşır. Form yalnızca bu değer
 * değişince (yeni bir açılış) baştan kurulur; menüden dönüşte parametre aynı kalır ve taslak korunur.
 */

const ENTRY_PARAM = "entry";

let entryCounter = 0;

/** Bir form ekranını "yeni açılış" olarak açan yönlendirme: `router.push(openForm("/(tabs)/add-photo"))`. */
export function openForm<P extends string>(pathname: P, params: Record<string, string> = {}) {
  entryCounter += 1;
  return { pathname, params: { ...params, [ENTRY_PARAM]: `${Date.now()}-${entryCounter}` } };
}

/** Route parametrelerinden mevcut açılışın kimliği (parametre yoksa boş). */
export function formEntryOf(params: Record<string, string | string[] | undefined>): string {
  const value = params[ENTRY_PARAM];
  return typeof value === "string" ? value : "";
}
