import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { safeStorage } from "@/lib/safeStorage";
import { logger } from "@/utils/logger";

/**
 * Rıza kayıtları Supabase Auth kullanıcı metadata'sında tutulur (auth.users.raw_user_meta_data):
 * ayrı bir migration gerekmez, kayıt kullanıcıya ve zamana bağlıdır.
 * Metinler anlamlı biçimde değişirse sürüm yükseltilir; kullanıcıdan yeniden onay istenir.
 */
export const TERMS_CONSENT_VERSION = "2026-11";
export const HEALTH_CONSENT_VERSION = "2026-11";

const healthCacheKey = (userId: string) => `@health_consent_v${HEALTH_CONSENT_VERSION}_${userId}`;

/** Kayıt sırasında / ilk sosyal girişte kullanıcı metadata'sına yazılacak koşul onayı kaydı. */
export function termsConsentMetadata(): Record<string, string> {
  return {
    terms_accepted_at: new Date().toISOString(),
    terms_accepted_version: TERMS_CONSENT_VERSION,
  };
}

/** İlk sosyal girişte (profil tamamlama) koşul onayını kaydeder. Hata fırlatmaz; başarıyı döndürür. */
export async function recordTermsConsent(): Promise<boolean> {
  try {
    const { error } = await supabase.auth.updateUser({ data: termsConsentMetadata() });
    if (error) throw error;
    return true;
  } catch (err) {
    logger.warn("[Consent] Koşul onayı kaydedilemedi:", err);
    return false;
  }
}

function hasHealthConsent(metadata: Record<string, unknown> | undefined): boolean {
  return (
    !!metadata?.health_consent_at && metadata?.health_consent_version === HEALTH_CONSENT_VERSION
  );
}

export type HealthConsentStatus = "loading" | "granted" | "needed";

/**
 * Sağlık (regl / ilaç) verisi için açık rıza durumu (KVKK m.6). Demo oturumunda gerçek veri
 * işlenmediğinden rıza istenmez. Rıza metadata'da yoksa yerel önbelleğe de bakılır (kayıt sunucuya
 * yazılamamışsa kullanıcı her açılışta yeniden sorulmasın).
 */
export function useHealthConsent(): {
  status: HealthConsentStatus;
  grant: () => Promise<boolean>;
} {
  const { session, isDemoMode } = useAuth();
  const userId = session?.user?.id;
  const metadata = session?.user?.user_metadata as Record<string, unknown> | undefined;
  const serverGranted = hasHealthConsent(metadata);

  // Yerel önbellek, hangi kullanıcı için okunduğuyla birlikte tutulur (hesap değişince eski değer geçerli olmaz)
  const [cache, setCache] = useState<{ userId: string; granted: boolean } | null>(null);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    safeStorage.getItem(healthCacheKey(userId)).then((value) => {
      if (alive) setCache({ userId, granted: value === "1" });
    });
    return () => {
      alive = false;
    };
  }, [userId]);

  const cacheChecked = !userId || cache?.userId === userId;
  const cached = !!cache && cache.userId === userId && cache.granted;

  const grant = useCallback(async (): Promise<boolean> => {
    if (!userId) return false;
    // Önce yerel kayıt: sunucuya yazılamasa da kullanıcı yeniden sorulmaz
    await safeStorage.setItem(healthCacheKey(userId), "1");
    setCache({ userId, granted: true });
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          health_consent_at: new Date().toISOString(),
          health_consent_version: HEALTH_CONSENT_VERSION,
        },
      });
      if (error) throw error;
    } catch (err) {
      logger.warn("[Consent] Sağlık rızası sunucuya yazılamadı:", err);
    }
    return true;
  }, [userId]);

  if (isDemoMode) return { status: "granted", grant };
  if (serverGranted || cached) return { status: "granted", grant };
  if (!cacheChecked) return { status: "loading", grant };
  return { status: "needed", grant };
}
