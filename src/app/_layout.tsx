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
  PlayfairDisplay_400Regular,
  PlayfairDisplay_400Regular_Italic,
  PlayfairDisplay_700Bold,
  PlayfairDisplay_700Bold_Italic
} from '@expo-google-fonts/playfair-display';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold
} from '@expo-google-fonts/inter';

SplashScreen.preventAutoHideAsync();

// Configure Android notification channel on startup
configureAndroidNotificationChannel();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

// ─── Inner layout: has access to AuthContext ──────────────────────────────────

function RootLayoutNav() {
  const { session, isLoading, profile } = useAuth();

  // Enforce role-based routing
  useProtectedRoute();

  const [fontsLoaded] = useFonts({
    PlayfairDisplay_400Regular,
    PlayfairDisplay_400Regular_Italic,
    PlayfairDisplay_700Bold,
    PlayfairDisplay_700Bold_Italic,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  // Hide splash once auth state is resolved and fonts are loaded
  useEffect(() => {
    if (!isLoading && fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [isLoading, fontsLoaded]);

  // ── Deep link listener ────────────────────────────────────────────────────
  // Handles both cold-start URLs (app was closed) and foreground URLs (app open)
  useEffect(() => {
    // Handle cold-start deep link
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink(url);
    });

    // Handle foreground deep link
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

  // ── Loading splash ────────────────────────────────────────────────────────
  if (isLoading || !fontsLoaded) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator color="#E8002D" size="large" />
      </View>
    );
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

// ─── Root layout: wraps providers ────────────────────────────────────────────

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RootLayoutNav />
      </AuthProvider>
    </QueryClientProvider>
  );
}
