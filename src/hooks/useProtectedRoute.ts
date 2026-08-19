import { useEffect } from "react";
import { useRouter, useSegments, useRootNavigationState } from "expo-router";
import { useAuth } from "@/context/AuthContext";

export function useProtectedRoute() {
  const { session, isLoading, profile } = useAuth();
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

    if (!session) {
      // 1. Unauthenticated users (Guests)
      // They can only access (auth) routes like login, register, reset-password, verify
      if (!inAuthGroup) {
        router.replace("/(auth)/login");
      }
    } else {
      // 2. Authenticated Users
      
      // Prevent authenticated users from going back to login/auth pages
      // unless they are explicitly logging out (handled by logout logic elsewhere).
      // If they land on auth screens, push them back to the app flow.
      const isTryingToAccessAuth = inAuthGroup;

      if (!profile?.isPaired) {
        // Role: Paired yet? NO
        // They must complete the pairing step.
        // We only allow them on the pairing screen.
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
        // They can access main app routes (/(tabs), /memories, etc.)
        // Prevent them from going to setup screens or auth screens unnecessarily.
        if (isTryingToAccessAuth || inSetupGroup) {
          // Send them to the main home tab
          router.replace("/(tabs)/home");
        }
      }
    }
  }, [session, isLoading, profile, segments, navigationState?.key]);
}
