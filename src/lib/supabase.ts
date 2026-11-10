import "react-native-url-polyfill/auto";
import { secureAuthStorage } from "./secureAuthStorage";
import { createClient } from "@supabase/supabase-js";
import { logger } from "@/utils/logger";
import { withLegacyEntityDecoding } from "./legacyEntityFetch";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Değişkenler build'e girmezse createClient modül yüklenirken fırlatır ve uygulama ekrana gelmeden kapanır.
// EAS build'i bu eksikle hiç başlamaz (bkz. app.config.js); yine de böyle bir paket çıkarsa uygulama açılır,
// istekler ağ hatası döner.
if (!supabaseUrl || !supabaseAnonKey) {
  logger.error("[Supabase] EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY tanımlı değil");
}

export const supabase = createClient(
  supabaseUrl || "https://missing-config.invalid",
  supabaseAnonKey || "missing-anon-key",
  {
    auth: {
      storage: secureAuthStorage,
      autoRefreshToken: true,
      persistSession: true,
      // Mobilde false OLMALI — true bırakılırsa deep link akışı bozulur
      detectSessionInUrl: false,
    },
    global: {
      // Eski sürümlerin HTML varlığıyla yazdığı metinler ("Ali&#x27;s") okunurken çözülür (bkz. legacyEntityFetch).
      // Global fetch her çağrıda aranır (supabase-js'in varsayılanı da böyle).
      fetch: withLegacyEntityDecoding((input, init) => fetch(input, init)),
    },
  }
);
