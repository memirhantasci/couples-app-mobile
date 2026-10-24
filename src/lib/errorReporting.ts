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

/** Yakalanmamış JS hatalarını raporlar; varsayılan işleyici (kırmızı ekran / çökme) korunur. */
export function installGlobalErrorReporting(): void {
  const errorUtils = (globalThis as any).ErrorUtils;
  if (!errorUtils?.getGlobalHandler || !errorUtils?.setGlobalHandler) return;
  const previous = errorUtils.getGlobalHandler();
  errorUtils.setGlobalHandler((error: unknown, isFatal?: boolean) => {
    reportError(error, isFatal ? "fatal" : "uncaught");
    previous?.(error, isFatal);
  });
}
