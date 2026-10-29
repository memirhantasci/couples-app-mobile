import type { TFunction } from "i18next";

export interface FeatureItem {
  id: string;
  title: string;
  icon: string; // Lucide icon key
  badge?: string;
  description: string;
  tip?: string;
}

export interface PageTourGuide {
  pageKey: string;
  title: string;
  tagline: string;
  icon: string;
  summary: string;
  features: FeatureItem[];
}

// ─── Ana Sayfa Spotlight Turu ────────────────────────────────────────────────
// Ana sayfadaki hedef alanların üzerine ışık tutan kısa tur (yalnızca Ana Sayfa).
export type HomeSpotlightTargetId = "counter" | "shortcuts" | "mood" | "menu";

export interface SpotlightStepContent {
  id: HomeSpotlightTargetId;
  title: string;
  icon: string; // Lucide icon key
  description: string;
}

// Metinler locale dosyalarındadır (guides.*); burada yalnızca yapı (kimlik, ikon) tutulur.
const HOME_SPOTLIGHT_DEFS: readonly { id: HomeSpotlightTargetId; icon: string }[] = [
  { id: "counter", icon: "Heart" },
  { id: "shortcuts", icon: "Mail" },
  { id: "mood", icon: "Sparkles" },
  { id: "menu", icon: "HelpCircle" },
];

/** Spotlight adımları, `t`nin bağlı olduğu dilde çözülür. */
export function getHomeSpotlightSteps(t: TFunction): SpotlightStepContent[] {
  return HOME_SPOTLIGHT_DEFS.map(({ id, icon }) => ({
    id,
    icon,
    title: t(`guides.spotlight.${id}.title` as never),
    description: t(`guides.spotlight.${id}.description` as never),
  }));
}

interface FeatureDef {
  id: string;
  icon: string;
  badge?: true;
  tip?: true;
}

interface PageGuideDef {
  icon: string;
  features: FeatureDef[];
}

const FEATURE_GUIDE_DEFS: Record<string, PageGuideDef> = {
  home: {
    icon: "Home",
    features: [
      { id: "love-counter", icon: "Heart", badge: true, tip: true },
      { id: "love-score", icon: "Flame", badge: true, tip: true },
      { id: "mood-selector", icon: "Sparkles", badge: true, tip: true },
      { id: "daily-note", icon: "BookOpen", badge: true, tip: true },
      { id: "quick-cards", icon: "Clock", badge: true },
    ],
  },
  calendar: {
    icon: "CalendarHeart",
    features: [
      { id: "calendar-view", icon: "Calendar", badge: true },
      { id: "colored-dots", icon: "Sparkles", badge: true, tip: true },
      { id: "add-note", icon: "StickyNote", badge: true },
      { id: "daily-summary", icon: "Clock", badge: true },
    ],
  },
  letters: {
    icon: "Mail",
    features: [
      { id: "time-capsule", icon: "Lock", badge: true, tip: true },
      { id: "origami-ceremony", icon: "Sparkles", badge: true },
      { id: "letter-vault", icon: "Mail", badge: true },
      { id: "tokens", icon: "Coins", badge: true },
    ],
  },
  photos: {
    icon: "Images",
    features: [
      { id: "shared-archive", icon: "Images", badge: true },
      { id: "exif-location", icon: "MapPin", badge: true, tip: true },
      { id: "fullscreen-stories", icon: "Maximize2", badge: true },
    ],
  },
  map: {
    icon: "MapPin",
    features: [
      { id: "photo-pins", icon: "Camera", badge: true },
      { id: "secret-notes", icon: "StickyNote", badge: true, tip: true },
      { id: "themes-filters", icon: "Layers", badge: true },
      { id: "fit-bounds", icon: "Maximize2", badge: true },
    ],
  },
  medicine: {
    icon: "Pill",
    features: [
      { id: "dose-reminders", icon: "Clock", badge: true },
      { id: "partner-care", icon: "Heart", badge: true, tip: true },
      { id: "history-logs", icon: "CheckCircle", badge: true },
    ],
  },
  "period-tracker": {
    icon: "Droplet",
    features: [
      { id: "cycle-prediction", icon: "Calendar", badge: true },
      { id: "symptoms-mood", icon: "Sparkles", badge: true },
      { id: "partner-empathy", icon: "Heart", badge: true, tip: true },
    ],
  },
  meetings: {
    icon: "Clock",
    features: [
      { id: "live-countdown", icon: "Clock", badge: true },
      { id: "meeting-details", icon: "MapPin", badge: true, tip: true },
      { id: "meeting-history", icon: "BookOpen", badge: true },
    ],
  },
  memories: {
    icon: "Sparkles",
    features: [
      { id: "milestone-cards", icon: "Sparkles", badge: true },
      { id: "anniversary-reminders", icon: "Bell", badge: true, tip: true },
    ],
  },
  "daily-notes": {
    icon: "BookOpen",
    features: [
      { id: "encrypted-vault", icon: "ShieldCheck", badge: true, tip: true },
      { id: "daily-reflection", icon: "Heart", badge: true },
    ],
  },
  profile: {
    icon: "Settings",
    features: [
      { id: "tabbar-customizer", icon: "Layers", badge: true, tip: true },
      { id: "theme-options", icon: "Sparkles", badge: true },
      { id: "couple-connection", icon: "ShieldCheck", badge: true },
      { id: "reset-tours", icon: "HelpCircle", badge: true },
    ],
  },
};

/** Rehberi olan sayfa anahtarları (menüdeki sıra ile). */
export const FEATURE_GUIDE_PAGE_KEYS: string[] = Object.keys(FEATURE_GUIDE_DEFS);

/** Sayfa rehberi, `t`nin bağlı olduğu dilde çözülür; rehberi olmayan sayfa için null. */
export function getPageGuide(pageKey: string, t: TFunction): PageTourGuide | null {
  const def = FEATURE_GUIDE_DEFS[pageKey];
  if (!def) return null;
  const base = `guides.pages.${pageKey}`;
  return {
    pageKey,
    title: t(`${base}.title` as never),
    tagline: t(`${base}.tagline` as never),
    icon: def.icon,
    summary: t(`${base}.summary` as never),
    features: def.features.map((f) => {
      const key = `${base}.features.${f.id.replace(/-/g, "_")}`;
      return {
        id: f.id,
        title: t(`${key}.title` as never),
        icon: f.icon,
        badge: f.badge ? t(`${key}.badge` as never) : undefined,
        description: t(`${key}.description` as never),
        tip: f.tip ? t(`${key}.tip` as never) : undefined,
      };
    }),
  };
}

/** Tüm sayfa rehberleri dizisi (	 dilinde). */
export function getAllPageGuides(t: TFunction): PageTourGuide[] {
  return FEATURE_GUIDE_PAGE_KEYS.map((k) => getPageGuide(k, t)!).filter(Boolean);
}
