export const MAX_PLACE_NAME = 80;

export function cleanPlaceName(name: unknown): string | null {
  if (typeof name !== "string") return null;
  const trimmed = name.trim().slice(0, MAX_PLACE_NAME);
  return trimmed || null;
}

/** Paylaşılan görselde en fazla kaç parça: ilçe + şehir ya da şehir + ülke. */
const MAX_NAME_PARTS = 2;

/** Sokak düzeyinin altını ele veren sözcükler (sade biçimde: küçük harf, Türkçe/Almanca harfsiz). */
const STREET_WORDS = new Set([
  // Türkçe
  "sokak", "sokagi", "sok", "sk", "cadde", "caddesi", "cad", "cd", "bulvar", "bulvari", "bulv", "blv",
  "mahalle", "mahallesi", "mah", "mh", "mevki", "mevkii", "apartman", "apartmani", "apt", "daire", "blok",
  "sitesi", "konutlari", "evleri", "rezidans",
  // İngilizce
  "street", "road", "avenue", "boulevard", "blvd", "lane", "drive", "highway", "hwy", "parkway", "pkwy",
  "terrace", "crescent", "alley", "residence",
  // Fransızca, Almanca, Güney Avrupa
  "rue", "allee", "impasse", "chemin", "quai", "place", "platz", "calle", "avenida", "av", "paseo", "carrer",
  "plaza", "carretera", "rua", "travessa", "via", "viale", "piazza", "corso",
]);

/** Kısaltmalar yalnızca parçanın sonundaysa sokaktır: "Baker St" evet, "St. Louis" hayır. */
const TRAILING_STREET_WORDS = new Set(["st", "rd", "ave", "ln", "dr", "ct", "pl", "sq", "way"]);

const COMPOUND_STREET_SUFFIX = /(strasse|gasse|str)$/;

const POSTAL_PATTERNS = [
  /\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/g, // Birleşik Krallık: NW1 6XE
  /\b[A-Z]\d[A-Z]\s?\d[A-Z]\d\b/g, // Kanada: M5V 2T6
  /\b\d{4}\s?[A-Z]{2}\b/g, // Hollanda: 1015 CJ
  /(^|\s)\d{3}-\d{4}(?=\s|$)/g, // Japonya: 100-0001
  /(^|\s)\d{4,6}(-\d{3,4})?(?=\s|$)/g, // Türkiye, ABD, Almanya: 34710, 94043-1351
];

/** Türkçe İ/I ve aksan farkı eşleşmeyi bozmasın diye yalnızca karşılaştırmada kullanılır. */
function plainWord(word: string): string {
  return word
    .replace(/[.,:;]+$/, "")
    .replace(/İ/g, "i")
    .toLowerCase()
    .replace(/ı/g, "i")
    .replace(/ß/g, "ss")
    .replace(/ğ/g, "g")
    .replace(/ş/g, "s")
    .replace(/ç/g, "c")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/é|è/g, "e");
}

function isStreetLevel(part: string): boolean {
  if (/\d/.test(part)) return true;
  const words = part.split(/\s+/).map(plainWord);
  if (words.some((word) => STREET_WORDS.has(word) || COMPOUND_STREET_SUFFIX.test(word))) return true;
  return words.length > 1 && TRAILING_STREET_WORDS.has(words[words.length - 1]);
}

function withoutPostalCode(part: string): string {
  return POSTAL_PATTERNS.reduce((text, pattern) => text.replace(pattern, " "), part).replace(/\s+/g, " ").trim();
}

/**
 * Ters coğrafi kodlamanın tam adresini paylaşılabilir düzeye indirir: en fazla ilçe/şehir (yurt dışında şehir, ülke).
 * Kapı numarası, sokak, mahalle ve posta kodu atılır; yalnızca sokak düzeyinde bilgi varsa null döner (poster yer
 * satırını gizler). Rakam içeren her parça elenir: yanlışlıkla ilçe adı gitse bile adres sızmasından iyidir.
 */
export function shortenPlaceName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const parts = raw
    .split(/[,،、/|\n]+|\s[-–—]\s/)
    .map((part) => withoutPostalCode(part))
    .filter((part) => part && !isStreetLevel(part));

  const unique = parts.filter((part, index) => parts.findIndex((other) => plainWord(other) === plainWord(part)) === index);
  // Eyalet kısaltması (CA, NY) şehir ile ülke arasında yer kaplamasın; "USA" gibi son parça kalır
  const named = unique.filter((part, index) => index === unique.length - 1 || !/^[A-Z]{1,3}$/.test(part));
  const isHomeCountry = (part: string) => ["turkiye", "turkey"].includes(plainWord(part));
  const withoutCountry = named.length > 1 ? named.filter((part) => !isHomeCountry(part)) : named;
  return cleanPlaceName(withoutCountry.slice(-MAX_NAME_PARTS).join(", "));
}
