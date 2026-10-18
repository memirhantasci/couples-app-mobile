import { registerForPushNotifications, syncPushTokenIfPermitted } from "@/lib/notifications";
import { supabase } from "@/lib/supabase";
import { Session } from "@supabase/supabase-js";
import { RevenueCatService } from "@/lib/revenuecat";
import React, { createContext, useCallback, useContext, useEffect, useState, useMemo, useRef } from "react";
import { decrypt, deterministicDecrypt, setSessionEncryptionKey } from "@/utils/crypto";
import { setAdLoggingOut } from "../utils/adFlags";
import { safeStorage as AsyncStorage } from "@/lib/safeStorage";
import { getOrCreateDeviceId } from "@/utils/device";

import { Platform, AppState } from "react-native";

const CACHED_PROFILE_KEY = "@couples_app_cached_profile";
export const DEVICE_AUTH_CACHE_KEY = "@device_auth_cache";
const DEVICE_AUTH_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
import { DEMO_PROFILE, DEMO_SESSION } from "@/constants/demoData";

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
  displayName: string | null;
  username: string | null;
  gender: string | null;
  isPremium: boolean;
  /** Retained so an open app can react exactly when a timed entitlement ends. */
  premiumExpiresAt?: string | null;
  tokenBalance: number;
  encryptionSalt: string | null;
}

interface AuthContextValue {
  session: Session | null;
  isLoading: boolean;
  profile: CoupleProfile | null;
  isDeviceAuthorized: boolean | null;
  setIsDeviceAuthorized: (val: boolean | null) => void;
  checkDeviceAuth: (userId: string) => Promise<boolean>;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  isDemoMode: boolean;
  enterDemoMode: () => void;
  exitDemoMode: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  isLoading: true,
  profile: null,
  isDeviceAuthorized: null,
  setIsDeviceAuthorized: () => { },
  checkDeviceAuth: async () => false,
  refreshProfile: async () => { },
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
    .single();

  if (error || !user) {
    setSessionEncryptionKey(userId, null, null);
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
      encryptionSalt: null,
    };
  }

  // Handle both possible shapes from Supabase join (array or object depending on relation type)
  const coupleObj = Array.isArray(user.couples) ? user.couples[0] : user.couples;
  
  // Set the dynamic encryption key for this session before any decryption
  const parsedCoupleId = user.couple_id ? parseInt(String(user.couple_id), 10) : null;
  setSessionEncryptionKey(userId, parsedCoupleId, coupleObj?.encryption_salt ?? null);

  // Premium durumunu kontrol et (süresi dolmuş mu?)
  const premiumExpiresAt = coupleObj?.premium_expires_at;
  const isPremiumActive = !!(coupleObj?.is_premium && (!premiumExpiresAt || new Date(premiumExpiresAt) > new Date()));

  const decDisplayName = user.display_name ? decrypt(user.display_name) : null;
  const decUsername = user.username ? deterministicDecrypt(user.username) : null;

  return {
    coupleId: parsedCoupleId,
    meetDate: coupleObj?.meet_date ?? null,
    relationshipStartDate: coupleObj?.relationship_start_date ?? null,
    isPaired: !!(user.couple_id && coupleObj?.member_count >= 2),
    hasDates: !!(coupleObj?.meet_date && coupleObj?.relationship_start_date),
    displayName: decDisplayName || decUsername || null,
    username: decUsername || null,
    gender: user.gender ?? null,
    isPremium: isPremiumActive,
    premiumExpiresAt: premiumExpiresAt ?? null,
    tokenBalance: user.token_balance ?? 0,
    encryptionSalt: coupleObj?.encryption_salt ?? null,
  };
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

  const enterDemoMode = useCallback(() => {
    setIsDemoMode(true);
    setSession(DEMO_SESSION);
    setProfile(DEMO_PROFILE);
    setIsDeviceAuthorized(true);
    setIsLoading(false);
    setSessionEncryptionKey(DEMO_SESSION.user.id, DEMO_PROFILE.coupleId, DEMO_PROFILE.encryptionSalt);
  }, []);

  const exitDemoMode = useCallback(() => {
    setIsDemoMode(false);
    setSession(null);
    setProfile(null);
    setIsDeviceAuthorized(null);
    setIsLoading(false);
    setSessionEncryptionKey("", null, null);
  }, []);

  // Track whether initial session from getSession() has been processed
  // to avoid onAuthStateChange duplicating work for the same session
  const initialSessionProcessed = useRef(false);
  // Track whether profile has been fetched at least once for current session
  const profileFetchedForUser = useRef<string | null>(null);

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

      setIsDeviceAuthorized(isAuth);
      return isAuth;
    } catch {
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
            console.warn("[AuthProvider] Safety timeout reached — forcing isLoading=false");
          }
          return false;
        });
      }
    }, AUTH_INIT_TIMEOUT_MS);

    // 1. Load cached profile immediately to allow instant rendering without splash freeze
    getCachedProfile().then((cached) => {
      if (!mounted) return;
      if (cached) {
        setProfile(cached);
      }
    });

    // 2. Resolve Supabase session & check device authorization + profile IN PARALLEL
    supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
      if (!mounted) return;

      initialSessionProcessed.current = true;
      setSession(initialSession);

      if (!initialSession) {
        setIsDeviceAuthorized(null);
        enterDemoMode();
      } else {
        const userId = initialSession.user.id;
        profileFetchedForUser.current = userId;

        // ⚡ Run device auth check AND profile fetch IN PARALLEL
        // This cuts startup time roughly in half vs sequential execution
        const [, freshProfile] = await Promise.all([
          withTimeout(checkDeviceAuth(userId), DEVICE_AUTH_TIMEOUT_MS, false),
          fetchProfile(userId).catch((err) => {
            console.error("[AuthProvider] initial fetchProfile error:", err);
            return null;
          }),
        ]);

        if (!mounted) return;

        if (freshProfile) {
          setProfile(freshProfile);
          saveCachedProfile(freshProfile);
          // Non-blocking background syncs
          RevenueCatService.logIn(userId).catch(() => {});
          syncPushTokenIfPermitted(userId).catch(() => {});
        }
        setIsLoading(false);
      }
    }).catch((err) => {
      console.error("[AuthProvider] getSession error:", err);
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

      setSession(newSession);
      if (!newSession) {
        setProfile(null);
        setIsDeviceAuthorized(null);
        profileFetchedForUser.current = null;
        AsyncStorage.removeItem(CACHED_PROFILE_KEY).catch(() => {});
        setIsLoading(false);
        RevenueCatService.logOut();
      } else {
        setAdLoggingOut(false);
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
  }, [checkDeviceAuth]);

  useEffect(() => {
    if (isDemoMode) return;
    if (!session?.user?.id) return;

    const userId = session.user.id;

    // Initial load is already handled in parallel inside getSession().then()
    // Only run here for subsequent session changes (e.g. after sign-in from login screen)
    if (profileFetchedForUser.current === userId) {
      return;
    }

    // If we don't have a cached profile loaded yet, keep loading active until fetch
    if (!profile) {
      setIsLoading(true);
    }

    profileFetchedForUser.current = userId;

    fetchProfile(userId)
      .then((p) => {
        setProfile(p);
        saveCachedProfile(p);
        setIsLoading(false);

        // Non-blocking background syncs
        RevenueCatService.logIn(userId).catch(() => {});
        syncPushTokenIfPermitted(userId).catch(() => {});
      })
      .catch((err) => {
        console.error("fetchProfile error:", err);
        // Even on error, we must stop loading. Use cached profile if available.
        setIsLoading(false);
      });
  }, [session?.user?.id]);

  const refreshProfile = useCallback(async () => {
    if (!session?.user?.id) {
      setProfile(null);
      await AsyncStorage.removeItem(CACHED_PROFILE_KEY).catch(() => {});
      return;
    }
    const p = await fetchProfile(session.user.id);
    setProfile(p);
    saveCachedProfile(p);
  }, [session]);

  // Realtime listener for database changes (e.g. premium status, token balance)
  useEffect(() => {
    if (isDemoMode) return;
    if (!session?.user?.id) return;

    const channel = supabase.channel(`profile_changes_${session.user.id}`);

    // Listen to changes on the user's row
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'users', filter: `id=eq.${session.user.id}` },
      () => refreshProfile()
    );

    // Listen to changes on the couple's row
    if (profile?.coupleId) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'couples', filter: `id=eq.${profile.coupleId}` },
        () => refreshProfile()
      );
    }

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id, profile?.coupleId, refreshProfile]);

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
          console.warn('Premium profile refresh failed on foreground', { error });
        })
        .finally(() => {
          foregroundRefreshInFlightRef.current = false;
        });
    });

    return () => subscription.remove();
  }, [profile?.premiumExpiresAt, refreshProfile]);

  const signOut = useCallback(async () => {
    if (isDemoMode) {
      exitDemoMode();
      return;
    }
    setAdLoggingOut(true);
    profileFetchedForUser.current = null;
    
    // Çift özelindeki önbellekleri ve hassas yerel verileri sıfırla
    if (profile?.coupleId) {
      await AsyncStorage.removeItem(`@love_score_${profile.coupleId}`).catch(() => {});
      await AsyncStorage.removeItem(`@couples_letter_draft_${profile.coupleId}`).catch(() => {});
      await AsyncStorage.removeItem(`@defaults_seeded_${profile.coupleId}`).catch(() => {});
      await AsyncStorage.removeItem(`@period_notif_scheduled_${profile.coupleId}`).catch(() => {});
    }
    await AsyncStorage.removeItem("@pending_invite_code").catch(() => {});
    
    // Clear device auth cache on sign-out so next user gets a fresh check
    await AsyncStorage.removeItem(DEVICE_AUTH_CACHE_KEY).catch(() => {});
    await AsyncStorage.removeItem(CACHED_PROFILE_KEY).catch(() => {});
    await supabase.auth.signOut();
  }, [isDemoMode, exitDemoMode, profile?.coupleId]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isLoading,
      profile,
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
      session,
      isLoading,
      profile,
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
