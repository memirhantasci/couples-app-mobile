import { useEffect } from "react";
import { useRouter, useSegments, useRootNavigationState } from "expo-router";
import { useAuth } from "@/context/AuthContext";

export function useProtectedRoute() {
  const { session, isLoading, profile, isDeviceAuthorized, isDemoMode, enterDemoMode } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const navigationState = useRootNavigationState();

  useEffect(() => {
    // Wait until Expo Router is ready to navigate and Auth state is resolved.
    if (!navigationState?.key || isLoading) return;

    // Which group is the user trying to access?
    const inAuthGroup = segments[0] === "(auth)";
    const inSetupGroup = segments[0] === "(setup)";
    const currentRoute = segments.join("/");
    const isAtRoot = !currentRoute || currentRoute === "index";

    // Verification screens (email confirmation or device OTP verification)
    const isVerifying = currentRoute.includes("verify-device") || currentRoute.includes("verify");

    const timer = setTimeout(() => {
      // 0. Demo Mode: Guests exploring the app
      if (isDemoMode) {
        if (inSetupGroup || isVerifying || isAtRoot) {
          router.replace("/(tabs)/home");
        }
        return;
      }

      if (!session) {
        // 1. Unauthenticated users (Guests)
        // If not explicitly on (auth) screen (login/register), enter demo mode so guests can freely explore
        if (!inAuthGroup) {
          enterDemoMode();
          router.replace("/(tabs)/home");
        }
      } else {
        // 2. Authenticated Users

        // If device authorization check is still resolving, don't redirect anywhere yet
        if (isDeviceAuthorized === null) {
          return;
        }

        // If the device is not authorized for this user, force them to verify-device screen
        if (isDeviceAuthorized === false) {
          if (!currentRoute.includes("verify-device") && !currentRoute.includes("login")) {
            router.replace({
              pathname: "/(auth)/verify-device",
              params: {
                userId: session.user.id,
                email: session.user.email || "",
              },
            });
          }
          return;
        }

        // If user is currently on verification screen, let them stay and finish it
        if (isVerifying) {
          return;
        }

        // Prevent authorized users from going back to login/auth pages
        const isTryingToAccessAuth = inAuthGroup;

        if (!profile?.isPaired) {
          // Role: Paired yet? NO
          // They must complete the pairing step.
          if (!currentRoute.includes("pairing")) {
            router.replace("/(setup)/pairing");
          }
        } else if (!profile?.hasDates) {
          // Role: Paired, but dates configured? NO
          // They must complete the dates step.
          if (!currentRoute.includes("dates")) {
            router.replace("/(setup)/dates");
          }
        } else {
          // Role: Fully setup user.
          // Prevent them from going to setup screens or auth screens unnecessarily.
          if (isTryingToAccessAuth || inSetupGroup || isAtRoot) {
            // Send them to the main home tab
            router.replace("/(tabs)/home");
          }
        }
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [session, isLoading, profile, isDeviceAuthorized, isDemoMode, enterDemoMode, segments, navigationState?.key]);
}
