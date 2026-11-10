import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Dices, MapPin, RefreshCw, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/context/ThemeContext";
import type { WishlistPick } from "@/lib/wishlist";
import { CATEGORY_ICONS, CATEGORY_LABEL_KEYS, scrimColor, weakFill } from "./wishlistTheme";

const ROLL_MS = 650;

interface PickerSheetProps {
  visible: boolean;
  pick: WishlistPick | null;
  /** Her yeni seçimde artar: zar yeniden döner */
  rollId: number;
  onAgain: () => void;
  onClose: () => void;
}

/** 🎲 sonucu: zar kısaca döner, ardından seçilen madde. Hareket azaltılmışsa sonuç doğrudan çıkar. */
export function PickerSheet({ visible, pick, rollId, onAgain, onClose }: PickerSheetProps) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const rotation = useSharedValue(0);
  const [rolling, setRolling] = useState(false);

  useEffect(() => {
    if (!visible || reduceMotion) {
      setRolling(false);
      return;
    }
    setRolling(true);
    rotation.set(0);
    rotation.set(withTiming(540, { duration: ROLL_MS, easing: Easing.out(Easing.cubic) }));
    const timer = setTimeout(() => setRolling(false), ROLL_MS);
    return () => clearTimeout(timer);
  }, [visible, rollId, reduceMotion, rotation]);

  const diceStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.get()}deg` }] }));

  const item = pick?.item ?? null;
  const Icon = item ? CATEGORY_ICONS[item.category] : Dices;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.backdrop, { backgroundColor: scrimColor(theme) }]}>
        {/* Örtü sayfanın kardeşi: sayfadaki düğmeler örtünün dokunmasının içinde kalmasın */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessible={false} />
        <View
          style={[
            styles.sheet,
            { backgroundColor: theme.cardBg, paddingBottom: insets.bottom + 20, ...theme.cardShadow },
          ]}
        >
          <View style={styles.headerRow}>
            <Text numberOfLines={1} style={[styles.heading, { color: theme.textMuted }]}>
              {t("wishlist.pick.sheetTitle")}
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

          {rolling || !item ? (
            <View style={styles.rollingBox} accessibilityLiveRegion="polite" accessibilityLabel={t("wishlist.pick.rolling")}>
              <Animated.View style={diceStyle}>
                <Dices size={52} color={theme.accent} />
              </Animated.View>
            </View>
          ) : (
            <View style={styles.result} accessibilityLiveRegion="polite">
              <View style={[styles.tile, { backgroundColor: theme.pillAccentBg }]}>
                <Icon size={26} color={theme.accent} />
              </View>
              <Text style={[styles.category, { color: theme.textMuted }]} numberOfLines={1}>
                {t(CATEGORY_LABEL_KEYS[item.category])}
              </Text>
              <Text style={[styles.title, { color: theme.text }]} numberOfLines={3}>
                {item.title}
              </Text>
              {item.note ? (
                <Text style={[styles.note, { color: theme.textSecondary }]} numberOfLines={3}>
                  {item.note}
                </Text>
              ) : null}
              {item.location_name ? (
                <View style={styles.locationRow}>
                  <MapPin size={13} color={theme.textMuted} />
                  <Text style={[styles.location, { color: theme.textSecondary }]} numberOfLines={1}>
                    {item.location_name}
                  </Text>
                </View>
              ) : null}
              <View style={[styles.sourcePill, { backgroundColor: theme.pillAccentBg, borderColor: theme.pillAccentBorder }]}>
                <Text style={[styles.sourceText, { color: theme.accent }]} numberOfLines={1}>
                  {pick?.source === "both" ? t("wishlist.pick.sourceBoth") : t("wishlist.pick.sourceAll")}
                </Text>
              </View>
            </View>
          )}

          {pick && pick.poolSize > 1 ? (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t("wishlist.pick.again")}
              onPress={onAgain}
              disabled={rolling}
              activeOpacity={0.85}
              style={[
                styles.againBtn,
                { backgroundColor: theme.pillAccentBg, borderColor: theme.pillAccentBorder },
                rolling && styles.againDisabled,
              ]}
            >
              <RefreshCw size={16} color={theme.accent} />
              <Text style={[styles.againText, { color: theme.accent }]} numberOfLines={1}>
                {t("wishlist.pick.again")}
              </Text>
            </TouchableOpacity>
          ) : null}
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
    gap: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heading: {
    flex: 1,
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.8,
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
  rollingBox: {
    height: 190,
    alignItems: "center",
    justifyContent: "center",
  },
  result: {
    minHeight: 190,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  tile: {
    width: 56,
    height: 56,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  category: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  title: {
    fontSize: 21,
    lineHeight: 27,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
    textAlign: "center",
  },
  note: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    maxWidth: "100%",
  },
  location: {
    flexShrink: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  sourcePill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 4,
  },
  sourceText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  againBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 50,
    borderRadius: 18,
    borderWidth: 1,
  },
  againDisabled: {
    opacity: 0.5,
  },
  againText: {
    fontSize: 14.5,
    fontFamily: "Inter_700Bold",
  },
});
