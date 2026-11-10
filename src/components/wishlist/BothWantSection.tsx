import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Heart } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/context/ThemeContext";
import { UserAvatar } from "@/components/avatar/UserAvatar";
import { Pulse } from "@/components/ui/Pulse";
import { TEXT_WHITE } from "@/lib/theme";
import type { WishlistItem } from "@/lib/wishlist";
import { WishlistItemCard, type WishlistCardActions, type WishlistCardPeople } from "./WishlistItemCard";

interface BothWantSectionProps {
  items: WishlistItem[];
  people: WishlistCardPeople;
  partnerAvatarUrl: string | null;
  actions: WishlistCardActions;
}

/**
 * Ekranın imza bölümü. Açık temada ActionCard gibi dolu vurgu + üst parlama; koyu temada dolgu yerine
 * yumuşak vurgu zemini (parlak dolu zemin koyu temada neon gibi parlıyordu).
 */
export function BothWantSection({ items, people, partnerAvatarUrl, actions }: BothWantSectionProps) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  if (items.length === 0) return null;

  const filled = theme.isLight;
  const titleColor = filled ? TEXT_WHITE : theme.text;
  const subtitleColor = filled ? "rgba(255,255,255,0.82)" : theme.textSecondary;
  const heartColor = filled ? TEXT_WHITE : theme.accent;

  return (
    <View
      style={[
        styles.card,
        filled
          ? { backgroundColor: theme.accent, shadowColor: theme.accent, shadowOpacity: 0.28, elevation: 6 }
          : { backgroundColor: theme.pillAccentBg, borderColor: theme.pillAccentBorder, borderWidth: 1 },
      ]}
    >
      {filled ? (
        <LinearGradient
          pointerEvents="none"
          colors={["rgba(255,255,255,0.22)", "rgba(255,255,255,0)"]}
          style={styles.glow}
        />
      ) : null}

      <View style={styles.header}>
        <View style={styles.avatars} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <UserAvatar
            uri={people.getAvatarUrl(people.userId)}
            name={people.myName}
            size={32}
            borderColor={filled ? TEXT_WHITE : undefined}
            style={[styles.avatarBase, { backgroundColor: theme.cardBg }]}
          />
          <UserAvatar
            uri={partnerAvatarUrl}
            name={people.partnerName}
            size={32}
            borderColor={filled ? TEXT_WHITE : undefined}
            style={[styles.avatarBase, styles.secondAvatar, { backgroundColor: theme.cardBg }]}
          />
          <View style={styles.badge}>
            <Pulse scale={1.14} period={2000}>
              <Heart size={16} color={heartColor} fill={heartColor} />
            </Pulse>
          </View>
        </View>

        <View style={styles.headerText}>
          <Text numberOfLines={1} style={[styles.title, { color: titleColor }]}>
            {t("wishlist.both.title")}
          </Text>
          <Text numberOfLines={1} style={[styles.subtitle, { color: subtitleColor }]}>
            {t("wishlist.both.subtitle", { count: items.length })}
          </Text>
        </View>
      </View>

      <View style={styles.list}>
        {items.map((item) => (
          <WishlistItemCard key={item.id} item={item} people={people} actions={actions} tone="both" />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 26,
    padding: 14,
    gap: 12,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
  },
  glow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatars: {
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 14,
  },
  // Avatarın kendi zemini saydam: üst üste binince ve vurgu zemininde harf okunsun diye kart renginde taban
  avatarBase: {
    borderRadius: 16,
  },
  secondAvatar: {
    marginLeft: -10,
  },
  badge: {
    position: "absolute",
    right: 0,
    bottom: -4,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  title: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12.5,
    fontFamily: "Inter_400Regular",
  },
  list: {
    gap: 8,
  },
});
