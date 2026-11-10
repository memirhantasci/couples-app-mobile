import { memo } from "react";
import { StyleSheet, Text, TouchableOpacity, View, type AccessibilityActionEvent } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Check, Heart, MapPin } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/context/ThemeContext";
import { UserAvatar } from "@/components/avatar/UserAvatar";
import { dayjs } from "@/lib/date";
import { TEXT_WHITE } from "@/lib/theme";
import type { WishlistItem } from "@/lib/wishlist";
import { CATEGORY_ICONS, CATEGORY_LABEL_KEYS, weakFill } from "./wishlistTheme";

export interface WishlistCardPeople {
  userId: string | null;
  myName: string | null | undefined;
  partnerName: string;
  getAvatarUrl: (id: string | null | undefined) => string | null;
}

export interface WishlistCardActions {
  onToggleWant: (item: WishlistItem) => void;
  onToggleDone: (item: WishlistItem) => void;
  /** Karta dokunma: ayrıntı penceresi (herkes için; düzenle / sil orada, yalnızca ekleyene) */
  onOpen: (item: WishlistItem) => void;
  /** Ekran okuyucu eylemleri (yalnızca ekleyenin kartında): pencereyi açmadan düzenle / sil (kapıları ekran uygular) */
  onEdit: (item: WishlistItem) => void;
  onDelete: (item: WishlistItem) => void;
}

interface WishlistItemCardProps {
  item: WishlistItem;
  people: WishlistCardPeople;
  actions: WishlistCardActions;
  /** "both": "İkimiz de istiyoruz" bölümünün içinde (açık temada dolu vurgu zemini üzerinde) */
  tone?: "surface" | "both";
}

const OWNER_A11Y_ACTIONS = ["activate", "edit", "delete"] as const;

/**
 * Tek sıralı madde kartı: solda "yaptık" dairesi, ortada başlık ve altında tek satır ikincil bilgi (ekleyen,
 * kategori, not, konum), sağda kalp. Ortadaki alana dokunmak ayrıntı penceresini açar (tam not, konum, kim ekledi,
 * kim istiyor; ekleyene düzenle / sil). Ekleyenin kartında ekran okuyucu "Düzenle" ve "Sil"i ayrı eylem olarak da sunar.
 *
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
  // "İkimiz de" bölümünde partnerin isteği bölümün kendisinden belli; başka yerde kalbin üstünde küçük avatar
  const showPartnerWant = !isDone && !!partnerId && !inBoth;

  const titleColor = onAccent ? TEXT_WHITE : isDone ? theme.textSecondary : theme.text;
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

  // İkincil satır tek satırdır: yapıldıysa tarih, varsa not; ikisi de ve konum yoksa kategori adı (boş kalmasın)
  const categoryLabel = t(CATEGORY_LABEL_KEYS[item.category]);
  const metaParts = [isDone ? t("wishlist.card.doneOn", { date: doneDate }) : null, item.note].filter(Boolean);
  const metaText = metaParts.length > 0 ? metaParts.join("  ·  ") : item.location_name ? "" : categoryLabel;
  const addedBy = isMine ? t("wishlist.card.addedByYouA11y") : t("wishlist.card.addedByPartnerA11y");
  const bodyLabel = [item.title, metaText || categoryLabel, item.location_name, addedBy].filter(Boolean).join(", ");

  const onA11yAction = (event: AccessibilityActionEvent) => {
    const name = event.nativeEvent.actionName;
    if (name === "edit") actions.onEdit(item);
    else if (name === "delete") actions.onDelete(item);
    else if (name === "activate") actions.onOpen(item);
  };

  const body = (
    <>
      <Text numberOfLines={2} style={[styles.title, { color: titleColor }]}>
        {item.title}
      </Text>
      <View style={styles.meta}>
        {/* Avatarın kendi zemini saydam: vurgu zemininde harf kaybolmasın diye kart renginde taban */}
        <UserAvatar
          uri={people.getAvatarUrl(item.created_by)}
          name={isMine ? people.myName : people.partnerName}
          size={16}
          borderWidth={1}
          borderColor={onAccent ? TEXT_WHITE : undefined}
          style={[styles.metaAvatar, { backgroundColor: theme.cardBg }]}
        />
        <Icon size={12} color={iconColor} />
        {metaText ? (
          <Text numberOfLines={1} style={[styles.metaText, { color: secondaryColor }]}>
            {metaText}
          </Text>
        ) : null}
        {item.location_name ? (
          <View style={[styles.location, metaText ? styles.locationShared : null]}>
            <MapPin size={11} color={iconMuted} />
            <Text numberOfLines={1} style={[styles.metaText, { color: secondaryColor }]}>
              {item.location_name}
            </Text>
          </View>
        ) : null}
      </View>
    </>
  );

  return (
    <View
      style={[
        styles.card,
        inBoth
          ? { backgroundColor: onAccent ? "rgba(255,255,255,0.14)" : weakFill(theme), borderColor: "transparent" }
          : { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, ...theme.cardShadow },
      ]}
    >
      <TouchableOpacity
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isDone }}
        accessibilityLabel={`${isDone ? t("wishlist.card.undoDoneA11y") : t("wishlist.card.markDoneA11y")}: ${item.title}`}
        activeOpacity={0.7}
        onPress={() => actions.onToggleDone(item)}
        style={styles.sideButton}
      >
        <View
          style={[
            styles.doneCircle,
            isDone
              ? { backgroundColor: onAccent ? TEXT_WHITE : theme.accent, borderColor: onAccent ? TEXT_WHITE : theme.accent }
              : { borderColor: iconMuted },
          ]}
        >
          {isDone ? <Check size={14} color={onAccent ? theme.accent : TEXT_WHITE} strokeWidth={3} /> : null}
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={bodyLabel}
        accessibilityHint={t("wishlist.card.detailsA11y")}
        accessibilityActions={
          isMine
            ? OWNER_A11Y_ACTIONS.map((name) => ({
                name,
                label:
                  name === "edit" ? t("wishlist.menu.edit") : name === "delete" ? t("wishlist.menu.delete") : undefined,
              }))
            : undefined
        }
        onAccessibilityAction={isMine ? onA11yAction : undefined}
        activeOpacity={0.7}
        onPress={() => actions.onOpen(item)}
        style={styles.body}
      >
        {body}
      </TouchableOpacity>

      {!isDone ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{ selected: iWant }}
          accessibilityLabel={[
            iWant ? t("wishlist.card.unwantA11y") : t("wishlist.card.wantA11y"),
            showPartnerWant ? t("wishlist.card.partnerWantsA11y") : null,
          ]
            .filter(Boolean)
            .join(", ")}
          activeOpacity={0.7}
          onPress={handleWant}
          style={styles.sideButton}
        >
          <Animated.View style={heartStyle}>
            <Heart size={21} color={iWant ? iconColor : iconMuted} fill={iWant ? iconColor : "transparent"} />
          </Animated.View>
          {showPartnerWant ? (
            <View pointerEvents="none" style={styles.partnerBadge}>
              <UserAvatar
                uri={people.getAvatarUrl(partnerId)}
                name={people.partnerName}
                size={16}
                borderWidth={1.5}
                borderColor={theme.cardBg}
                style={[styles.metaAvatar, { backgroundColor: theme.cardBg }]}
              />
            </View>
          ) : null}
        </TouchableOpacity>
      ) : (
        <View style={styles.endSpacer} />
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "stretch",
    minHeight: 60,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 4,
  },
  sideButton: {
    width: 44,
    minHeight: 44,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
  },
  doneCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  // Ortadaki dokunma alanı kartın tüm yüksekliğini kaplar: kenar boşluğuna dokunmak da ayrıntıyı açar
  body: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
    gap: 3,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  title: {
    fontSize: 15,
    lineHeight: 20,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
  },
  metaAvatar: {
    borderRadius: 8,
  },
  metaText: {
    flexShrink: 1,
    fontSize: 12.5,
    lineHeight: 17,
    fontFamily: "Inter_400Regular",
  },
  location: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    flexShrink: 1,
    minWidth: 0,
  },
  // Not ve konum birlikteyse konum satırın yarısından fazlasını almaz (not da görünsün)
  locationShared: {
    maxWidth: "50%",
  },
  partnerBadge: {
    position: "absolute",
    right: 6,
    bottom: 6,
  },
  endSpacer: {
    width: 12,
  },
});
