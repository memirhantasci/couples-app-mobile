import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from "react";
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
  const { profile } = useAuth();
  const [themeMode, setLocalThemeMode] = useState<ThemeMode>("current");
  const [isLoaded, setIsLoaded] = useState(false);

  // Normalize gender from profile
  const gender: "female" | "male" = useMemo(() => {
    const g = profile?.gender?.toLowerCase();
    if (g === "male" || g === "erkek") return "male";
    return "female";
  }, [profile?.gender]);

  // Load saved theme preference on startup
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (saved === "current" || saved === "dark" || saved === "light") {
          setLocalThemeMode(saved as ThemeMode);
          setGlobalActiveTheme(gender, saved as ThemeMode);
        } else {
          setGlobalActiveTheme(gender, "current");
        }
      } catch {
        // Fallback to default
        setGlobalActiveTheme(gender, "current");
      } finally {
        setIsLoaded(true);
      }
    })();
  }, [gender]);

  // Keep global theme synchronized whenever gender or mode changes
  useEffect(() => {
    setGlobalActiveTheme(gender, themeMode);
  }, [gender, themeMode]);

  // Instant mode setter (0ms, non-blocking)
  const setThemeMode = useCallback(
    (mode: ThemeMode) => {
      // 1. Instant React state update (0ms delay)
      setLocalThemeMode(mode);
      setGlobalActiveTheme(gender, mode);

      // 2. Persist to storage in background (fire-and-forget, never blocks JS thread)
      AsyncStorage.setItem(THEME_STORAGE_KEY, mode).catch((err) => {
        console.error("Failed to save theme mode:", err);
      });
    },
    [gender]
  );

  const activeTheme = useMemo(() => {
    return getTheme(gender, themeMode);
  }, [gender, themeMode]);

  const availableThemes = useMemo(() => {
    return getAvailableThemes(gender);
  }, [gender]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme: activeTheme,
      themeMode,
      setThemeMode,
      gender,
      availableThemes,
      isLight: activeTheme.isLight,
    }),
    [activeTheme, themeMode, setThemeMode, gender, availableThemes]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}
