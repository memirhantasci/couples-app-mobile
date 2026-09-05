import "react-native-url-polyfill/auto";
import { safeStorage } from "./safeStorage";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: safeStorage,
    autoRefreshToken: true,
    persistSession: true,
    // Mobilde false OLMALI — true bırakılırsa deep link akışı bozulur
    detectSessionInUrl: false,
  },
});
