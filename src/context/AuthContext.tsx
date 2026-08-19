import { registerForPushNotifications } from "@/lib/notifications";
import { supabase } from "@/lib/supabase";
import { Session } from "@supabase/supabase-js";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

export interface CoupleProfile {
  coupleId: number | null;   // integer — DB'de INTEGER tipinde
  meetDate: string | null;
  relationshipStartDate: string | null;
  isPaired: boolean;
  hasDates: boolean;
  displayName: string | null;
  gender: string | null;
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
  const { data: user } = await supabase
    .from("users")
    .select("display_name, gender, couple_id")
    .eq("id", userId)
    .single();

  if (!user) {
    return {
      coupleId: null,
      meetDate: null,
      relationshipStartDate: null,
      isPaired: false,
      hasDates: false,
      displayName: null,
      gender: null,
    };
  }

  let couple: any = null;
  if (user.couple_id) {
    const { data: cData } = await supabase
      .from("couples")
      .select("meet_date, relationship_start_date")
      .eq("id", user.couple_id)
      .single();
    if (cData) {
      couple = cData;
    }
  }

  return {
    coupleId: user.couple_id ? parseInt(String(user.couple_id), 10) : null,
    meetDate: couple?.meet_date ?? null,
    relationshipStartDate: couple?.relationship_start_date ?? null,
    isPaired: !!user.couple_id,
    hasDates: !!(couple?.meet_date && couple?.relationship_start_date),
    displayName: user.display_name ?? null,
    gender: user.gender ?? null,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState<CoupleProfile | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchProfile(session.user.id).then(setProfile);
        registerForPushNotifications(session.user.id).catch(() => { });
      }
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        fetchProfile(session.user.id).then(setProfile);
        registerForPushNotifications(session.user.id).catch(() => { });
      } else {
        setProfile(null);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!session?.user?.id) {
      setProfile(null);
      return;
    }
    const p = await fetchProfile(session.user.id);
    setProfile(p);
  }, [session]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return (
    <AuthContext.Provider value={{ session, isLoading, profile, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
