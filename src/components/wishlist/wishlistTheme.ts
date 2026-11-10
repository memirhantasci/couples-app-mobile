import { Clapperboard, MapPin, Plane, Sparkles, Star, UtensilsCrossed, type LucideIcon } from "lucide-react-native";
import type { AppTheme } from "@/lib/theme";
import type { WishlistCategory } from "@/lib/wishlist";

/** Kategoriler renkle değil ikonla ayrılır: 6 renk 6 temayla çatışırdı. */
export const CATEGORY_ICONS: Record<WishlistCategory, LucideIcon> = {
  place: MapPin,
  film: Clapperboard,
  food: UtensilsCrossed,
  experience: Sparkles,
  travel: Plane,
  other: Star,
};

export const CATEGORY_LABEL_KEYS = {
  place: "wishlist.categories.place",
  film: "wishlist.categories.film",
  food: "wishlist.categories.food",
  experience: "wishlist.categories.experience",
  travel: "wishlist.categories.travel",
  other: "wishlist.categories.other",
} as const satisfies Record<WishlistCategory, string>;

export function weakFill(theme: AppTheme): string {
  return theme.isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.05)";
}

/** Alt sayfaların arka örtüsü: temanın kendi zemin tonundan türer. */
export function scrimColor(theme: AppTheme): string {
  return `${theme.bgGradient[1]}D9`;
}
