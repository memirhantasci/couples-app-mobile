import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from "react";
import { Platform } from "react-native";
import * as SystemUI from "expo-system-ui";
import { safeStorage as AsyncStorage } from "@/lib/safeStorage";
import { useAuth } from "@/context/AuthContext";
import {
  AppTheme,
  ThemeMode,
  getTheme,
  getAvailableThemes,
  setGlobalActiveTheme,
  FEMALE_CURRENT,
} from "@/lib/theme";

const THEME_STORAGE_KEY = "@couples_app_theme_mode";

/** Demo (misafir) oturumunun her açılışta başladığı tema: kadın modu, romantik gül teması. */
const DEMO_DEFAULT_MODE: ThemeMode = "current";

interface ThemeContextValue {
  theme: AppTheme;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  gender: "female" | "male";
  availableThemes: readonly AppTheme[];
  isLight: boolean;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: FEMALE_CURRENT,
  themeMode: "current",
  setThemeMode: () => {},
  gender: "female",
  availableThemes: getAvailableThemes("female"),
  isLight: false,
});

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { profile, isDemoMode } = useAuth();
  const [themeMode, setLocalThemeMode] = useState<ThemeMode>("current");
  // Demo oturumunun temasını gerçek hesabın kayıtlı tercihinden ayrı tutar: demo her açıldığında
  // (daha önce kayıtlı açık/koyu mod ya da erkek mavisi ne olursa olsun) pembe varsayılanla başlar.
  const [demoTheme, setDemoTheme] = useState<{ active: boolean; mode: ThemeMode }>({
    active: false,
    mode: DEMO_DEFAULT_MODE,
  });
  if (demoTheme.active !== isDemoMode) {
    // Render sırasında kendi state'ini güncellemek React'in önerdiği "prop değişince sıfırla" kalıbıdır
    setDemoTheme({ active: isDemoMode, mode: DEMO_DEFAULT_MODE });
  }

  // Normalize gender from profile
  const profileGender: "female" | "male" = useMemo(() => {
    const g = profile?.gender?.toLowerCase();
    if (g === "male" || g === "erkek") return "male";
    return "female";
  }, [profile?.gender]);

  const gender: "female" | "male" = isDemoMode ? "female" : profileGender;
  const activeMode: ThemeMode = isDemoMode ? demoTheme.mode : themeMode;

  // Load saved theme preference on startup (gerçek hesap tercihi; demo bunu okumaz/yazmaz)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (alive && (saved === "current" || saved === "dark" || saved === "light")) {
          setLocalThemeMode(saved as ThemeMode);
        }
      } catch {
        // Fallback to default
      }
    })();
    return () => {
      alive = false;
    };
  }, [profileGender]);

  // Keep global theme synchronized whenever gender or mode changes
  useEffect(() => {
    setGlobalActiveTheme(gender, activeMode);
    if (Platform.OS !== "web") {
      const current = getTheme(gender, activeMode);
      SystemUI.setBackgroundColorAsync(current.bgGradient[0]).catch(() => {});
    }
  }, [gender, activeMode]);

  // Instant mode setter (0ms, non-blocking)
  const setThemeMode = useCallback(
    (mode: ThemeMode) => {
      if (isDemoMode) {
        // Demoda seçilen tema yalnızca bu oturum içindir; gerçek hesabın tercihine yazılmaz
        setDemoTheme((prev) => ({ ...prev, mode }));
        setGlobalActiveTheme(gender, mode);
        return;
      }

      // 1. Instant React state update (0ms delay)
      setLocalThemeMode(mode);
      setGlobalActiveTheme(gender, mode);

      // 2. Persist to storage in background (fire-and-forget, never blocks JS thread)
      AsyncStorage.setItem(THEME_STORAGE_KEY, mode).catch((err) => {
        console.error("Failed to save theme mode:", err);
      });
    },
    [gender, isDemoMode]
  );

  const activeTheme = useMemo(() => {
    return getTheme(gender, activeMode);
  }, [gender, activeMode]);

  const availableThemes = useMemo(() => {
    return getAvailableThemes(gender);
  }, [gender]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme: activeTheme,
      themeMode: activeMode,
      setThemeMode,
      gender,
      availableThemes,
      isLight: activeTheme.isLight,
    }),
    [activeTheme, activeMode, setThemeMode, gender, availableThemes]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}
