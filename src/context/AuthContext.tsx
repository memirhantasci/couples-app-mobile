import { registerForPushNotifications } from "@/lib/notifications";
import { supabase } from "@/lib/supabase";
import { Session } from "@supabase/supabase-js";
import { RevenueCatService } from "@/lib/revenuecat";
import React, { createContext, useCallback, useContext, useEffect, useState, useMemo } from "react";
import { decrypt } from "@/utils/crypto";
import { setAdLoggingOut } from "../utils/adFlags";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getOrCreateDeviceId } from "@/utils/device";

const CACHED_PROFILE_KEY = "@couples_app_cached_profile";

export interface CoupleProfile {
  coupleId: number | null;   // integer — DB'de INTEGER tipinde
  meetDate: string | null;
  relationshipStartDate: string | null;
  isPaired: boolean;
  hasDates: boolean;
  displayName: string | null;
  gender: string | null;
  isPremium: boolean;
  tokenBalance: number;
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
      display_name, 
      gender, 
      couple_id,
      token_balance,
      couples!users_couple_id_fkey(meet_date, relationship_start_date, member_count, is_premium, premium_expires_at)
    `)
    .eq("id", userId)
    .single();

  if (error || !user) {
    return {
      coupleId: null,
      meetDate: null,
      relationshipStartDate: null,
      isPaired: false,
      hasDates: false,
      displayName: null,
      gender: null,
      isPremium: false,
      tokenBalance: 0,
    };
  }

  // Handle both possible shapes from Supabase join (array or object depending on relation type)
  const coupleObj = Array.isArray(user.couples) ? user.couples[0] : user.couples;

  // Premium durumunu kontrol et (süresi dolmuş mu?)
  const premiumExpiresAt = coupleObj?.premium_expires_at;
  const isPremiumActive = !!(coupleObj?.is_premium && (!premiumExpiresAt || new Date(premiumExpiresAt) > new Date()));

  return {
    coupleId: user.couple_id ? parseInt(String(user.couple_id), 10) : null,
    meetDate: coupleObj?.meet_date ?? null,
    relationshipStartDate: coupleObj?.relationship_start_date ?? null,
    isPaired: !!(user.couple_id && coupleObj?.member_count >= 2),
    hasDates: !!(coupleObj?.meet_date && coupleObj?.relationship_start_date),
    displayName: user.display_name ? decrypt(user.display_name) : null,
    gender: user.gender ?? null,
    isPremium: isPremiumActive,
    tokenBalance: user.token_balance ?? 0,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState<CoupleProfile | null>(null);
  const [isDeviceAuthorized, setIsDeviceAuthorized] = useState<boolean | null>(null);

  const checkDeviceAuth = useCallback(async (userId: string): Promise<boolean> => {
    try {
      const deviceId = await getOrCreateDeviceId();
      const lastUserId = await AsyncStorage.getItem("last_user_id");

      const { data: auths, error } = await supabase
        .from("device_authorizations")
        .select("is_authorized")
        .eq("user_id", userId)
        .eq("device_id", deviceId)
        .maybeSingle();

      const isAuth = (lastUserId === userId) && !error && !!auths?.is_authorized;
      setIsDeviceAuthorized(isAuth);
      return isAuth;
    } catch {
      setIsDeviceAuthorized(false);
      return false;
    }
  }, []);

  useEffect(() => {
    // Background initialization
    RevenueCatService.initialize().catch(() => {});

    // 1. Load cached profile immediately to allow instant rendering without splash freeze
    getCachedProfile().then((cached) => {
      if (cached) {
        setProfile(cached);
        setIsLoading(false);
      }
    });

    // 2. Resolve Supabase session & check device authorization
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (!session) {
        setIsLoading(false);
        setIsDeviceAuthorized(null);
      } else {
        await checkDeviceAuth(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      if (!session) {
        setProfile(null);
        setIsDeviceAuthorized(null);
        AsyncStorage.removeItem(CACHED_PROFILE_KEY).catch(() => {});
        setIsLoading(false);
        RevenueCatService.logOut();
      } else {
        setAdLoggingOut(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [checkDeviceAuth]);

  useEffect(() => {
    if (session?.user?.id) {
      // If we don't have a cached profile loaded yet, keep loading active until initial fetch
      if (!profile) {
        setIsLoading(true);
      }

      fetchProfile(session.user.id)
        .then((p) => {
          setProfile(p);
          saveCachedProfile(p);
          setIsLoading(false);

          // Non-blocking background syncs
          RevenueCatService.logIn(session.user.id).catch(() => {});
          registerForPushNotifications(session.user.id).catch(() => {});
        })
        .catch((err) => {
          console.error("fetchProfile error:", err);
          setIsLoading(false);
        });
    }
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
    if (!session?.user?.id) return;

    const channel = supabase.channel('profile_changes');

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

  const signOut = useCallback(async () => {
    setAdLoggingOut(true);
    await AsyncStorage.removeItem(CACHED_PROFILE_KEY).catch(() => {});
    await supabase.auth.signOut();
  }, []);

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
    }),
    [
      session,
      isLoading,
      profile,
      isDeviceAuthorized,
      checkDeviceAuth,
      refreshProfile,
      signOut,
    ]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
