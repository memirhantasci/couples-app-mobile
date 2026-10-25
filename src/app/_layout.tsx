import { GestureHandlerRootView } from "react-native-gesture-handler";
import "../global.css";
import React, { useEffect, useEffectEvent } from "react";
import { Stack, router } from "expo-router";
import * as Linking from "expo-linking";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { ThemeProvider, useTheme } from "@/context/ThemeContext";
import { TabBarProvider } from "@/context/TabBarContext";
import { NotificationProvider } from "@/context/NotificationContext";
import { supabase } from "@/lib/supabase";
import { safeStorage as AsyncStorage } from "@/lib/safeStorage";
import { configureAndroidNotificationChannel } from "@/lib/notifications";
import { normalizePairingCode, translatePairingError } from "@/lib/pairingCode";
import { navigateAfterAuth } from "@/lib/navigate";
import { toast } from "@/lib/toast";
import { useProtectedRoute } from "@/hooks/useProtectedRoute";
import { ToastHost } from "@/components/ui/ToastHost";
import { OfflineBanner } from "@/components/ui/OfflineBanner";
import { AppErrorScreen } from "@/components/ui/AppErrorScreen";
import { installGlobalErrorReporting } from "@/lib/errorReporting";
import { bindQueryOnlineManager } from "@/hooks/useIsOffline";
import { DialogHost } from "@/components/ui/DialogHost";
import { LetterArrivalHost } from "@/components/letters/LetterArrivalHost";
import { NotificationPermissionHost } from "@/components/common/NotificationPermissionHost";
import { PremiumCelebrationHost } from "@/components/ui/PremiumCelebrationHost";
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

// Yakalanmamış JS hataları sunucuya raporlanır (üretimde çökme nedenlerini görebilmek için)
installGlobalErrorReporting();

// Configure Android notification channel on startup
configureAndroidNotificationChannel();

bindQueryOnlineManager();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Realtime subscriptions handle live updates — no need for aggressive refetching
      staleTime: 1000 * 60 * 2, // 2 dk — bildirim gelince ve uygulama öne gelince ayrıca yenilenir (NotificationContext)
      retry: 1,
      // Don't refetch on window focus (causes unnecessary flicker on tab switch)
      refetchOnWindowFocus: false,
    },
  },
});

// ─── Inner layout: has access to AuthContext ──────────────────────────────────

function RootLayoutNav() {
  const { session, isLoading, isDemoMode, exitDemoMode, refreshProfile } = useAuth();
  const { theme, isLight } = useTheme();

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

  // Safety fallback: yalnızca oturum çözümü takılırsa (ör. çok yavaş ağ) splash'ı zorla kapat.
  // Kısa tutulursa oturum henüz çözülmeden yanlış (demo/giriş) ekran bir an görünür.
  useEffect(() => {
    const timer = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, 4000);
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
          const { error } = await supabase.rpc("join_couple_by_code_uuid", { p_code: code });
          if (!error) {
            // Bekleme ekranındaki partnere "eşleşme başarılı" bildirimini sunucu (couples tetikleyicisi) gönderir
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
    <>
    {/* Uygulama sistemde hep koyu görünür (userInterfaceStyle: dark); açık temada simgeler zeminle kaybolmasın */}
    <StatusBar style={isLight ? "dark" : "light"} />
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
      {/* Modals */}
      {/* <Stack.Screen name="add-memory" options={{ presentation: "modal" }} /> */}
      {/* <Stack.Screen name="write-letter" options={{ presentation: "modal" }} /> */}
      <Stack.Screen name="menu" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
    </Stack>
    </>
  );
}

// Expo Router: herhangi bir ekranda oluşan render hatası beyaz ekran yerine bu ekranı gösterir
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  return <AppErrorScreen error={error} retry={retry} />;
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
                {/* Bildirim izni verilmediyse arada bir (bezdirmeden) nazik ön-onay kartı */}
                <NotificationPermissionHost />
                {/* Partner Premium aldığında (uygulama açıkken anında) "Tebrikler" ekranı */}
                <PremiumCelebrationHost />
                {/* Yıldızı parlatan aktivitelerde "+N puan 🌟" bildirimi */}
                <StarPointsToastHost />
                {/* Alert yerine süzülen hap bildirimleri; ağacın en üstünde çizilir */}
                <ToastHost />
                {/* İnternet kopunca üstte süzülen uyarı */}
                <OfflineBanner />
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
