import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
  session: { user: { id: string } } | null;
  isLoading: boolean;
  profile: CoupleProfile | null;
  refreshProfile: () => Promise<void>;
  signIn: (userId: string) => Promise<void>;
  signOut: () => Promise<void>;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue>({
  session: null,
  isLoading: true,
  profile: null,
  refreshProfile: async () => {},
  signIn: async () => {},
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
  const [session, setSession] = useState<{ user: { id: string } } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState<CoupleProfile | null>(null);

  useEffect(() => {
    // Initial session check from AsyncStorage
    AsyncStorage.getItem("custom_session_userid").then(async (userId) => {
      if (userId && userId !== "undefined") {
        setSession({ user: { id: userId } });
        const p = await fetchProfile(userId);
        setProfile(p);
      } else {
        await AsyncStorage.removeItem("custom_session_userid");
      }
      setIsLoading(false);
    });
  }, []);

  const refreshProfile = useCallback(async () => {
    const userId = await AsyncStorage.getItem("custom_session_userid");
    if (!userId || userId === "undefined") {
      setProfile(null);
      return;
    }
    const p = await fetchProfile(userId);
    setProfile(p);
  }, []);

  const signIn = useCallback(async (userId: string) => {
    if (!userId || userId === "undefined") return;
    await AsyncStorage.setItem("custom_session_userid", userId);
    setSession({ user: { id: userId } });
    const p = await fetchProfile(userId);
    setProfile(p);
  }, []);

  const signOut = useCallback(async () => {
    await AsyncStorage.removeItem("custom_session_userid");
    setSession(null);
    setProfile(null);
  }, []);

  useEffect(() => {
    // Initial session check from AsyncStorage
    AsyncStorage.getItem("custom_session_userid").then(async (userId) => {
      if (userId && userId !== "undefined" && userId.trim() !== "") {
        setSession({ user: { id: userId } });
        const p = await fetchProfile(userId);
        setProfile(p);
      } else if (userId === "undefined") {
        await AsyncStorage.removeItem("custom_session_userid");
      }
      setIsLoading(false);
    });
  }, []);

  return (
    <AuthContext.Provider
      value={{ session, isLoading, profile, refreshProfile, signIn, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}
