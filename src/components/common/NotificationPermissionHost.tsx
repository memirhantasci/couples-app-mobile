import React, { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { usePathname } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { useNotificationPriming } from "@/hooks/useNotificationPriming";
import { PermissionPrimingModal } from "@/components/common/PermissionPrimingModal";
import { safeStorage as AsyncStorage } from "@/lib/safeStorage";

// Uygulama açıldıktan kısa bir süre sonra (ilk izlenim bozulmasın, kullanıcı ortalığı görsün)
const FIRST_PROMPT_DELAY_MS = 25_000;
// Ömür boyu en çok bu kadar kez kendiliğinden sorulur; ayrıca useNotificationPriming'in 7 günlük
// "Şimdilik Değil" bekleme süresi geçerlidir. Mektup / anı / ilaç sonrası sorulan kartlar da aynı beklemeyi paylaşır.
const MAX_AUTO_PROMPTS = 4;
const AUTO_PROMPT_COUNT_KEY = "@notification_priming_auto_count";

/**
 * Kökte bir kez bağlanır. Bildirim izni henüz verilmemişse, uygulamayı kullanırken (açılıştan ~25 sn sonra,
 * oturum başına en çok bir kez) ön-onay kartını gösterir. OS izin penceresi yalnızca kullanıcı
 * "Bildirimleri Aç" derse açılır; "Şimdilik Değil" 7 gün sessizlik başlatır.
 * Misafir (demo) modunda, giriş / kurulum ekranlarında ve form ekranlarında çıkmaz.
 */
export function NotificationPermissionHost() {
  const { session, profile, isDemoMode } = useAuth();
  const userId = session?.user?.id;
  const priming = useNotificationPriming(userId);
  const pathname = usePathname();

  // Zamanlayıcıdan okunan en güncel yol
  const pathnameRef = useRef(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  const enabled = !!userId && !isDemoMode && !!profile?.isPaired && !!profile?.hasDates;
  const { maybePrompt } = priming;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const timer = setTimeout(async () => {
      if (cancelled || AppState.currentState !== "active") return;
      const path = pathnameRef.current ?? "";
      // Giriş / kurulum / form ekranlarında bölme
      if (path.includes("login") || path.includes("verify") || path.includes("pairing") || path.includes("dates") || path.includes("/add-")) {
        return;
      }

      try {
        const count = Number((await AsyncStorage.getItem(AUTO_PROMPT_COUNT_KEY)) ?? 0) || 0;
        if (count >= MAX_AUTO_PROMPTS) return;
        if (await maybePrompt()) {
          await AsyncStorage.setItem(AUTO_PROMPT_COUNT_KEY, String(count + 1));
        }
      } catch {
        // sayaç okunamazsa sormayız: bezdirmektense sessiz kalmak daha güvenli
      }
    }, FIRST_PROMPT_DELAY_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [enabled, maybePrompt]);

  if (!enabled) return null;

  return (
    <PermissionPrimingModal
      visible={priming.isVisible}
      onAccept={async () => {
        await priming.accept();
      }}
      onDismiss={priming.dismiss}
    />
  );
}
