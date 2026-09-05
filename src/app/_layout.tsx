import "../global.css";
import React, { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { Stack, router } from "expo-router";
import * as Linking from "expo-linking";
import * as SplashScreen from "expo-splash-screen";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { configureAndroidNotificationChannel } from "@/lib/notifications";
import { useProtectedRoute } from "@/hooks/useProtectedRoute";

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
  const { session, isLoading, profile } = useAuth();

  // Enforce role-based routing
  useProtectedRoute();

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  // Hide splash as soon as auth state is resolved — don't wait for fonts
  // Fonts load asynchronously in the background; system font fills in the gap (~200ms)
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

  // ── Deep link listener (Foreground deep links) ──────────────────────────
  // Cold-start URLs are automatically handled by Expo Router's navigation container
  useEffect(() => {
    const subscription = Linking.addEventListener("url", ({ url }) => {
      handleDeepLink(url);
    });

    return () => subscription.remove();
  }, []);

  function handleDeepLink(url: string) {
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

    // couplesapp://pair?code=...
    if (hostname === "pair" && queryParams?.code) {
      router.push({
        pathname: "/(setup)/pairing",
        params: { code: queryParams.code as string },
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
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
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
      <Stack.Screen name="menu" options={{ presentation: 'modal' }} />
    </Stack>
  );
}

import { ThemeProvider } from "@/context/ThemeContext";
import { TabBarProvider } from "@/context/TabBarContext";

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider>
          <TabBarProvider>
            <RootLayoutNav />
          </TabBarProvider>
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

