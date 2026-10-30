import { GestureHandlerRootView } from "react-native-gesture-handler";
import "../global.css";
// Çok büyük sistem yazı boyutunda ekranlar bozulmasın: tüm metinlere büyüme sınırı koyar
import "@/lib/fontScaleCap";
// Çok dilli altyapı: cihaz dili / kayıtlı tercih algılanır, dayjs locale'i ayarlanır
import "@/lib/i18n";
import { useEffect, useEffectEvent, useRef } from "react";
import { AppState, LogBox } from "react-native";
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
import { navigateAfterAuth, releaseAuthFlow, setAuthFlowActive } from "@/lib/navigate";
import { parseAppLink } from "@/lib/deepLinks";
import { toast } from "@/lib/toast";
import { useProtectedRoute } from "@/hooks/useProtectedRoute";
import { useLanguageReady } from "@/hooks/useLanguageReady";
import { useTranslation } from "react-i18next";
import { ToastHost } from "@/components/ui/ToastHost";
import { OfflineBanner } from "@/components/ui/OfflineBanner";
import { AppErrorScreen } from "@/components/ui/AppErrorScreen";
import { installGlobalErrorReporting } from "@/lib/errorReporting";
import { initializeAds } from "@/lib/adsConsent";
import { joinCoupleByCode } from "@/lib/joinCouple";
import { bindQueryOnlineManager } from "@/hooks/useIsOffline";
import { DialogHost } from "@/components/ui/DialogHost";
import { LetterArrivalHost } from "@/components/letters/LetterArrivalHost";
import { NotificationPermissionHost } from "@/components/common/NotificationPermissionHost";
import { PremiumCelebrationHost } from "@/components/ui/PremiumCelebrationHost";
import { StarPointsToastHost } from "@/modules/stars/components/StarPointsToastHost";

import { useFonts } from 'expo-font';
// Paket kökünden içe aktarmak tüm ağırlık/italik varyantları uygulamaya sokar (~10 MB); yalnızca kullanılanlar alınır
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { Inter_800ExtraBold } from '@expo-google-fonts/inter/800ExtraBold';
import { PlayfairDisplay_400Regular_Italic } from '@expo-google-fonts/playfair-display/400Regular_Italic';
import { PlayfairDisplay_700Bold } from '@expo-google-fonts/playfair-display/700Bold';

SplashScreen.preventAutoHideAsync();

// expo-router (useLinking.native), uygulama bir bağlantıyla açıldığında (geliştirme istemcisi her zaman
// bir URL ile açar) kapsayıcı henüz bağlanmadan "işlenmemiş bağlantı" durumunu yazıyor ve React bunu
// yalnızca geliştirme modunda uyarı olarak gösteriyor. Uygulama koduyla ilgisiz, üretimde görünmez ve zararsız.
LogBox.ignoreLogs(["Can't perform a React state update on a component that hasn't mounted yet"]);

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
  const { isSignedIn, isLoading, isDemoMode, exitDemoMode, refreshProfile } = useAuth();
  const { theme, isLight } = useTheme();
  const { i18n } = useTranslation();
  const languageReady = useLanguageReady();

  // Enforce role-based routing
  useProtectedRoute();

  // Fonts load asynchronously in the background; system font fills in the gap (~200ms)
  useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    PlayfairDisplay_700Bold,
    PlayfairDisplay_400Regular_Italic,
  });

  // Hide splash as soon as auth state and the saved language are resolved — don't wait for fonts
  // (dil beklenmezse kayıtlı tercih okunana kadar ekran bir an yanlış dilde görünebilir)
  useEffect(() => {
    if (!isLoading && languageReady) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [isLoading, languageReady]);

  // Supabase önerisi (React Native): oturum belirteci yalnızca uygulama öndeyken yenilenir; arka plandan
  // dönünce yenileme hemen sürer, böylece ilk istek süresi dolmuş belirteçle gitmez
  useEffect(() => {
    if (AppState.currentState === "active") supabase.auth.startAutoRefresh();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    });
    return () => {
      subscription.remove();
      supabase.auth.stopAutoRefresh();
    };
  }, []);

  // Reklam rızası (UMP) + SDK başlatma: oturum çözüldükten sonra, ekran görünürken (rıza formu üstte açılabilir)
  useEffect(() => {
    if (!isLoading) initializeAds();
  }, [isLoading]);

  // Android bildirim kanallarının adları sistem ayarlarında görünür: dil değişince yeniden yazılır
  useEffect(() => {
    configureAndroidNotificationChannel();
  }, [i18n.language]);

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
    const link = parseAppLink(url);
    if (!link) return;

    // Bu bağlantıların hepsi gerçek bir hesap akışı başlatır. Misafir (demo) oturumu önce kapatılır:
    // açık kalırsa useProtectedRoute doğrulama ve eşleşme ekranlarını demo ana sayfasına geri atıyordu.
    // Demo oturumu da bir `session` taşıdığı için hesap kararı `isSignedIn` ile verilir.
    const leaveDemo = () => {
      if (isDemoMode) exitDemoMode();
    };

    if (link.kind === "verify") {
      leaveDemo();
      router.push({
        pathname: "/(auth)/verify",
        params: { token_hash: link.tokenHash, type: link.type },
      });
      return;
    }

    if (link.kind === "reset-password") {
      leaveDemo();
      router.push({
        pathname: "/(auth)/reset-password",
        params: { token_hash: link.tokenHash },
      });
      return;
    }

    // Davet: kod hafızada tutulur; hesabı olmayan kullanıcıda doğrulama / eşleşme ekranı onu kullanır
    const code = normalizePairingCode(link.code);
    await AsyncStorage.setItem("@pending_invite_code", code);

    if (isSignedIn) {
      // Katılım kendi yönlendirmesini yapar; koruyucu aynı anda ikinci bir yönlendirme yapmasın
      setAuthFlowActive(true);
      try {
        const { error } = await joinCoupleByCode(code);
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
        // Eşleşme ekranı aynı kodu yeniden dener ve hatayı orada gösterir
      } finally {
        releaseAuthFlow();
      }
      router.push({
        pathname: "/(setup)/pairing",
        params: { code },
      });
      return;
    }

    leaveDemo();
    router.push({
      pathname: "/(auth)/login",
      params: { initialMode: "register", inviteCode: code },
    });
  });

  // ── Deep links ──────────────────────────────────────────────────────────────
  // Soğuk açılış bağlantısı, oturum çözülünce (demo mu gerçek hesap mı belli olunca) bir kez işlenir.
  // Eskiden her oturum / demo değişiminde yeniden okunuyordu: aynı bağlantı tekrar tekrar işlenip
  // demodan çıkınca giriş ekranı ikinci kez açılıyor, demo oturumuyla da eşleşme deneniyordu.
  const initialUrlHandledRef = useRef(false);
  useEffect(() => {
    if (isLoading || initialUrlHandledRef.current) return;
    initialUrlHandledRef.current = true;
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink(url);
    });
  }, [isLoading]);

  // Uygulama açıkken (veya arka plandan) gelen bağlantılar
  useEffect(() => {
    const subscription = Linking.addEventListener("url", ({ url }) => {
      handleDeepLink(url);
    });
    return () => subscription.remove();
  }, []);

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
