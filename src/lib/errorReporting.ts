import { Platform } from "react-native";
import Constants from "expo-constants";
import { supabase } from "@/lib/supabase";
import { logger } from "@/utils/logger";

// Bir oturumda en fazla bu kadar hata yollanır; döngüye giren bir hata sunucuyu doldurmasın
const MAX_REPORTS_PER_SESSION = 8;
const sent = new Set<string>();

/**
 * Üretimde oluşan hatayı `client_errors` tablosuna yazar (yalnızca giriş yapmış kullanıcı).
 * Asla hata fırlatmaz; kişisel içerik yollanmaz, yalnızca hata metni ve ekran adı.
 */
export async function reportError(error: unknown, context?: string): Promise<void> {
  try {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error(`[ErrorReporting] ${context ?? "unknown"}:`, err);
    if (__DEV__) return;

    const key = `${context ?? ""}|${err.message}`;
    if (sent.has(key) || sent.size >= MAX_REPORTS_PER_SESSION) return;
    sent.add(key);

    const { data } = await supabase.auth.getSession();
    if (!data.session) return;

    await supabase.from("client_errors").insert({
      message: err.message.slice(0, 500),
      stack: (err.stack ?? "").slice(0, 4000),
      context: context?.slice(0, 100) ?? null,
      app_version: Constants.expoConfig?.version ?? null,
      platform: Platform.OS,
    });
  } catch {
    // Hata raporlaması uygulamayı asla etkilememeli
  }
}

/**
 * Uygulama koduyla ilgisiz, zararsız hatalar: raporlanmaz ve kırmızı ekran / çökme göstermez.
 *
 * - "Unsupported top level event type \"topUserLocationChange\"": react-native-maps'in yerel tarafı konum
 *   olayı yollarken JS tarafında harita bileşeninin görünüm yapılandırması henüz yok (ör. geliştirmede
 *   yeniden yükleme sırasında eski harita görünümü hâlâ konum alıyor, ya da harita kapanırken son olay
 *   geliyor). Olay yalnızca yutulur; harita çalışmaya devam eder.
 */
const IGNORED_ERROR_PATTERNS: readonly RegExp[] = [/Unsupported top level event type "topUserLocationChange"/];

function isIgnoredError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return IGNORED_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

/** Yakalanmamış JS hatalarını raporlar; varsayılan işleyici (kırmızı ekran / çökme) korunur. */
export function installGlobalErrorReporting(): void {
  const errorUtils = (globalThis as any).ErrorUtils;
  if (!errorUtils?.getGlobalHandler || !errorUtils?.setGlobalHandler) return;
  const previous = errorUtils.getGlobalHandler();
  errorUtils.setGlobalHandler((error: unknown, isFatal?: boolean) => {
    if (isIgnoredError(error)) return;
    reportError(error, isFatal ? "fatal" : "uncaught");
    previous?.(error, isFatal);
  });
}
