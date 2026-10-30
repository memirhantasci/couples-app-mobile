import * as Notifications from "expo-notifications";
import { logger } from "@/utils/logger";
import { syncPushTokenIfPermitted } from "@/lib/notifications";
import { supabase } from "@/lib/supabase";
import { Session } from "@supabase/supabase-js";
import { RevenueCatService } from "@/lib/revenuecat";
import { clearStarCache } from "@/modules/stars/utils/starCache";
import { clearSharedSkyTiles } from "@/modules/stars/hooks/useSkyTileStream";
import React, { createContext, useCallback, useContext, useEffect, useEffectEvent, useState, useMemo, useRef } from "react";
import { clearEncryptionKey, hasEncryptionKey, onEncryptionKeyChange, setCoupleEncryptionKey } from "@/utils/crypto";
import { clearStorageImages } from "@/lib/storageImages";
import { safeStorage as AsyncStorage } from "@/lib/safeStorage";
import { getOrCreateDeviceId } from "@/utils/device";
import { isDatesSkipped } from "@/lib/datesSkip";
import { useQueryClient } from "@tanstack/react-query";
import { clearCoupleWidget } from "@/utils/widgetBridge";
import { appAlert } from "@/lib/dialog";
import { toast } from "@/lib/toast";
import { dayjs } from "@/lib/date";

import { Platform, AppState } from "react-native"; // 24 hours
import { DEMO_PROFILE, DEMO_SESSION, prefetchDemoImages } from "@/constants/demoData";
import i18n from "@/lib/i18n";

const CACHED_PROFILE_KEY = "@couples_app_cached_profile";
export const DEVICE_AUTH_CACHE_KEY = "@device_auth_cache";
const DEVICE_AUTH_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// Maximum time (ms) to wait for auth initialization before forcing loading=false
const AUTH_INIT_TIMEOUT_MS = 8000;
// Maximum time (ms) to wait for device auth check
const DEVICE_AUTH_TIMEOUT_MS = 5000;

export interface CoupleProfile {
  coupleId: number | null;   // integer — DB'de INTEGER tipinde
  meetDate: string | null;
  relationshipStartDate: string | null;
  isPaired: boolean;
  hasDates: boolean;
  /** Sosyal girişle gelip cinsiyeti henüz seçmemiş kullanıcı (profil tamamlama gerekir). Yalnızca satır başarıyla okunduysa true olabilir. */
  needsProfileSetup?: boolean;
  displayName: string | null;
  username: string | null;
  gender: string | null;
  isPremium: boolean;
  /** Retained so an open app can react exactly when a timed entitlement ends. */
  premiumExpiresAt?: string | null;
  tokenBalance: number;
}

interface AuthContextValue {
  /** Demo modunda da dolu (sabit demo oturumu); gerçek hesap için `isSignedIn`'e bakın. */
  session: Session | null;
  /** Gerçek bir Supabase oturumu var mı. Demo (misafir) oturumu sayılmaz. */
  isSignedIn: boolean;
  isLoading: boolean;
  profile: CoupleProfile | null;
  isDeviceAuthorized: boolean | null;
  setIsDeviceAuthorized: (val: boolean | null) => void;
  checkDeviceAuth: (userId: string) => Promise<boolean>;
  /** Profili sunucudan yeniden çeker ve güncel hâlini döndürür (oturum yoksa null). */
  refreshProfile: () => Promise<CoupleProfile | null>;
  signOut: () => Promise<void>;
  isDemoMode: boolean;
  enterDemoMode: () => void;
  exitDemoMode: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  isSignedIn: false,
  isLoading: true,
  profile: null,
  isDeviceAuthorized: null,
  setIsDeviceAuthorized: () => { },
  checkDeviceAuth: async () => false,
  refreshProfile: async () => null,
  signOut: async () => { },
  isDemoMode: false,
  enterDemoMode: () => { },
  exitDemoMode: () => { },
});

export function useAuth() {
  return useContext(AuthContext);
}

async function saveCachedProfile(p: CoupleProfile) {
  try {
    await AsyncStorage.setItem(CACHED_PROFILE_KEY, JSON.stringify(p));
  } catch (e) {
    // silent catch
  }
}

async function getCachedProfile(): Promise<CoupleProfile | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHED_PROFILE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

async function fetchProfile(userId: string): Promise<CoupleProfile> {
  const { data: user, error } = await supabase
    .from("users")
    .select(`
      username,
      display_name, 
      gender, 
      couple_id,
      token_balance,
      couples!users_couple_id_fkey(meet_date, relationship_start_date, member_count, is_premium, premium_expires_at, encryption_salt)
    `)
    .eq("id", userId)
    .maybeSingle();

  // Okuma hatası (ör. anlık ağ kopması, tünel, arka plandan dönüş) "eşleşmemiş kullanıcı" sayılmaz:
  // hata yukarı iletilir, mevcut profil, önbellek ve şifreleme anahtarı korunur. Eskiden burada boş
  // profil dönülüyor, önbellek bununla eziliyor ve eşleşmiş kullanıcı eşleşme ekranına atılıyordu.
  if (error) throw error;

  // Satır gerçekten yok (ör. kayıt henüz tamamlanmadı)
  if (!user) {
    return {
      coupleId: null,
      meetDate: null,
      relationshipStartDate: null,
      isPaired: false,
      hasDates: false,
      displayName: null,
      username: null,
      gender: null,
      isPremium: false,
      premiumExpiresAt: null,
      tokenBalance: 0,
    };
  }

  // Handle both possible shapes from Supabase join (array or object depending on relation type)
  const coupleObj = Array.isArray(user.couples) ? user.couples[0] : user.couples;
  
  // Çift anahtarı yalnızca bellekte türetilir; salt profil önbelleğine (diske) yazılmaz
  const parsedCoupleId = user.couple_id ? parseInt(String(user.couple_id), 10) : null;
  setCoupleEncryptionKey(parsedCoupleId, coupleObj?.encryption_salt ?? null);

  // Premium durumunu kontrol et (süresi dolmuş mu?)
  const premiumExpiresAt = coupleObj?.premium_expires_at;
  const isPremiumActive = !!(coupleObj?.is_premium && (!premiumExpiresAt || new Date(premiumExpiresAt) > new Date()));

  // Tanışma tarihi opsiyonel: sevgili olma tarihi yeterli ya da kullanıcı "Daha Sonra Belirle" demiş olmalı
  const datesSkipped = await isDatesSkipped(userId);

  return {
    coupleId: parsedCoupleId,
    meetDate: coupleObj?.meet_date ?? null,
    relationshipStartDate: coupleObj?.relationship_start_date ?? null,
    isPaired: !!(user.couple_id && coupleObj?.member_count >= 2),
    hasDates: !!coupleObj?.relationship_start_date || datesSkipped,
    needsProfileSetup: !user.gender,
    displayName: user.display_name || user.username || null,
    username: user.username || null,
    gender: user.gender ?? null,
    isPremium: isPremiumActive,
    premiumExpiresAt: premiumExpiresAt ?? null,
    tokenBalance: user.token_balance ?? 0,
  };
}

/**
 * Silme talebi bekleyen hesap: silme ancak kullanıcının kendi açık seçimiyle iptal edilir
 * (sessizce değil). Diyalog kapatılamaz; ya silme iptal edilir ya oturum kapanır.
 */
function showPendingDeletionPrompt(scheduledFor: string, signOut: () => Promise<void>) {
  const deletionDay = dayjs(scheduledFor).format("D MMMM YYYY");
  appAlert(
    i18n.t("auth.deletion.pendingTitle"),
    i18n.t("auth.deletion.pendingMessage", { deletionDay }),
    [
      { text: i18n.t("auth.signOut"), style: "cancel", onPress: () => { signOut().catch(() => {}); } },
      {
        text: i18n.t("auth.deletion.cancel"),
        onPress: async () => {
          let failed = false;
          try {
            const { error } = await supabase.rpc("cancel_account_deletion");
            failed = !!error;
          } catch {
            // Ağ katmanı hatası (fırlatılan) da aynı şekilde ele alınır; yakalanmamış Promise reddi oluşmasın
            failed = true;
          }
          if (failed) {
            toast.error(i18n.t("auth.deletion.cancelFailed"));
            showPendingDeletionPrompt(scheduledFor, signOut);
            return;
          }
          toast.success(i18n.t("auth.deletion.canceled"));
        },
      },
    ],
    { cancelable: false, forceDialog: true, tone: "warning" }
  );
}

/**
 * Wraps a promise with a timeout. If the promise doesn't resolve within
 * the given ms, the fallback value is returned instead.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState<CoupleProfile | null>(null);
  const [isDeviceAuthorized, setIsDeviceAuthorized] = useState<boolean | null>(null);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);
  const queryClient = useQueryClient();
  // Abonelik / asenkron geri çağrılar güncel demo durumunu closure'a takılmadan okuyabilsin diye
  const isDemoModeRef = useRef(false);
  useEffect(() => {
    isDemoModeRef.current = isDemoMode;
  }, [isDemoMode]);

  // isDeviceAuthorized hangi hesap için hesaplandı (demo / oturumsuz: null)
  const deviceAuthUserRef = useRef<string | null>(null);

  const enterDemoMode = useCallback(() => {
    isDemoModeRef.current = true;
    prefetchDemoImages();
    setIsDemoMode(true);
    setSession(DEMO_SESSION);
    setProfile(DEMO_PROFILE);
    deviceAuthUserRef.current = null;
    setIsDeviceAuthorized(true);
    setIsLoading(false);
    // Demo verisi şifresizdir; önceki bir oturumun anahtarı demoda kalmasın
    clearEncryptionKey();
  }, []);

  const exitDemoMode = useCallback(() => {
    isDemoModeRef.current = false;
    setIsDemoMode(false);
    setSession(null);
    setProfile(null);
    deviceAuthUserRef.current = null;
    setIsDeviceAuthorized(null);
    setIsLoading(false);
    clearEncryptionKey();
  }, []);

  // Track whether initial session from getSession() has been processed
  // to avoid onAuthStateChange duplicating work for the same session
  const initialSessionProcessed = useRef(false);
  // Track whether profile has been fetched at least once for current session
  const profileFetchedForUser = useRef<string | null>(null);
  // Oturum olayı geri çağrısı güncel profil durumunu closure'a takılmadan okuyabilsin diye
  const hasProfileRef = useRef(false);
  // Yenileme başarısız olduğunda çağırana dönülen, bilinen son profil
  const latestProfileRef = useRef<CoupleProfile | null>(null);
  useEffect(() => {
    hasProfileRef.current = !!profile;
    latestProfileRef.current = profile;
  }, [profile]);

  // Aynı anda süren profil okumalarından yalnızca en son başlayanı state'e yazılır. Aksi halde
  // eşleşmeden önce başlamış yavaş bir okuma, eşleşmeden sonraki yenilemeyi ezip kullanıcıyı
  // (useProtectedRoute aracılığıyla) eşleşme ekranına geri atabiliyordu.
  const profileRequestSeqRef = useRef(0);
  const loadProfile = useCallback(async (userId: string): Promise<CoupleProfile> => {
    const seq = ++profileRequestSeqRef.current;
    const p = await fetchProfile(userId);
    if (seq === profileRequestSeqRef.current) {
      setProfile(p);
      saveCachedProfile(p);
    }
    return p;
  }, []);

  const checkDeviceAuth = useCallback(async (userId: string): Promise<boolean> => {
    try {
      const deviceId = await getOrCreateDeviceId();

      // ⚡ Check 24-hour cache first — skip network call if result is fresh
      const cachedRaw = await AsyncStorage.getItem(DEVICE_AUTH_CACHE_KEY);
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw);
        const isExpired = Date.now() - cached.timestamp > DEVICE_AUTH_CACHE_TTL_MS;
        if (!isExpired && cached.userId === userId && cached.deviceId === deviceId) {
          const isAuth = !!cached.isAuthorized;
          deviceAuthUserRef.current = userId;
          setIsDeviceAuthorized(isAuth);
          return isAuth;
        }
      }

      // Cache miss or expired — hit the network
      const { data: auths, error } = await supabase
        .from("device_authorizations")
        .select("is_authorized")
        .eq("user_id", userId)
        .eq("device_id", deviceId)
        .maybeSingle();

      let isAuth = !error && !!auths?.is_authorized;

      // If this device is not recorded yet, check if the user has ANY authorized devices at all
      if (!isAuth && !error && !auths) {
        const { count, error: countErr } = await supabase
          .from("device_authorizations")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId);

        if (!countErr && (count === 0 || count === null)) {
          // First device ever for this account! Auto-authorize as primary device
          await supabase.from("device_authorizations").upsert({
            user_id: userId,
            device_id: deviceId,
            device_name: Platform.OS,
            is_authorized: true,
          });
          isAuth = true;
        }
      }

      if (isAuth) {
        await AsyncStorage.setItem("last_user_id", userId);
      }

      // Save result to cache
      await AsyncStorage.setItem(DEVICE_AUTH_CACHE_KEY, JSON.stringify({
        userId,
        deviceId,
        isAuthorized: isAuth,
        timestamp: Date.now(),
      })).catch(() => {});

      deviceAuthUserRef.current = userId;
      setIsDeviceAuthorized(isAuth);
      return isAuth;
    } catch {
      deviceAuthUserRef.current = userId;
      setIsDeviceAuthorized(false);
      return false;
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    // ⚡ Defer RevenueCat init by 2s — don't compete with auth on the JS thread at startup
    const rcTimer = setTimeout(() => {
      RevenueCatService.initialize().catch(() => {});
    }, 2000);

    // Safety fallback: if auth initialization takes too long, force isLoading=false
    // This prevents the app from being stuck on a loading screen forever
    const safetyTimer = setTimeout(() => {
      if (mounted) {
        setIsLoading((prev) => {
          if (prev) {
            logger.warn("[AuthProvider] Safety timeout reached — forcing isLoading=false");
          }
          return false;
        });
      }
    }, AUTH_INIT_TIMEOUT_MS);

    // 1. Load cached profile immediately to allow instant rendering without splash freeze
    getCachedProfile().then((cached) => {
      if (!mounted) return;
      // Demo oturumu zaten açıldıysa önbellekteki gerçek (boş olabilen) profil onu ezmemeli
      if (cached && !isDemoModeRef.current) {
        setProfile(cached);
      }
    });

    // 2. Resolve Supabase session & check device authorization + profile IN PARALLEL
    supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
      if (!mounted) return;

      initialSessionProcessed.current = true;
      setSession(initialSession);

      if (!initialSession) {
        // Oturum yok: yeni indiren kullanıcı örnek bir çiftin profiline atılmaz. Karşılama ekranı
        // (useProtectedRoute) giriş / kayıt / demo seçeneklerini sunar; demo yalnızca kullanıcı isterse açılır.
        setIsDeviceAuthorized(null);
        setIsLoading(false);
      } else {
        const userId = initialSession.user.id;
        profileFetchedForUser.current = userId;

        // ⚡ Run device auth check AND profile fetch IN PARALLEL
        // This cuts startup time roughly in half vs sequential execution
        const [, freshProfile] = await Promise.all([
          withTimeout(checkDeviceAuth(userId), DEVICE_AUTH_TIMEOUT_MS, false),
          loadProfile(userId).catch((err) => {
            logger.error("[AuthProvider] initial fetchProfile error:", err);
            return null;
          }),
        ]);

        if (!mounted) return;

        if (freshProfile) {
          // Non-blocking background syncs
          RevenueCatService.logIn(userId).catch(() => {});
          syncPushTokenIfPermitted(userId).catch(() => {});
        }
        setIsLoading(false);
      }
    }).catch((err) => {
      logger.error("[AuthProvider] getSession error:", err);
      if (mounted) {
        setIsLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted) return;

      // For the INITIAL_SESSION event that fires right after getSession,
      // skip processing since getSession already handled it
      if (event === 'INITIAL_SESSION' && initialSessionProcessed.current) {
        return;
      }

      // Demo (misafir) oturumunun Supabase'de karşılığı yoktur: oturumsuz bir olay (SIGNED_OUT vb.)
      // demo oturumunu ve profilini silmemeli. Gerçek bir oturum gelirse demodan çıkılır.
      if (isDemoModeRef.current) {
        if (!newSession) return;
        isDemoModeRef.current = false;
        setIsDemoMode(false);
        // Demo profili ve demonun "yetkili cihaz" durumu gerçek hesabın yönlendirmesine karışmasın:
        // aksi halde yeni cihazdan giren kullanıcı doğrulama ekranından önce ana sayfaya atılıyor,
        // iki yönlendirme çakışıp ekran boş kalıyordu
        setProfile(null);
        hasProfileRef.current = false;
        profileFetchedForUser.current = null;
      }

      // Başka bir hesap için hesaplanmış cihaz durumu, yenisi kontrol edilene kadar kullanılmaz
      if (event === 'SIGNED_IN' && newSession && deviceAuthUserRef.current !== newSession.user.id) {
        deviceAuthUserRef.current = null;
        setIsDeviceAuthorized(null);
      }

      setSession(newSession);
      if (!newSession) {
        // Oturum bitti: şifreleme anahtarı, çözülmüş içerikleri tutan sorgu önbelleği ve
        // fotoğraf önbellekleri bellekten/diskten silinir
        clearEncryptionKey();
        clearSharedSkyTiles();
        queryClient.clear();
        clearStorageImages().catch(() => {});
        setProfile(null);
        deviceAuthUserRef.current = null;
        setIsDeviceAuthorized(null);
        profileFetchedForUser.current = null;
        AsyncStorage.removeItem(CACHED_PROFILE_KEY).catch(() => {});
        // Oturum bitti (çıkış, hesap silme, geçersiz token): widget'taki önceki hesap verisi silinsin
        clearCoupleWidget().catch(() => {});
        setIsLoading(false);
        RevenueCatService.logOut().catch(() => {});
      } else {
        // Yeni bir hesap için profil henüz çekilmediyse (ve önbellekte yoksa) yönlendirme profili beklesin
        if (profileFetchedForUser.current !== newSession.user.id && !hasProfileRef.current) {
          setIsLoading(true);
        }
        // For TOKEN_REFRESHED events, don't re-run device auth check
        if (event === 'TOKEN_REFRESHED') return;
        // Check device auth for new sign-in or session recovery
        await withTimeout(
          checkDeviceAuth(newSession.user.id),
          DEVICE_AUTH_TIMEOUT_MS,
          false
        );
      }
    });

    return () => {
      mounted = false;
      clearTimeout(safetyTimer);
      clearTimeout(rcTimer);
      subscription.unsubscribe();
    };
  }, [checkDeviceAuth, loadProfile, queryClient]);

  // Anahtar ilk kez türetildiğinde ya da çift değiştiğinde, anahtar gelmeden çözülemeyip boş
  // görünen içerikler (ör. girişten hemen sonra açılan ana sayfa) yeniden çekilir
  useEffect(() => onEncryptionKeyChange(() => {
    if (hasEncryptionKey()) queryClient.invalidateQueries();
  }), [queryClient]);

  useEffect(() => {
    if (isDemoMode) return;
    if (!session?.user?.id) return;

    const userId = session.user.id;

    // Initial load is already handled in parallel inside getSession().then()
    // Only run here for subsequent session changes (e.g. after sign-in from login screen)
    if (profileFetchedForUser.current === userId) {
      return;
    }

    // Önbellekte profil yoksa yükleme durumu onAuthStateChange'de açıldı; burada yalnızca çekilir
    profileFetchedForUser.current = userId;

    loadProfile(userId)
      .then(() => {
        setIsLoading(false);

        // Non-blocking background syncs
        RevenueCatService.logIn(userId).catch(() => {});
        syncPushTokenIfPermitted(userId).catch(() => {});
      })
      .catch((err) => {
        logger.error("fetchProfile error:", err);
        // Even on error, we must stop loading. Use cached profile if available.
        setIsLoading(false);
      });
  }, [session?.user?.id, loadProfile]);

  const refreshProfile = useCallback(async (): Promise<CoupleProfile | null> => {
    // Demo profili sunucuda yoktur: yenileme, premium'lu örnek profili boş bir profille ezip
    // sayaçları boşaltıyor ve kilit duvarlarını çıkarıyordu (ör. uygulama arka plandan dönünce).
    if (isDemoModeRef.current) return DEMO_PROFILE;
    // State'teki oturum yerine istemcinin güncel oturumu okunur: giriş / doğrulama ekranı yeni
    // oturum açıldıktan hemen sonra çağırdığında eski (boş) oturum closure'ı profili silmesin
    const { data: { session: current } } = await supabase.auth.getSession();
    const userId = current?.user?.id;
    if (!userId) {
      setProfile(null);
      await AsyncStorage.removeItem(CACHED_PROFILE_KEY).catch(() => {});
      return null;
    }
    try {
      return await loadProfile(userId);
    } catch (err) {
      // Geçici okuma hatası: state ve önbellek olduğu gibi kalır, çağırana bilinen son profil döner
      logger.warn("[AuthProvider] refreshProfile failed, keeping last known profile:", err);
      return latestProfileRef.current;
    }
  }, [loadProfile]);

  // Açılışta profil okunamadıysa ve önbellekte de yoksa yönlendirme profili bekler (bkz.
  // useProtectedRoute); bağlantı gelene kadar artan aralıklarla yeniden denenir
  useEffect(() => {
    if (isDemoMode || isLoading || profile) return;
    const userId = session?.user?.id;
    if (!userId) return;

    let cancelled = false;
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout>;
    const scheduleRetry = () => {
      timer = setTimeout(() => {
        loadProfile(userId).catch(() => {
          if (cancelled) return;
          attempt += 1;
          scheduleRetry();
        });
      }, Math.min(2000 * 2 ** attempt, 30000));
    };
    scheduleRetry();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isDemoMode, isLoading, profile, session?.user?.id, loadProfile]);

  // Realtime listener for database changes (e.g. premium status, token balance)
  useEffect(() => {
    if (isDemoMode) return;
    if (!session?.user?.id) return;

    const channel = supabase.channel(`profile_changes_${session.user.id}`);

    // Listen to changes on the user's row
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'users', filter: `id=eq.${session.user.id}` },
      () => { refreshProfile().catch(() => {}); }
    );

    // Listen to changes on the couple's row
    if (profile?.coupleId) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'couples', filter: `id=eq.${profile.coupleId}` },
        () => {
          refreshProfile().catch(() => {});
          // Partner ilişki tarihlerini değiştirdiğinde ya da premium aldığında bu telefondaki gün sayacı,
          // yıl dönümleri, premium'a bağlı içerikler ve aşk skoru da güncellensin
          for (const key of ["home_dashboard", "calendar_data", "memories", "photo_archive", "love_score", "couple_avatars"]) {
            queryClient.invalidateQueries({ queryKey: [key] });
          }
        }
      );

      // Partnerin profil fotoğrafı değişince her iki telefonda da avatarlar anında yenilensin
      channel.on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'users', filter: `couple_id=eq.${profile.coupleId}` },
        () => queryClient.invalidateQueries({ queryKey: ["couple_avatars"] })
      );
    }

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id, profile?.coupleId, refreshProfile, queryClient]);

  const foregroundRefreshInFlightRef = useRef(false);

  // A timestamp expiration does not create a database UPDATE, therefore a
  // realtime subscription alone cannot flip the UI to locked mode. Transition
  // locally at the exact expiry moment, then refresh to reconcile the source
  // of truth. Lifetime/promotional entitlements intentionally have no timer.
  useEffect(() => {
    const premiumExpiresAt = profile?.premiumExpiresAt;
    if (isDemoMode || !premiumExpiresAt) return;

    const remainingMs = new Date(premiumExpiresAt).getTime() - Date.now();
    if (!Number.isFinite(remainingMs)) return;

    let timer: ReturnType<typeof setTimeout>;
    const expire = () => {
      setProfile((current) => (
        current?.premiumExpiresAt === premiumExpiresAt
          ? { ...current, isPremium: false }
          : current
      ));
      refreshProfile().catch(() => {});
    };
    const scheduleExpiry = () => {
      // JavaScript timers cap at roughly 24.8 days. Re-check in chunks for a
      // subscription that was granted far into the future.
      const msUntilExpiry = new Date(premiumExpiresAt).getTime() - Date.now();
      if (msUntilExpiry <= 0) {
        timer = setTimeout(expire, 50);
        return;
      }
      timer = setTimeout(scheduleExpiry, Math.min(msUntilExpiry, 2_147_483_647));
    };
    scheduleExpiry();

    return () => clearTimeout(timer);
  }, [isDemoMode, profile?.premiumExpiresAt, refreshProfile]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') return;
      // Demo oturumunda yenilenecek bir sunucu profili yok
      if (isDemoModeRef.current) return;

      const observedExpiresAt = profile?.premiumExpiresAt;
      const expiryMs = observedExpiresAt ? Date.parse(observedExpiresAt) : Number.POSITIVE_INFINITY;
      const expired = Number.isFinite(expiryMs) && Date.now() >= expiryMs;

      if (expired) {
        setProfile((current) => {
          // Callback oluşturulduktan sonra üyelik yenilenmiş olabilir.
          if (!current || current.premiumExpiresAt !== observedExpiresAt) {
            return current;
          }
          return current.isPremium ? { ...current, isPremium: false } : current;
        });
      }

      if (foregroundRefreshInFlightRef.current) return;
      foregroundRefreshInFlightRef.current = true;

      void refreshProfile()
        .catch((error) => {
          logger.warn('Premium profile refresh failed on foreground', { error });
        })
        .finally(() => {
          foregroundRefreshInFlightRef.current = false;
        });
    });

    return () => subscription.remove();
  }, [profile?.premiumExpiresAt, refreshProfile]);

  const signedInCoupleId = profile?.coupleId ?? null;
  const signOut = useCallback(async () => {
    if (isDemoMode) {
      exitDemoMode();
      return;
    }
    profileFetchedForUser.current = null;

    // Çift özelindeki önbellekleri ve hassas yerel verileri sıfırla
    if (signedInCoupleId) {
      await AsyncStorage.removeItem(`@love_score_${signedInCoupleId}`).catch(() => {});
      await AsyncStorage.removeItem(`@couples_letter_draft_${signedInCoupleId}`).catch(() => {});
      await AsyncStorage.removeItem(`@defaults_seeded_${signedInCoupleId}`).catch(() => {});
      await AsyncStorage.removeItem(`@period_notif_scheduled_${signedInCoupleId}`).catch(() => {});
      clearStarCache(signedInCoupleId);
    }
    const currentUserId = session?.user?.id;
    const keysToRemove = [
      DEVICE_AUTH_CACHE_KEY,
      CACHED_PROFILE_KEY,
      "last_user_id",
      "@pending_invite_code",
      "@notification_priming_dismissed_at",
      ...(currentUserId
        ? [
            `couples_app_profile_cache_${currentUserId}`,
            `@dates_skipped_${currentUserId}`,
          ]
        : []),
    ];
    await Promise.all(keysToRemove.map((k) => AsyncStorage.removeItem(k).catch(() => {})));
    await clearCoupleWidget().catch(() => {});

    // Bu cihaz artık bu hesaba ait değil: zamanlanmış yerel hatırlatıcıları (ilaç, buluşma, mektup...)
    // ve cihazın push kaydını temizle. Aksi halde aynı telefonda başka hesap açıldığında önceki
    // kullanıcının ilaç alarmları çalar ve partner bildirimleri bu telefona düşmeye devam eder.
    await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
    try {
      const { data: { session: current } } = await supabase.auth.getSession();
      if (current?.user?.id) {
        await supabase.from("push_tokens").delete().eq("user_id", current.user.id);
      }
    } catch {
      // Çıkış yine de tamamlanmalı
    }

    await supabase.auth.signOut();
  }, [isDemoMode, exitDemoMode, signedInCoupleId]);

  // Silinmek üzere olan hesapla giriş yapıldı (bkz. showPendingDeletionPrompt)
  const signOutRef = useRef(signOut);
  useEffect(() => {
    signOutRef.current = signOut;
  }, [signOut]);
  const promptPendingDeletion = useEffectEvent((scheduledFor: string) => {
    showPendingDeletionPrompt(scheduledFor, () => signOutRef.current());
  });

  const deletionCheckedForUser = useRef<string | null>(null);
  useEffect(() => {
    if (isDemoMode) return;
    const userId = session?.user?.id;
    if (!userId) {
      // Aynı hesapla yeniden girişte tekrar bakılsın
      deletionCheckedForUser.current = null;
      return;
    }
    if (deletionCheckedForUser.current === userId) return;
    deletionCheckedForUser.current = userId;

    let cancelled = false;
    supabase
      .from("account_deletion_requests")
      .select("scheduled_for")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data, error }) => {
        // Hata (ör. ağ) durumunda kullanıcı engellenmez; bir sonraki açılışta yeniden bakılır
        if (cancelled || error || !data?.scheduled_for) return;
        promptPendingDeletion(data.scheduled_for);
      });
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id, isDemoMode]);

  // Demo modunda tüketicilere HER ZAMAN sabit demo oturumu ve premium'lu demo profili sunulur;
  // iç state'e yanlışlıkla yazılan herhangi bir değer arayüzü (kilitler, sayaçlar) bozamaz.
  const exposedSession = isDemoMode ? DEMO_SESSION : session;
  const exposedProfile = isDemoMode ? DEMO_PROFILE : profile;
  const isSignedIn = !isDemoMode && !!session;

  const value = useMemo<AuthContextValue>(
    () => ({
      session: exposedSession,
      isSignedIn,
      isLoading,
      profile: exposedProfile,
      isDeviceAuthorized,
      setIsDeviceAuthorized,
      checkDeviceAuth,
      refreshProfile,
      signOut,
      isDemoMode,
      enterDemoMode,
      exitDemoMode,
    }),
    [
      exposedSession,
      isSignedIn,
      isLoading,
      exposedProfile,
      isDeviceAuthorized,
      checkDeviceAuth,
      refreshProfile,
      signOut,
      isDemoMode,
      enterDemoMode,
      exitDemoMode,
    ]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
