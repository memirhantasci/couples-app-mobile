import { SkyInputError, type SkyInputErrorCode, type SkyRequest, type SkyResult, type SkyTwilight } from "../astronomy";
import { cleanPlaceName, shortenPlaceName } from "./placeName";

export { cleanPlaceName, MAX_PLACE_NAME, shortenPlaceName } from "./placeName";

// ─── Tarih ────────────────────────────────────────────────────────────────────

/** Motorun alt sınırı. Üst sınır "bugün": gelecekteki bir gecenin gökyüzü bir anı değildir. */
export const SKY_MIN_DATE = "1900-01-01";
export const DEFAULT_SKY_TIME = "22:00";

export type SkyDateChoice = "meet" | "relationship" | "custom";

export interface SkyDateOption {
  id: SkyDateChoice;
  /** 'YYYY-MM-DD'; "custom" için seçilene kadar null */
  date: string | null;
  available: boolean;
  /** Pasif olma nedeni: çeviri anahtarı sonekine karşılık gelir */
  reason: "missing" | "future" | "outOfRange" | null;
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Bugünün yerel takvim günü, 'YYYY-MM-DD'. */
export function todayString(now: Date = new Date()): string {
  return formatYmd(now);
}

export function formatYmd(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${String(date.getFullYear()).padStart(4, "0")}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** 'YYYY-MM-DD' → yerel gün başı. Gerçek bir takvim günü değilse null. */
export function parseYmd(value: string): Date | null {
  const match = DATE_PATTERN.exec(value);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(year, month - 1, day);
  // setFullYear: 0-99 yılları JS'te 1900'lere kayar; burada zaten 1900 altı reddedilir
  const ok = date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  return ok ? date : null;
}

/** Seçilebilir mi: gerçek gün, 1900'den önce değil, bugünden sonra değil. */
export function dateRejection(value: string | null | undefined, today: string): SkyDateOption["reason"] {
  if (!value || !parseYmd(value)) return "missing";
  if (value < SKY_MIN_DATE) return "outOfRange";
  if (value > today) return "future";
  return null;
}

/** Çiftin kayıtlı tarihlerinden üç seçeneği kurar. Tarihi olmayan ya da geçersiz olan seçenek pasiftir. */
export function buildDateOptions(
  dates: { meetDate?: string | null; relationshipStartDate?: string | null },
  customDate: string | null,
  today: string
): SkyDateOption[] {
  const fromProfile = (id: "meet" | "relationship", raw: string | null | undefined): SkyDateOption => {
    // Sunucudan 'YYYY-MM-DDT...' gelirse yalnızca gün kısmı alınır
    const value = typeof raw === "string" ? raw.slice(0, 10) : null;
    const reason = dateRejection(value, today);
    return { id, date: reason ? null : value, available: reason === null, reason };
  };
  const customReason = customDate ? dateRejection(customDate, today) : null;
  return [
    fromProfile("meet", dates.meetDate),
    fromProfile("relationship", dates.relationshipStartDate),
    { id: "custom", date: customDate && !customReason ? customDate : null, available: true, reason: null },
  ];
}

/**
 * Varsayılan seçim: istenen (ör. yıldönümü modalından gelen) tarih kullanılabilirse o, yoksa tanışma günü,
 * sonra sevgili olma günü, ikisi de yoksa "başka bir tarih".
 */
export function defaultDateChoice(options: readonly SkyDateOption[], preferred?: SkyDateChoice): SkyDateChoice {
  const usable = (id: SkyDateChoice) => options.find((option) => option.id === id)?.available === true;
  if (preferred && preferred !== "custom" && usable(preferred)) return preferred;
  if (usable("meet")) return "meet";
  if (usable("relationship")) return "relationship";
  return "custom";
}

/** Seçili seçeneğin tarihi; "custom" henüz seçilmediyse null (ileri düğmesi pasif kalır). */
export function resolveChosenDate(options: readonly SkyDateOption[], choice: SkyDateChoice): string | null {
  const option = options.find((item) => item.id === choice);
  return option?.available ? option.date : null;
}

// ─── Konum ve saat ────────────────────────────────────────────────────────────

export interface SkyPlace {
  latitude: number;
  longitude: number;
  /** Boşsa poster yer satırını göstermez */
  name: string | null;
}

/** Demo modunda hazır gelen yer: gerçek bir konum izi bırakmaz. */
export const DEMO_SKY_PLACE: SkyPlace = { latitude: 41.0082, longitude: 28.9784, name: "İstanbul" };

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidTime(value: unknown): value is string {
  return typeof value === "string" && TIME_PATTERN.test(value);
}

export function isValidPlace(place: { latitude: unknown; longitude: unknown }): boolean {
  const { latitude, longitude } = place;
  return (
    typeof latitude === "number" &&
    typeof longitude === "number" &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

/**
 * MapPickerModal'ın LocationData'sından yer. Geçersiz koordinatta null.
 * Ad paylaşılan görsele gider: coğrafi kodlayıcıdan gelen ad ilçe/şehir düzeyine indirilir. `unresolvedNames`,
 * harita seçicinin adres çözülemeyince koyduğu yer tutucu metinlerdir; gerçek bir yer adı olmadıkları için posterde
 * görünmezler. `knownName`, seçiciye başlangıç olarak verdiğimiz addır (kullanıcı düzenlemiş olabilir): seçici pime
 * dokunulmadan onaylandığında onu aynen geri verir. Bu ad coğrafi kodlayıcıdan gelmedi, kısaltılmaz; yalnızca
 * uzunluk sınırı ve boşluk temizliği uygulanır ("İlk Buluşma 2019" kalır).
 */
export function placeFromLocation(
  location: { latitude: number; longitude: number; locationName?: string },
  unresolvedNames: readonly string[] = [],
  knownName: string | null = null
): SkyPlace | null {
  if (!isValidPlace(location)) return null;
  const raw = location.locationName?.trim() ?? "";
  let name: string | null;
  if (unresolvedNames.includes(raw)) name = null;
  else if (knownName && raw === knownName.trim()) name = cleanPlaceName(raw);
  else name = shortenPlaceName(raw);
  return { latitude: location.latitude, longitude: location.longitude, name };
}

export function timeFromDate(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/**
 * Seçilen gün bugünse ve verilen saat henüz gelmediyse şu anki saate ("HH:mm") çeker.
 * Geçmiş günlerde saat olduğu gibi korunur.
 */
export function clampTimeIfToday(date: string | null, time: string, now: Date = new Date()): string {
  const safe = isValidTime(time) ? time : DEFAULT_SKY_TIME;
  if (!date || date !== formatYmd(now)) return safe;
  const nowHm = timeFromDate(now);
  return safe > nowHm ? nowHm : safe;
}

/** 'HH:mm' → seçicinin başlangıç değeri (bugünün tarihinde o saat). */
export function dateFromTime(time: string): Date {
  const match = TIME_PATTERN.exec(time) ?? TIME_PATTERN.exec(DEFAULT_SKY_TIME)!;
  const date = new Date();
  date.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return date;
}

/** Tarih + saat + yer → motor isteği. Biçim hatasında SkyInputError'u motor da verir; burada erken ve net. */
export function buildSkyRequest(input: { date: string; time: string; place: SkyPlace }): SkyRequest {
  const { date, time, place } = input;
  if (!parseYmd(date)) throw new SkyInputError("INVALID_DATE", "date must be YYYY-MM-DD");
  if (!isValidTime(time)) throw new SkyInputError("INVALID_TIME", "time must be HH:mm");
  if (!isValidPlace(place)) throw new SkyInputError("INVALID_LOCATION", "invalid coordinates");
  return { date, time, latitude: place.latitude, longitude: place.longitude };
}

/**
 * Posterdeki tarih satırı: "14 Şubat 2025 · 22:00". Saat hatırlanmıyorsa varsayılan 22:00 yalnızca
 * hesapta kullanılır; posterde uydurma bir saat görünmesin diye yazılmaz.
 * `formatDay` biçimlendirmeyi (dayjs + dil) arayüzden alır, böylece mantık dile bağlı kalmaz.
 */
export function formatDateLine(date: string, time: string, timeKnown: boolean, formatDay: (parsed: Date) => string): string {
  const parsed = parseYmd(date);
  const day = parsed ? formatDay(parsed) : date;
  return timeKnown ? `${day} · ${time}` : day;
}

// ─── Doğruluk uyarıları ───────────────────────────────────────────────────────

export type SkyWarningKey = "daylight" | "twilight" | "gap" | "overlap" | "deviceTimeZone";

export type SkyDarkness = "bright" | "dim" | "dark";

/**
 * Yıldız görmek açısından gökyüzü: gündüz ve sivil alacakaranlık aydınlıktır, deniz alacakaranlığında sönük yıldızlar
 * görünmez, astronomik alacakaranlık (−12°…−18°) çıplak göz için zaten karanlık gece sayılır.
 */
export function skyDarkness(twilight: SkyTwilight): SkyDarkness {
  if (twilight === "day" || twilight === "civil") return "bright";
  return twilight === "nautical" ? "dim" : "dark";
}

/** Motor sonucundan gösterilecek uyarılar; sıra sabit (en önemli önce). */
export function selectWarnings(result: SkyResult): SkyWarningKey[] {
  const warnings: SkyWarningKey[] = [];
  if (result.timeZoneSource === "device") warnings.push("deviceTimeZone");
  if (result.timeAmbiguity === "gap") warnings.push("gap");
  if (result.timeAmbiguity === "overlap") warnings.push("overlap");
  const darkness = skyDarkness(result.sun.twilight);
  if (darkness === "bright") warnings.push("daylight");
  if (darkness === "dim") warnings.push("twilight");
  return warnings;
}

const ERROR_KEYS: Record<SkyInputErrorCode, string> = {
  INVALID_DATE: "sky.flow.errors.invalidDate",
  INVALID_TIME: "sky.flow.errors.invalidTime",
  INVALID_LOCATION: "sky.flow.errors.invalidLocation",
  OUT_OF_RANGE: "sky.flow.errors.outOfRange",
};

export const GENERIC_SKY_ERROR_KEY = "sky.flow.errors.generic";

/** Hata → çeviri anahtarı. Beklenmedik hatalar da kullanıcıya genel bir mesajla gösterilir. */
export function skyErrorKey(error: unknown): string {
  return error instanceof SkyInputError ? ERROR_KEYS[error.code] : GENERIC_SKY_ERROR_KEY;
}

// ─── Premium kapısı ───────────────────────────────────────────────────────────

export type SkyAction = "preview" | "storyShare" | "customTitle" | "printExport";
export type SkyGate = "allow" | "paywall" | "signup";

/**
 * Hangi eylem kime açık. Önizleme ve hikâye paylaşımı herkese. Baskı dosyası ve özel başlık Premium'dur; demo profili
 * Premium göründüğünden demo önce denetlenir ve kayıt isteğine gider (ürün kararı, 2026-11-09).
 */
export function gateFor(action: SkyAction, user: { isPremium: boolean; isDemoMode: boolean }): SkyGate {
  if (action === "preview" || action === "storyShare") return "allow";
  if (user.isDemoMode) return "signup";
  return user.isPremium ? "allow" : "paywall";
}

// ─── Başlık ───────────────────────────────────────────────────────────────────

export const MAX_TITLE_LENGTH = 40;

/** Özel başlık: kırpılır, boşsa null (varsayılan başlık kullanılır). Premium değilse hiç uygulanmaz. */
export function effectiveTitle(raw: string | null | undefined, premium: boolean): string | null {
  if (!premium) return null;
  const trimmed = (raw ?? "").trim().slice(0, MAX_TITLE_LENGTH);
  return trimmed || null;
}
