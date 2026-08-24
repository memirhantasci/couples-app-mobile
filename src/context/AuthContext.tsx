import { registerForPushNotifications } from "@/lib/notifications";
import { supabase } from "@/lib/supabase";
import { Session } from "@supabase/supabase-js";
import { RevenueCatService } from "@/lib/revenuecat";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { decrypt } from "@/utils/crypto";

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
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  isLoading: true,
  profile: null,
  refreshProfile: async () => { },
  signOut: async () => { },
});

export function useAuth() {
  return useContext(AuthContext);
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

  useEffect(() => {
    RevenueCatService.initialize();

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) {
        setProfile(null);
        setIsLoading(false);
        RevenueCatService.logOut();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.user?.id) {
      setIsLoading(true);
      fetchProfile(session.user.id)
        .then(async (p) => {
          setProfile(p);
          // Login to RevenueCat to sync premium status
          await RevenueCatService.logIn(session.user.id);
          // If the login synced something, we might want to refresh profile, but let's do it seamlessly:
          // In reality, set_premium_status will trigger a realtime change if they use it, but for now we just log in.
          setIsLoading(false);
        })
        .catch((err) => {
          console.error("fetchProfile error:", err);
          setIsLoading(false);
        });
      
      registerForPushNotifications(session.user.id).catch(() => {});
    }
  }, [session?.user?.id]);

  const refreshProfile = useCallback(async () => {
    if (!session?.user?.id) {
      setProfile(null);
      return;
    }
    const p = await fetchProfile(session.user.id);
    setProfile(p);
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
    await supabase.auth.signOut();
  }, []);

  return (
    <AuthContext.Provider value={{ session, isLoading, profile, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
