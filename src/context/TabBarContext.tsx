import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { 
  Home, CalendarHeart, Mail, Images, MapPin, 
  Pill, BookOpen, Clock, Sparkles, Droplet, Settings,
  LucideIcon
} from "lucide-react-native";
import { Alert } from "react-native";

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
  label: string;
  badgeLabel?: string;
  Icon: LucideIcon;
  description: string;
  isMandatory?: boolean;
}

export const ALL_TAB_DEFINITIONS: TabItemDefinition[] = [
  {
    key: "home",
    label: "Ana Sayfa",
    Icon: Home,
    description: "Aşk sayacı, sayaçlar, aşk puanı ve günün özeti",
    isMandatory: true,
  },
  {
    key: "calendar",
    label: "Takvim",
    Icon: CalendarHeart,
    description: "Ortak etkinlikler, aşk takvimi ve özel günler",
  },
  {
    key: "letters",
    label: "Mektuplar",
    Icon: Mail,
    description: "Zaman kilitli aşk mektupları ve sürprizler",
  },
  {
    key: "photos",
    label: "Galeri",
    Icon: Images,
    description: "Ortak fotoğraf arşivi, hatıralar ve albümler",
  },
  {
    key: "map",
    label: "Harita",
    Icon: MapPin,
    description: "Fotoğraflı anı pinleri ve aşk haritası",
  },
  {
    key: "medicine",
    label: "İlaçlar",
    Icon: Pill,
    description: "İlaç hatırlatıcı, doz takibi ve sağlık geçmişi",
  },
  {
    key: "daily-notes",
    label: "Günlük",
    Icon: BookOpen,
    description: "Sana özel, şifreli kişisel not defterin",
  },
  {
    key: "meetings",
    label: "Buluşma",
    Icon: Clock,
    description: "Buluşma geri sayımı ve randevu planlama",
  },
  {
    key: "memories",
    label: "Özel Gün",
    Icon: Sparkles,
    description: "Tanışma ve sevgili olma milatları ve yıl dönümleri",
  },
  {
    key: "period-tracker",
    label: "Döngü",
    Icon: Droplet,
    description: "Kadın regl döngüsü ve semptom takip takvimi",
  },
  {
    key: "profile",
    label: "Ayarlar",
    Icon: Settings,
    description: "Profil, tema ve uygulama yapılandırması",
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
        Alert.alert("Sabit Sekme", "Ana Sayfa alt barda zorunludur ve kaldırılamaz.");
        return false;
      }

      const isCurrentlyEnabled = enabledTabs.includes(key);

      if (isCurrentlyEnabled) {
        if (enabledTabs.length <= MIN_TABS) {
          Alert.alert("Sınır", `Alt barda en az ${MIN_TABS} sekme bulunmalıdır.`);
          return false;
        }

        const newTabs = enabledTabs.filter((t) => t !== key);
        setEnabledTabs(newTabs);
        persistTabs(newTabs);
        return true;
      } else {
        if (enabledTabs.length >= MAX_TABS) {
          Alert.alert(
            "Maksimum Sekme Sınırı",
            `Alt barda en fazla ${MAX_TABS} sekme yer alabilir. Lütfen önce başka bir sekmeyi çıkarın.`
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
