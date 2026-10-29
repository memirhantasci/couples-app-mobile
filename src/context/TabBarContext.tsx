import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from "react";
import { safeStorage as AsyncStorage } from "@/lib/safeStorage";
import { 
  Home, CalendarHeart, Mail, Images, MapPin, 
  Pill, BookOpen, Clock, Sparkles, Droplet, Settings,
  LucideIcon
} from "lucide-react-native";
import { toast } from "@/lib/toast";
import type { ParseKeys } from "i18next";
import { useTranslation } from "react-i18next";

export const TAB_STORAGE_KEY = "@couples_app_bottom_bar_tabs_v1";

export type TabKey =
  | "home"
  | "medicine"
  | "calendar"
  | "map"
  | "letters"
  | "profile"
  | "photos"
  | "daily-notes"
  | "meetings"
  | "memories"
  | "period-tracker";

export interface TabItemDefinition {
  key: TabKey;
  /** Çeviri anahtarı: ekranlar `t(item.labelKey)` ile çevirir */
  labelKey: ParseKeys;
  badgeLabel?: string;
  Icon: LucideIcon;
  descriptionKey: ParseKeys;
  isMandatory?: boolean;
}

export const ALL_TAB_DEFINITIONS: TabItemDefinition[] = [
  {
    key: "home",
    labelKey: "tabs.home.label",
    Icon: Home,
    descriptionKey: "tabs.home.description",
    isMandatory: true,
  },
  {
    key: "calendar",
    labelKey: "tabs.calendar.label",
    Icon: CalendarHeart,
    descriptionKey: "tabs.calendar.description",
  },
  {
    key: "letters",
    labelKey: "tabs.letters.label",
    Icon: Mail,
    descriptionKey: "tabs.letters.description",
  },
  {
    key: "photos",
    labelKey: "tabs.photos.label",
    Icon: Images,
    descriptionKey: "tabs.photos.description",
  },
  {
    key: "map",
    labelKey: "tabs.map.label",
    Icon: MapPin,
    descriptionKey: "tabs.map.description",
  },
  {
    key: "medicine",
    labelKey: "tabs.medicine.label",
    Icon: Pill,
    descriptionKey: "tabs.medicine.description",
  },
  {
    key: "daily-notes",
    labelKey: "tabs.dailyNotes.label",
    Icon: BookOpen,
    descriptionKey: "tabs.dailyNotes.description",
  },
  {
    key: "meetings",
    labelKey: "tabs.meetings.label",
    Icon: Clock,
    descriptionKey: "tabs.meetings.description",
  },
  {
    key: "memories",
    labelKey: "tabs.memories.label",
    Icon: Sparkles,
    descriptionKey: "tabs.memories.description",
  },
  {
    key: "period-tracker",
    labelKey: "tabs.periodTracker.label",
    Icon: Droplet,
    descriptionKey: "tabs.periodTracker.description",
  },
  {
    key: "profile",
    labelKey: "tabs.profile.label",
    Icon: Settings,
    descriptionKey: "tabs.profile.description",
  },
];

export const DEFAULT_TABS: TabKey[] = [
  "home",
  "medicine",
  "calendar",
  "map",
  "letters",
  "profile",
];

interface TabBarContextValue {
  enabledTabs: TabKey[];
  allTabs: TabItemDefinition[];
  isTabEnabled: (key: TabKey) => boolean;
  toggleTab: (key: TabKey) => boolean;
  setTabs: (tabs: TabKey[]) => void;
  resetTabs: () => void;
  maxTabs: number;
  minTabs: number;
}

const TabBarContext = createContext<TabBarContextValue>({
  enabledTabs: DEFAULT_TABS,
  allTabs: ALL_TAB_DEFINITIONS,
  isTabEnabled: () => true,
  toggleTab: () => false,
  setTabs: () => {},
  resetTabs: () => {},
  maxTabs: 6,
  minTabs: 2,
});

const MAX_TABS = 6;
const MIN_TABS = 2;

export function TabBarProvider({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const [enabledTabs, setEnabledTabs] = useState<TabKey[]>(DEFAULT_TABS);
  const [isLoaded, setIsLoaded] = useState(false);

  // AsyncStorage'dan kayıtlı alt bar tercihlerini yükle
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(TAB_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length >= MIN_TABS) {
            // "home" her zaman ilk sırada ve zorunlu olmalı
            const validKeys = parsed.filter((k: any) =>
              ALL_TAB_DEFINITIONS.some((def) => def.key === k)
            ) as TabKey[];

            if (!validKeys.includes("home")) {
              validKeys.unshift("home");
            }

            setEnabledTabs(validKeys.slice(0, MAX_TABS));
          }
        }
      } catch (err) {
        console.error("Failed to load tab bar preferences:", err);
      } finally {
        setIsLoaded(true);
      }
    })();
  }, []);

  const persistTabs = useCallback((tabs: TabKey[]) => {
    AsyncStorage.setItem(TAB_STORAGE_KEY, JSON.stringify(tabs)).catch((err) => {
      console.error("Failed to save tab bar preferences:", err);
    });
  }, []);

  const isTabEnabled = useCallback(
    (key: TabKey) => enabledTabs.includes(key),
    [enabledTabs]
  );

  const toggleTab = useCallback(
    (key: TabKey): boolean => {
      if (key === "home") {
        toast.info(t("tabs.toasts.homeRequired"), { title: t("tabs.toasts.homeRequiredTitle"), emoji: "📌" });
        return false;
      }

      const isCurrentlyEnabled = enabledTabs.includes(key);

      if (isCurrentlyEnabled) {
        if (enabledTabs.length <= MIN_TABS) {
          toast.warning(t("tabs.toasts.minTabs", { min: MIN_TABS }), { title: t("tabs.toasts.limitTitle") });
          return false;
        }

        const newTabs = enabledTabs.filter((t) => t !== key);
        setEnabledTabs(newTabs);
        persistTabs(newTabs);
        return true;
      } else {
        if (enabledTabs.length >= MAX_TABS) {
          toast.warning(
            t("tabs.toasts.maxTabs", { max: MAX_TABS }),
            { title: t("tabs.toasts.maxTabsTitle") }
          );
          return false;
        }

        const newTabs = [...enabledTabs, key];
        setEnabledTabs(newTabs);
        persistTabs(newTabs);
        return true;
      }
    },
    [enabledTabs, persistTabs]
  );

  const setTabs = useCallback(
    (tabs: TabKey[]) => {
      let cleaned = tabs.filter((t) =>
        ALL_TAB_DEFINITIONS.some((def) => def.key === t)
      );
      if (!cleaned.includes("home")) {
        cleaned.unshift("home");
      }
      cleaned = cleaned.slice(0, MAX_TABS);
      setEnabledTabs(cleaned);
      persistTabs(cleaned);
    },
    [persistTabs]
  );

  const resetTabs = useCallback(() => {
    setEnabledTabs(DEFAULT_TABS);
    persistTabs(DEFAULT_TABS);
  }, [persistTabs]);

  const value = useMemo<TabBarContextValue>(
    () => ({
      enabledTabs,
      allTabs: ALL_TAB_DEFINITIONS,
      isTabEnabled,
      toggleTab,
      setTabs,
      resetTabs,
      maxTabs: MAX_TABS,
      minTabs: MIN_TABS,
    }),
    [enabledTabs, isTabEnabled, toggleTab, setTabs, resetTabs]
  );

  return (
    <TabBarContext.Provider value={value}>
      {children}
    </TabBarContext.Provider>
  );
}

export function useTabBar(): TabBarContextValue {
  return useContext(TabBarContext);
}
