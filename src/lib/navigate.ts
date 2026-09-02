import { CoupleProfile } from "@/context/AuthContext";
import { router } from "expo-router";

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
