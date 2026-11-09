export interface PrintSize {
  width: number;
  height: number;
}

/** 3:4, büyükten küçüğe. İlki ~7,7 MP; bellek yetmezse bir alt boyut denenir. */
export const PRINT_SIZES: readonly PrintSize[] = [
  { width: 2400, height: 3200 },
  { width: 1800, height: 2400 },
  { width: 1200, height: 1600 },
];

/**
 * iOS'ta başlangıç boyutunu sınırlamak için hazır ayar. 2400×3200 yakalamanın iOS'ta boş ya da eksik çıkıp çıkmadığı
 * cihazda doğrulanamadı; sorun görülürse 1800 yapılır. Doğrulama olana kadar varsayılan sınırsızdır.
 */
export const IOS_MAX_PRINT_WIDTH: number | null = null;

/** Platforma göre denenecek boyutlar. */
export function printSizesFor(platform: string, iosMaxWidth: number | null = IOS_MAX_PRINT_WIDTH, sizes: readonly PrintSize[] = PRINT_SIZES): readonly PrintSize[] {
  if (platform !== "ios" || iosMaxWidth === null) return sizes;
  const allowed = sizes.filter((size) => size.width <= iosMaxWidth);
  return allowed.length > 0 ? allowed : sizes.slice(-1);
}

/**
 * Piksel başına en az bayt. Tek renkli ya da yalnızca gradyanlı (içeriği çizilmemiş) 2400×3200 PNG yaklaşık 36 KB
 * (0,005 B/piksel), diskli ve 1500 yıldızlı benzer bir görüntü yaklaşık 435-530 KB (0,06-0,07) sıkışıyor; ölçüm
 * zlib ile benzetimdir, cihaz çıktısı değil. Eşik ikisinin arasındadır: boşun 3 katı, gerçeğin ~4'te 1'i
 * (2400×3200 için ~115 KB). Piksele bağlıdır: küçük boyutların dosyası da küçüktür.
 */
export const MIN_PRINT_BYTES_PER_PIXEL = 0.015;

/** Dosya boyutu sıfır (yok ya da okunamıyor) veya boş görsel kadar küçükse false. */
export function isPlausibleCapture(bytes: number, size: PrintSize): boolean {
  return Number.isFinite(bytes) && bytes >= size.width * size.height * MIN_PRINT_BYTES_PER_PIXEL;
}

export interface CaptureSuccess {
  uri: string;
  size: PrintSize;
}

/**
 * Sırayla dener, ilk başarıda durur. Hiçbiri olmazsa null: arayüz hata gösterir, istisna yukarı çıkmaz.
 * `validate` false dönerse (boş görünen dosya) deneme başarısız sayılır, bir alt boyuta geçilir.
 */
export async function captureWithFallback(
  sizes: readonly PrintSize[],
  capture: (size: PrintSize) => Promise<string | null | undefined>,
  onFailure?: (size: PrintSize, error: unknown) => void,
  validate?: (uri: string, size: PrintSize) => boolean
): Promise<CaptureSuccess | null> {
  for (const size of sizes) {
    let failure: unknown = null;
    try {
      const uri = await capture(size);
      if (uri && (!validate || validate(uri, size))) return { uri, size };
    } catch (error) {
      failure = error;
    }
    onFailure?.(size, failure);
  }
  return null;
}

// ─── Düzen beklemesi ──────────────────────────────────────────────────────────

export class PrintLayoutTimeoutError extends Error {
  constructor() {
    super("Print layout did not complete in time");
    this.name = "PrintLayoutTimeoutError";
  }
}

/**
 * `arm` düzen tamamlanınca çağrılacak işlevi alır. Süre dolarsa false: çağıran o denemeyi başarısız saymalıdır,
 * yarım kalmış düzen sessizce yakalanmamalıdır.
 */
export function waitForLayout(arm: (onLaidOut: () => void) => void, timeoutMs: number): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => resolve(false), timeoutMs);
    arm(() => {
      clearTimeout(timer);
      resolve(true);
    });
  });
}

// ─── Çökme izi ────────────────────────────────────────────────────────────────

/** Başarısız boyut bu süre ya da uygulama sürümü değişince yeniden denenir: cihaz kalıcı olarak küçük boyutta kalmasın. */
export const PRINT_RETRY_AFTER_MS = 14 * 24 * 60 * 60 * 1000;

export interface PrintTrailEntry {
  at: number;
  version: string;
}

export interface PrintTrail {
  /** Genişlik → en son başarısızlık */
  failed: Record<string, PrintTrailEntry>;
  /** Yakalamadan önce yazılır, sonuç gelince silinir */
  attempt: (PrintTrailEntry & { width: number }) | null;
}

export interface PrintTrailContext {
  now: number;
  version: string;
}

export const EMPTY_PRINT_TRAIL: PrintTrail = { failed: {}, attempt: null };

function parseEntry(value: unknown): PrintTrailEntry | null {
  if (typeof value !== "object" || value === null) return null;
  const { at, version } = value as Record<string, unknown>;
  return typeof at === "number" && Number.isFinite(at) && typeof version === "string" ? { at, version } : null;
}

/** Bozuk ya da yabancı biçimli iz yok sayılır. */
export function parsePrintTrail(raw: string | null): PrintTrail {
  if (!raw) return EMPTY_PRINT_TRAIL;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return EMPTY_PRINT_TRAIL;
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) return EMPTY_PRINT_TRAIL;
  const record = data as Record<string, unknown>;

  const failed: Record<string, PrintTrailEntry> = {};
  if (typeof record.failed === "object" && record.failed !== null) {
    for (const [width, value] of Object.entries(record.failed)) {
      const entry = parseEntry(value);
      if (entry && /^\d{3,5}$/.test(width)) failed[width] = entry;
    }
  }
  const attemptEntry = parseEntry(record.attempt);
  const attemptWidth = (record.attempt as { width?: unknown } | null | undefined)?.width;
  const attempt = attemptEntry && typeof attemptWidth === "number" && Number.isInteger(attemptWidth) ? { ...attemptEntry, width: attemptWidth } : null;
  return { failed, attempt };
}

export function serializePrintTrail(trail: PrintTrail): string {
  return JSON.stringify(trail);
}

/** Yakalamadan hemen önce: süreç bu sırada ölürse iz diskte kalır. */
export function beginAttempt(trail: PrintTrail, width: number, context: PrintTrailContext): PrintTrail {
  return { ...trail, attempt: { width, at: context.now, version: context.version } };
}

/**
 * Yerel bellek taşması JS'te yakalanamaz, süreci öldürür. Oturum başında hâlâ duran deneme izi, önceki denemenin
 * uygulamayla birlikte düştüğünü gösterir: o boyut başarısız sayılır.
 */
export function settleCrash(trail: PrintTrail): PrintTrail {
  if (!trail.attempt) return trail;
  const { width, at, version } = trail.attempt;
  return { failed: { ...trail.failed, [width]: { at, version } }, attempt: null };
}

export function markFailed(trail: PrintTrail, width: number, context: PrintTrailContext): PrintTrail {
  return { failed: { ...trail.failed, [width]: { at: context.now, version: context.version } }, attempt: null };
}

/** Başarı yalnızca KENDİ boyutunun izini siler: küçük boyutun başarısı büyüğün belleğe sığdığını göstermez. */
export function markSuccess(trail: PrintTrail, width: number): PrintTrail {
  const failed = { ...trail.failed };
  delete failed[String(width)];
  return { failed, attempt: null };
}

function isActiveFailure(entry: PrintTrailEntry, context: PrintTrailContext): boolean {
  const age = context.now - entry.at;
  return entry.version === context.version && age >= 0 && age < PRINT_RETRY_AFTER_MS;
}

// ─── Dışa aktarma oturumu ─────────────────────────────────────────────────────

export interface PrintExportDeps {
  /** Diskteki iz metni (yoksa null) */
  readTrail: () => Promise<string | null>;
  /** Okuma/yazma hataları burada yutulur */
  writeTrail: (raw: string) => Promise<void>;
  context: PrintTrailContext;
  sizes: readonly PrintSize[];
  /**
   * Bu oturumda (ör. açık baskı ekranı) süreç ölümü OLMAYAN nedenle başarısız sayılan genişlikler: yalnızca bellekte
   * tutulur, çağıran saklar. "Tekrar dene" bu boyutları atlar; yeni oturum boş kümeyle, tam sırayla başlar.
   */
  sessionFailed: Set<number>;
  capture: (size: PrintSize) => Promise<string | null | undefined>;
  validate?: (uri: string, size: PrintSize) => boolean;
  onFailure?: (size: PrintSize, error: unknown) => void;
}

export interface PrintExportOutcome {
  result: CaptureSuccess | null;
  /** Başarısızlıklardan biri düzen zaman aşımıysa */
  timedOut: boolean;
}

/**
 * Kalıcı iz YALNIZCA gerçek süreç ölümünü kaydeder: yakalamadan önce diske "deneme" yazılır, süreç yakalamada ölürse
 * sonraki oturumda `settleCrash` onu başarısızlığa çevirir. JS'te yakalanan hatalar (düzen zaman aşımı, boş çıktı,
 * yakalama istisnası) geçici olabilir; tek seferlik bir aksaklık Premium kullanıcıyı günlerce düşük çözünürlüğe
 * düşürmesin diye diske yazılmaz, yalnızca bu oturumun geri düşmesini tetikler (`sessionFailed`).
 */
export async function runPrintExport(deps: PrintExportDeps): Promise<PrintExportOutcome> {
  const { context, sessionFailed } = deps;
  let stored: string | null = null;
  try {
    stored = await deps.readTrail();
  } catch {
    // okunamayan iz yok sayılır
  }
  let trail = settleCrash(parsePrintTrail(stored));
  const save = async () => {
    try {
      await deps.writeTrail(serializePrintTrail(trail));
    } catch {
      // iz yazılamazsa yalnızca bir sonraki oturumdaki öngörü kaybolur; dışa aktarma sürer
    }
  };

  // Başlangıç boyutu: kalıcı çökme izi + bu oturumun geçici başarısızlıkları
  const effective = [...sessionFailed].reduce((acc, width) => markFailed(acc, width, context), trail);
  const outcome: PrintExportOutcome = { result: null, timedOut: false };

  outcome.result = await captureWithFallback(
    startingSizes(effective, context, deps.sizes),
    async (size) => {
      // İz yakalamadan önce diske yazılır: süreç yakalama sırasında ölürse sonraki oturum bu boyutu bilir
      trail = beginAttempt(trail, size.width, context);
      await save();
      return deps.capture(size);
    },
    (size, error) => {
      // JS'e geri dönüldü: süreç yaşıyor, deneme izi çökme sayılmasın. Yalnızca bu oturum için başarısız.
      trail = { ...trail, attempt: null };
      sessionFailed.add(size.width);
      if (error instanceof PrintLayoutTimeoutError) outcome.timedOut = true;
      deps.onFailure?.(size, error);
    },
    deps.validate
  );
  if (outcome.result) {
    trail = markSuccess(trail, outcome.result.size.width);
    sessionFailed.delete(outcome.result.size.width);
  }
  await save();
  return outcome;
}

/**
 * Denenecek boyutlar, en büyük başarılı/denenmemiş olandan başlayarak. Geçerliliğini koruyan en küçük başarısız
 * boyuttan büyük olanlar da atlanır (o sığmadıysa büyüğü de sığmaz). Hepsi başarısızsa en küçüğü: başka seçenek yok.
 */
export function startingSizes(trail: PrintTrail, context: PrintTrailContext, sizes: readonly PrintSize[] = PRINT_SIZES): readonly PrintSize[] {
  const activeWidths = Object.entries(trail.failed)
    .filter(([, entry]) => isActiveFailure(entry, context))
    .map(([width]) => Number(width));
  if (activeWidths.length === 0) return sizes;
  const limit = Math.min(...activeWidths);
  const safer = sizes.filter((size) => size.width < limit);
  return safer.length > 0 ? safer : sizes.slice(-1);
}
