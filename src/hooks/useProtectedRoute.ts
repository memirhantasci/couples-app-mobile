import { useEffect } from "react";
import { logger } from "@/utils/logger";
import { useRouter, useSegments, useRootNavigationState } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { getOrCreateDeviceId } from "@/utils/device";
import { isDemoOrReviewerAccount } from "@/utils/demo";
import { isAuthFlowActive } from "@/lib/navigate";

export function useProtectedRoute() {
  const { session, isLoading, profile, isDeviceAuthorized, isDemoMode } = useAuth();
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

    // Verification screens: email confirmation (verify) or device OTP verification (verify-device)
    const isVerifying = currentRoute.includes("verify");

    let cancelled = false;
    const timer = setTimeout(() => {
      // Giriş / doğrulama ekranı kendi yönlendirmesini yapıyor; çift yönlendirme çökmeye yol açar
      if (isAuthFlowActive()) return;

      // 0. Demo Mode: Guests exploring the app. Doğrulama / davet bağlantıları demodan önce çıkar
      // (bkz. _layout handleDeepLink), bu yüzden burada doğrulama ekranındaki misafir yalnızca geri gönderilir.
      if (isDemoMode) {
        if (inSetupGroup || isVerifying || isAtRoot) {
          router.replace("/(tabs)/home");
        }
        return;
      }

      if (!session) {
        // 1. Unauthenticated users: karşılama ekranı (giriş / kayıt / demo seçimi). Demo kendiliğinden
        // açılmaz; kullanıcı "Uygulamayı Keşfet" derse enterDemoMode çalışır (bkz. welcome.tsx).
        if (!inAuthGroup) {
          router.replace("/(auth)/welcome");
        }
      } else {
        // 2. Authenticated Users

        // If device authorization check is still resolving, don't redirect anywhere yet
        if (isDeviceAuthorized === null) {
          return;
        }

        // If user is currently on verification screen (email confirmation or device verification), let them stay and finish it
        if (isVerifying) {
          return;
        }

        // If the device is not authorized for this user, force them to verify-device screen
        if (isDeviceAuthorized === false && !isDemoOrReviewerAccount(session?.user?.id) && !isDemoOrReviewerAccount(session?.user?.email)) {
          // Doğrulama ekranları yukarıda bırakıldı; giriş ekranı cihaz doğrulamasına kendisi geçer
          if (!currentRoute.includes("login")) {
            // verify-device.tsx cihazı yetkilendirmek için deviceId parametresine ihtiyaç duyar
            // (upsert'in "user_id, device_id" conflict hedefi). Eskiden burada eksikti: kullanıcı
            // yetkisiz bir cihazla (ör. yeniden kurulumda Keychain'deki oturum hayatta kalırken
            // cihaz kimliği sıfırlanmış) uygulamayı her açtığında deviceId'siz bu ekrana düşüyor,
            // doğrulama kodu girince cihaz hiç kaydolmuyor ya da hata fırlatıyordu.
            getOrCreateDeviceId()
              .then((deviceId) => {
                // Bu arada oturum / ekran değiştiyse eski karara göre yönlendirme yapılmaz
                if (cancelled) return;
                router.replace({
                  pathname: "/(auth)/verify-device",
                  params: {
                    userId: session.user.id,
                    deviceId,
                    email: session.user.email || "",
                  },
                });
              })
              .catch((err) => {
                // deviceId'siz doğrulama ekranı cihazı kaydedemez; bir sonraki tetiklemede yeniden denenir
                logger.warn("[useProtectedRoute] device id unavailable:", err);
              });
          }
          return;
        }

        // Profil henüz yüklenemediyse (yavaş bağlantıda AUTH_INIT_TIMEOUT_MS doldu, okuma başarısız)
        // eşleşme durumu bilinmiyor: eşleşmiş kullanıcı yanlışlıkla eşleşme ekranına atılmasın.
        // AuthContext profili yeniden dener; geldiğinde bu etki tekrar çalışır.
        if (!profile) {
          return;
        }

        // Sosyal girişle gelip cinsiyeti/ismi henüz belirlememiş kullanıcı önce profilini tamamlamalı
        // (uygulama bu adımda kapanıp açılsa bile buradan devam eder)
        if (profile.needsProfileSetup) {
          if (!currentRoute.includes("complete-profile")) {
            router.replace("/(auth)/complete-profile");
          }
          return;
        }

        // Prevent authorized users from going back to login/auth pages
        const isTryingToAccessAuth = inAuthGroup;

        if (!profile.isPaired) {
          // Role: Paired yet? NO
          // They must complete the pairing step.
          if (!currentRoute.includes("pairing")) {
            router.replace("/(setup)/pairing");
          }
        } else if (!profile.hasDates) {
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

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [session, isLoading, profile, isDeviceAuthorized, isDemoMode, segments, navigationState?.key]);
}
