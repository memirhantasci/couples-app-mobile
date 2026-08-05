import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CoupleProfile {
  coupleId: string | null;
  meetDate: string | null;
  relationshipStartDate: string | null;
  isPaired: boolean;
  hasDates: boolean;
}

interface AuthContextValue {
  /** Supabase raw session (null = logged out) */
  session: Session | null;
  /** null while the first session check hasn't finished */
  isLoading: boolean;
  /** Couple-level profile info, refreshable after pairing */
  profile: CoupleProfile | null;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue>({
  session: null,
  isLoading: true,
  profile: null,
  refreshProfile: async () => {},
  signOut: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

// ─── Helper: fetch couple profile ────────────────────────────────────────────

async function fetchProfile(userId: string): Promise<CoupleProfile> {
  const { data } = await supabase
    .from("users")
    .select("couple_id, couples(meet_date, relationship_start_date)")
    .eq("id", userId)
    .single();

  if (!data) {
    return {
      coupleId: null,
      meetDate: null,
      relationshipStartDate: null,
      isPaired: false,
      hasDates: false,
    };
  }

  const couple = Array.isArray(data.couples) ? data.couples[0] : data.couples;

  return {
    coupleId: data.couple_id ?? null,
    meetDate: couple?.meet_date ?? null,
    relationshipStartDate: couple?.relationship_start_date ?? null,
    isPaired: !!data.couple_id,
    hasDates: !!(couple?.meet_date && couple?.relationship_start_date),
  };
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState<CoupleProfile | null>(null);

  const refreshProfile = useCallback(async () => {
    const {
      data: { session: currentSession },
    } = await supabase.auth.getSession();
    if (!currentSession?.user) {
      setProfile(null);
      return;
    }
    const p = await fetchProfile(currentSession.user.id);
    setProfile(p);
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  }, []);

  useEffect(() => {
    // Initial session check
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      setSession(s);
      if (s?.user) {
        const p = await fetchProfile(s.user.id);
        setProfile(p);
      }
      setIsLoading(false);
    });

    // Listen for auth changes (login, logout, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, s) => {
      setSession(s);
      if (s?.user) {
        const p = await fetchProfile(s.user.id);
        setProfile(p);
      } else {
        setProfile(null);
      }
      // Ensure loading is cleared after first auth event
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider
      value={{ session, isLoading, profile, refreshProfile, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}
