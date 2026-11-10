import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CheckCircle2, Heart, MapPin, Pencil, Trash2, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/context/ThemeContext";
import { UserAvatar } from "@/components/avatar/UserAvatar";
import { dayjs } from "@/lib/date";
import type { WishlistItem } from "@/lib/wishlist";
import type { WishlistCardPeople } from "./WishlistItemCard";
import { CATEGORY_ICONS, CATEGORY_LABEL_KEYS, scrimColor, weakFill } from "./wishlistTheme";

interface WishlistDetailSheetProps {
  /** Gösterilen madde (listedeki güncel hâli); null olunca pencere kapanır */
  item: WishlistItem | null;
  people: WishlistCardPeople;
  partnerAvatarUrl: string | null;
  /** "İkimiz de" sayılır mı (tek kalanda hiçbir madde sayılmaz: isBothWant) */
  bothWant: boolean;
  onClose: () => void;
  /** Yalnızca ekleyene gösterilir; kapılar ve pencere geçişi ekranın işidir */
  onEdit: (item: WishlistItem) => void;
  onDelete: (item: WishlistItem) => void;
}

/**
 * Karta dokununca açılan ayrıntı penceresi: tam başlık, tam not, konum, kim ekledi ve ne zaman, kim istiyor,
 * yapıldıysa tarihi. Ekleyen için altta "Düzenle" ve "Sil". Kapanırken son madde çizilmeye devam eder:
 * pencere aşağı kayarak kapanır, içi boşalıp bir anda kaybolmaz.
 */
export function WishlistDetailSheet({
  item,
  people,
  partnerAvatarUrl,
  bothWant,
  onClose,
  onEdit,
  onDelete,
}: WishlistDetailSheetProps) {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [shown, setShown] = useState<WishlistItem | null>(item);
  if (item && item !== shown) setShown(item);

  const formatDate = (iso: string) =>
    dayjs(iso)
      .locale(i18n.language)
      .format(dayjs(iso).isSame(dayjs(), "year") ? "D MMMM" : "D MMMM YYYY");

  const body = () => {
    if (!shown) return null;
    const { userId } = people;
    const isMine = shown.created_by === userId;
    const isDone = shown.status === "done";
    const iWant = !!userId && shown.wants.includes(userId);
    const partnerWants = shown.wants.some((id) => id !== userId);
    const Icon = CATEGORY_ICONS[shown.category];
    const danger = theme.isLight ? "#DC2626" : "#ef4444";

    const wantsText = bothWant
      ? t("wishlist.detail.wantsBoth")
      : iWant
        ? t("wishlist.detail.wantsMe")
        : partnerWants
          ? t("wishlist.detail.wantsPartner")
          : t("wishlist.detail.wantsNone");

    return (
      <>
        <View style={styles.headerRow}>
          <View style={[styles.tile, { backgroundColor: theme.pillAccentBg }]}>
            <Icon size={18} color={theme.accent} />
          </View>
          <Text numberOfLines={1} style={[styles.category, { color: theme.textMuted }]}>
            {t(CATEGORY_LABEL_KEYS[shown.category])}
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t("a11y.close")}
            onPress={onClose}
            style={styles.closeTouch}
            activeOpacity={0.7}
          >
            <View style={[styles.closeCircle, { backgroundColor: weakFill(theme) }]}>
              <X size={18} color={theme.textSecondary} />
            </View>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>
            {shown.title}
          </Text>

          {shown.note ? <Text style={[styles.note, { color: theme.textSecondary }]}>{shown.note}</Text> : null}

          {shown.location_name ? (
            <View style={styles.row}>
              <MapPin size={15} color={theme.accent} />
              <Text style={[styles.rowText, { color: theme.text }]}>{shown.location_name}</Text>
            </View>
          ) : null}

          <View style={[styles.facts, { borderTopColor: theme.cardBorder }]}>
            <View style={styles.row}>
              <UserAvatar
                uri={people.getAvatarUrl(shown.created_by)}
                name={isMine ? people.myName : people.partnerName}
                size={22}
                borderWidth={1}
                style={[styles.avatarBase, { backgroundColor: theme.cardBg }]}
              />
              <Text style={[styles.rowText, { color: theme.textSecondary }]}>
                {isMine
                  ? t("wishlist.detail.addedByYou", { date: formatDate(shown.created_at) })
                  : t("wishlist.detail.addedByPartner", { date: formatDate(shown.created_at) })}
              </Text>
            </View>

            {isDone ? (
              <View style={styles.row}>
                <CheckCircle2 size={20} color={theme.accent} />
                <Text style={[styles.rowText, { color: theme.textSecondary }]}>
                  {t("wishlist.card.doneOn", { date: shown.done_at ? formatDate(shown.done_at) : "" })}
                </Text>
              </View>
            ) : (
              <View style={styles.row}>
                {bothWant ? (
                  <View style={styles.pair} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                    <UserAvatar
                      uri={people.getAvatarUrl(userId)}
                      name={people.myName}
                      size={22}
                      borderWidth={1}
                      style={[styles.avatarBase, { backgroundColor: theme.cardBg }]}
                    />
                    <UserAvatar
                      uri={partnerAvatarUrl}
                      name={people.partnerName}
                      size={22}
                      borderWidth={1}
                      style={[styles.avatarBase, styles.pairSecond, { backgroundColor: theme.cardBg }]}
                    />
                  </View>
                ) : (
                  <Heart
                    size={20}
                    color={iWant || partnerWants ? theme.accent : theme.textMuted}
                    fill={iWant || partnerWants ? theme.accent : "transparent"}
                  />
                )}
                <Text style={[styles.rowText, { color: bothWant ? theme.accent : theme.textSecondary }, bothWant && styles.bold]}>
                  {wantsText}
                </Text>
              </View>
            )}
          </View>
        </ScrollView>

        {isMine ? (
          <View style={styles.actions}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t("wishlist.menu.edit")}
              activeOpacity={0.85}
              onPress={() => onEdit(shown)}
              style={[styles.actionBtn, { backgroundColor: theme.pillAccentBg, borderColor: theme.pillAccentBorder }]}
            >
              <Pencil size={16} color={theme.accent} />
              <Text numberOfLines={1} style={[styles.actionText, { color: theme.accent }]}>
                {t("wishlist.menu.edit")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t("wishlist.menu.delete")}
              activeOpacity={0.85}
              onPress={() => onDelete(shown)}
              style={[styles.actionBtn, { backgroundColor: weakFill(theme), borderColor: "transparent" }]}
            >
              <Trash2 size={16} color={danger} />
              <Text numberOfLines={1} style={[styles.actionText, { color: danger }]}>
                {t("wishlist.menu.delete")}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </>
    );
  };

  return (
    <Modal visible={!!item} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.backdrop, { backgroundColor: scrimColor(theme) }]}>
        {/* Örtü sayfanın kardeşi: sayfadaki düğmeler örtünün dokunmasının içinde kalmasın */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessible={false} />
        <View
          style={[styles.sheet, { backgroundColor: theme.cardBg, paddingBottom: insets.bottom + 20, ...theme.cardShadow }]}
        >
          {body()}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: "85%",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  tile: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  category: {
    flex: 1,
    fontSize: 12.5,
    fontFamily: "Inter_600SemiBold",
  },
  closeTouch: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginRight: -6,
  },
  closeCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: {
    flexGrow: 0,
  },
  content: {
    gap: 12,
    paddingTop: 10,
    paddingBottom: 4,
  },
  title: {
    fontSize: 21,
    lineHeight: 27,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
  },
  note: {
    fontSize: 14.5,
    lineHeight: 21,
    fontFamily: "Inter_400Regular",
  },
  facts: {
    gap: 10,
    marginTop: 4,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  rowText: {
    flex: 1,
    fontSize: 13.5,
    lineHeight: 19,
    fontFamily: "Inter_400Regular",
  },
  bold: {
    fontFamily: "Inter_700Bold",
  },
  avatarBase: {
    borderRadius: 11,
  },
  pair: {
    flexDirection: "row",
  },
  pairSecond: {
    marginLeft: -8,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  actionText: {
    flexShrink: 1,
    fontSize: 14.5,
    fontFamily: "Inter_700Bold",
  },
});
