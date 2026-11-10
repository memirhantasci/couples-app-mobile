import { memo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Check, Heart, MapPin, MoreHorizontal } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/context/ThemeContext";
import { UserAvatar } from "@/components/avatar/UserAvatar";
import { dayjs } from "@/lib/date";
import { TEXT_WHITE } from "@/lib/theme";
import type { WishlistItem } from "@/lib/wishlist";
import { CATEGORY_ICONS, weakFill } from "./wishlistTheme";

export interface WishlistCardPeople {
  userId: string | null;
  myName: string | null | undefined;
  partnerName: string;
  getAvatarUrl: (id: string | null | undefined) => string | null;
}

export interface WishlistCardActions {
  onToggleWant: (item: WishlistItem) => void;
  onToggleDone: (item: WishlistItem) => void;
  onMore: (item: WishlistItem) => void;
}

interface WishlistItemCardProps {
  item: WishlistItem;
  people: WishlistCardPeople;
  actions: WishlistCardActions;
  /** "both": "İkimiz de istiyoruz" bölümünün içinde (açık temada dolu vurgu zemini üzerinde) */
  tone?: "surface" | "both";
}

/**
 * React.memo: eylem ve kişi nesneleri ekranda sabitlenir (useMemo), böylece uzun listelerde (Yaptıklarımız) yalnızca
 * maddesi değişen kart yeniden çizilir.
 */
export const WishlistItemCard = memo(function WishlistItemCard({
  item,
  people,
  actions,
  tone = "surface",
}: WishlistItemCardProps) {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const reduceMotion = useReducedMotion();
  const heartScale = useSharedValue(1);
  const heartStyle = useAnimatedStyle(() => ({ transform: [{ scale: heartScale.get() }] }));

  const { userId } = people;
  const isDone = item.status === "done";
  const isMine = item.created_by === userId;
  const iWant = !!userId && item.wants.includes(userId);
  const partnerId = item.wants.find((id) => id !== userId) ?? null;
  const inBoth = tone === "both";
  const onAccent = inBoth && theme.isLight;

  const titleColor = onAccent ? TEXT_WHITE : theme.text;
  const secondaryColor = onAccent ? "rgba(255,255,255,0.82)" : theme.textSecondary;
  const iconColor = onAccent ? TEXT_WHITE : theme.accent;
  const iconMuted = onAccent ? "rgba(255,255,255,0.82)" : theme.textMuted;
  const Icon = CATEGORY_ICONS[item.category];

  const handleWant = () => {
    if (!reduceMotion) {
      heartScale.set(withSequence(withTiming(1.28, { duration: 120 }), withTiming(1, { duration: 160 })));
    }
    actions.onToggleWant(item);
  };

  const doneDate = item.done_at
    ? dayjs(item.done_at)
        .locale(i18n.language)
        .format(dayjs(item.done_at).isSame(dayjs(), "year") ? "D MMMM" : "D MMMM YYYY")
    : "";

  return (
    <View
      style={[
        styles.card,
        inBoth
          ? { backgroundColor: onAccent ? "rgba(255,255,255,0.14)" : weakFill(theme) }
          : { backgroundColor: theme.cardBg, ...theme.cardShadow },
      ]}
    >
      <View style={styles.topRow}>
        <View style={[styles.tile, { backgroundColor: onAccent ? "rgba(255,255,255,0.22)" : theme.pillAccentBg }]}>
          <Icon size={18} color={iconColor} />
        </View>

        <View style={styles.body}>
          <Text numberOfLines={2} style={[styles.title, { color: titleColor }]}>
            {item.title}
          </Text>
          {item.note ? (
            <Text numberOfLines={1} style={[styles.note, { color: secondaryColor }]}>
              {item.note}
            </Text>
          ) : null}
          {item.location_name ? (
            <View style={styles.locationRow}>
              <MapPin size={12} color={iconMuted} />
              <Text numberOfLines={1} style={[styles.location, { color: secondaryColor }]}>
                {item.location_name}
              </Text>
            </View>
          ) : null}
          {isDone ? (
            <Text numberOfLines={1} style={[styles.doneOn, { color: theme.textMuted }]}>
              {t("wishlist.card.doneOn", { date: doneDate })}
            </Text>
          ) : null}
        </View>

        <TouchableOpacity
          accessibilityRole="checkbox"
          accessibilityState={{ checked: isDone }}
          accessibilityLabel={isDone ? t("wishlist.card.undoDoneA11y") : t("wishlist.card.markDoneA11y")}
          activeOpacity={0.7}
          onPress={() => actions.onToggleDone(item)}
          style={styles.iconButton}
        >
          <View
            style={[
              styles.doneCircle,
              isDone
                ? { backgroundColor: theme.accent, borderColor: theme.accent }
                : { borderColor: onAccent ? "rgba(255,255,255,0.82)" : theme.textMuted },
            ]}
          >
            {isDone ? <Check size={15} color={TEXT_WHITE} strokeWidth={3} /> : null}
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.bottomRow}>
        <View
          accessible
          accessibilityLabel={isMine ? t("wishlist.card.addedByYouA11y") : t("wishlist.card.addedByPartnerA11y")}
        >
          {/* Avatarın kendi zemini saydam: vurgu zemininde harf kaybolmasın diye kart renginde taban */}
          <UserAvatar
            uri={people.getAvatarUrl(item.created_by)}
            name={isMine ? people.myName : people.partnerName}
            size={22}
            borderWidth={1}
            borderColor={onAccent ? TEXT_WHITE : undefined}
            style={[styles.avatarBase, { backgroundColor: theme.cardBg }]}
          />
        </View>

        <View style={styles.spacer} />

        {isMine ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t("wishlist.card.moreA11y")}
            activeOpacity={0.7}
            onPress={() => actions.onMore(item)}
            style={styles.iconButton}
          >
            <MoreHorizontal size={20} color={iconMuted} />
          </TouchableOpacity>
        ) : null}

        {!isDone && partnerId && !inBoth ? (
          <View accessible accessibilityLabel={t("wishlist.card.partnerWantsA11y")} style={styles.partnerWant}>
            <UserAvatar
              uri={people.getAvatarUrl(partnerId)}
              name={people.partnerName}
              size={20}
              borderWidth={1}
              style={[styles.avatarBase, { backgroundColor: theme.cardBg }]}
            />
            <Heart size={13} color={theme.accent} fill={theme.accent} />
          </View>
        ) : null}

        {!isDone ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{ selected: iWant }}
            accessibilityLabel={iWant ? t("wishlist.card.unwantA11y") : t("wishlist.card.wantA11y")}
            activeOpacity={0.7}
            onPress={handleWant}
            style={styles.iconButton}
          >
            <Animated.View style={heartStyle}>
              <Heart
                size={21}
                color={iWant ? iconColor : iconMuted}
                fill={iWant ? iconColor : "transparent"}
              />
            </Animated.View>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    paddingLeft: 14,
    paddingRight: 6,
    paddingTop: 10,
    paddingBottom: 2,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  tile: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  body: {
    flex: 1,
    minWidth: 0,
    gap: 3,
    paddingTop: 2,
  },
  title: {
    fontSize: 15,
    lineHeight: 20,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
  },
  note: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Inter_400Regular",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  location: {
    flexShrink: 1,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: "Inter_400Regular",
  },
  doneOn: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: "Inter_500Medium",
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  doneCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
    paddingLeft: 52,
  },
  spacer: {
    flex: 1,
  },
  avatarBase: {
    borderRadius: 11,
  },
  partnerWant: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginRight: 2,
  },
});
