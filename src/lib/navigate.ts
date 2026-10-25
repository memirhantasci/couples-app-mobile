import { CoupleProfile } from "@/context/AuthContext";
import { router } from "expo-router";

let authFlowActive = false;
let authFlowReleaseTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Giriş / cihaz doğrulama ekranı kendi yönlendirmesini yaparken true tutulur;
 * useProtectedRoute bu sürede yönlendirmez. Aksi halde iki "router.replace" aynı anda
 * ekran yığınını değiştirip Android'de "addViewAt: child already has a parent" çökmesine yol açıyordu.
 */
export function setAuthFlowActive(active: boolean) {
  if (authFlowReleaseTimer) clearTimeout(authFlowReleaseTimer);
  authFlowReleaseTimer = null;
  authFlowActive = active;
}

/** router.replace ekran geçişi bitene kadar kilidi tutar; hemen bırakılırsa geç kalan bir yönlendirme çakışır. */
export function releaseAuthFlow() {
  if (authFlowReleaseTimer) clearTimeout(authFlowReleaseTimer);
  authFlowReleaseTimer = setTimeout(() => {
    authFlowActive = false;
    authFlowReleaseTimer = null;
  }, 1500);
}

export function isAuthFlowActive() {
  return authFlowActive;
}

/**
 * Shared routing logic used after login AND after OTP verification.
 * Determines where to send the user based on their pairing + dates status.
 */
export function navigateAfterAuth(profile: Partial<CoupleProfile> | null) {
  if (!profile || !profile.isPaired) {
    router.replace("/(setup)/pairing");
    return;
  }
  if (!profile.hasDates) {
    router.replace("/(setup)/dates");
    return;
  }
  router.replace("/(tabs)/home");
}
