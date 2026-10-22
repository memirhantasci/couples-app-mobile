import { GestureHandlerRootView } from "react-native-gesture-handler";
import "../global.css";
import React, { useEffect, useEffectEvent } from "react";
import { Stack, router } from "expo-router";
import * as Linking from "expo-linking";
import * as SplashScreen from "expo-splash-screen";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { ThemeProvider, useTheme } from "@/context/ThemeContext";
import { TabBarProvider } from "@/context/TabBarContext";
import { NotificationProvider } from "@/context/NotificationContext";
import { supabase } from "@/lib/supabase";
import { safeStorage as AsyncStorage } from "@/lib/safeStorage";
import { configureAndroidNotificationChannel, notifyPairingComplete } from "@/lib/notifications";
import { normalizePairingCode, translatePairingError } from "@/lib/pairingCode";
import { navigateAfterAuth } from "@/lib/navigate";
import { toast } from "@/lib/toast";
import { useProtectedRoute } from "@/hooks/useProtectedRoute";
import { ToastHost } from "@/components/ui/ToastHost";
import { DialogHost } from "@/components/ui/DialogHost";
import { LetterArrivalHost } from "@/components/letters/LetterArrivalHost";
import { StarPointsToastHost } from "@/modules/stars/components/StarPointsToastHost";

import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';

SplashScreen.preventAutoHideAsync();

// Configure Android notification channel on startup
configureAndroidNotificationChannel();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Realtime subscriptions handle live updates — no need for aggressive refetching
      staleTime: 1000 * 60 * 10, // 10 minutes
      retry: 1,
      // Don't refetch on window focus (causes unnecessary flicker on tab switch)
      refetchOnWindowFocus: false,
    },
  },
});

// ─── Inner layout: has access to AuthContext ──────────────────────────────────

function RootLayoutNav() {
  const { session, isLoading, isDemoMode, exitDemoMode, refreshProfile } = useAuth();
  const { theme } = useTheme();

  // Enforce role-based routing
  useProtectedRoute();

  // Fonts load asynchronously in the background; system font fills in the gap (~200ms)
  useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  // Hide splash as soon as auth state is resolved — don't wait for fonts
  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [isLoading]);

  // Safety fallback: ensure splash screen never stays stuck under any network condition
  // Reduced from 1200ms → 500ms since auth now resolves much faster
  useEffect(() => {
    const timer = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  // Always sees the latest session / demo state without re-subscribing the URL listener.
  const handleDeepLink = useEffectEvent(async (url: string) => {
    const parsed = Linking.parse(url);
    const { hostname, queryParams } = parsed;

    // couplesapp://verify?token_hash=...&type=...
    if (hostname === "verify" && queryParams?.token_hash) {
      router.push({
        pathname: "/(auth)/verify",
        params: {
          token_hash: queryParams.token_hash as string,
          type: (queryParams.type as string) ?? "email",
        },
      });
      return;
    }

    // couplesapp://invite?code=... OR couplesapp://pair?code=...
    if ((hostname === "invite" || hostname === "pair") && queryParams?.code) {
      const code = normalizePairingCode(queryParams.code as string);
      await AsyncStorage.setItem("@pending_invite_code", code);

      // If user is already authenticated with an active session:
      if (session?.user?.id) {
        try {
          const { data, error } = await supabase.rpc("join_couple_by_code_uuid", { p_code: code });
          if (!error) {
            // Davet bağlantısıyla eşleşme tamamlandı: bekleme ekranındaki partnere haber ver
            const joined = Array.isArray(data) ? data[0] : data;
            if (joined?.result_is_paired) notifyPairingComplete(joined.result_couple_id, session.user.id);
            await AsyncStorage.removeItem("@pending_invite_code");
            navigateAfterAuth(await refreshProfile());
            return;
          }
          if (error.message.includes("ALREADY_PAIRED")) {
            // Kurulmuş çift başka bir davetle bozulmaz; kullanıcı olduğu yerde kalır
            await AsyncStorage.removeItem("@pending_invite_code");
            toast.info(translatePairingError(error.message));
            return;
          }
        } catch {
          // fallback
        }
        router.push({
          pathname: "/(setup)/pairing",
          params: { code },
        });
        return;
      }

      // If user is in demo mode, exit demo mode
      if (isDemoMode) {
        exitDemoMode();
      }

      // Navigate directly to registration screen with the invite code
      router.push({
        pathname: "/(auth)/login",
        params: { initialMode: "register", inviteCode: code },
      });
      return;
    }

    // couplesapp://reset-password?token_hash=...
    if (hostname === "reset-password" && queryParams?.token_hash) {
      router.push({
        pathname: "/(auth)/reset-password",
        params: { token_hash: queryParams.token_hash as string },
      });
    }
  });

  // ── Deep link listener (Foreground and cold-start deep links) ─────────────
  // Re-runs on sign-in / demo changes so a cold-start invite link is handled for the new session.
  useEffect(() => {
    // 1. Cold-start URL
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink(url);
    });

    // 2. Foreground / background URL listener
    const subscription = Linking.addEventListener("url", ({ url }) => {
      handleDeepLink(url);
    });

    return () => subscription.remove();
  }, [session?.user?.id, isDemoMode]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.bgGradient[0] },
      }}
    >
      {/* Auth group — shown when not logged in */}
      <Stack.Screen name="(auth)" />
      {/* Setup group — shown after login but before pairing/dates */}
      <Stack.Screen name="(setup)" />
      {/* Main app */}
      <Stack.Screen name="(tabs)" />
      {/* Sub screens (commented out until created) */}
      {/* <Stack.Screen name="memories" /> */}
      {/* <Stack.Screen name="daily-notes" /> */}
      {/* <Stack.Screen name="photos" /> */}
      {/* <Stack.Screen name="period-tracker" /> */}
      <Stack.Screen name="explore" />
      {/* Modals */}
      {/* <Stack.Screen name="add-memory" options={{ presentation: "modal" }} /> */}
      {/* <Stack.Screen name="write-letter" options={{ presentation: "modal" }} /> */}
      <Stack.Screen name="menu" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ThemeProvider>
            <TabBarProvider>
              <NotificationProvider>
                <RootLayoutNav />
                {/* Partnerinden mektup gelmişse uygulamaya girince sol üstten uçup konan kuş */}
                <LetterArrivalHost />
                {/* Yıldızı parlatan aktivitelerde "+N puan 🌟" bildirimi */}
                <StarPointsToastHost />
                {/* Alert yerine süzülen hap bildirimleri; ağacın en üstünde çizilir */}
                <ToastHost />
                {/* Alert.alert yerine cam efektli, pastel tonlu diyalog kartları (onay / uzun uyarılar) */}
                <DialogHost />
              </NotificationProvider>
            </TabBarProvider>
          </ThemeProvider>
        </AuthProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
