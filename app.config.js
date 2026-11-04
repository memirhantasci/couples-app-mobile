// EAS sunucusunda build alınırken eksik değişken, uygulamayı açılışta (Supabase) ya da harita ekranında
// (Android'de anahtarsız Google Maps) kapatır. Build bu durumda hiç başlamaz; yerel geliştirmeye dokunulmaz.
function assertBuildEnv(names) {
  if (process.env.EAS_BUILD !== "true") return;
  const missing = names.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Eksik ortam değişkeni (EAS environment): ${missing.join(", ")}`);
  }
}

export default ({ config }) => {
  assertBuildEnv(["EXPO_PUBLIC_SUPABASE_URL", "EXPO_PUBLIC_SUPABASE_ANON_KEY"]);

  const androidMapsKey =
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID ||
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
    config.android?.config?.googleMaps?.apiKey;
  if (process.env.EAS_BUILD === "true" && process.env.EAS_BUILD_PLATFORM === "android" && !androidMapsKey) {
    throw new Error("Eksik ortam değişkeni (EAS environment): EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID");
  }

  return {
    ...config,
    android: {
      ...config.android,
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON || config.android?.googleServicesFile,
      config: {
        ...config.android?.config,
        googleMaps: {
          ...config.android?.config?.googleMaps,
          // Değişken yoksa app.json'daki anahtar kalır (eskiden undefined ile eziliyordu)
          apiKey: androidMapsKey,
        }
      }
    },
    extra: {
      ...config.extra,
    }
  };
};
