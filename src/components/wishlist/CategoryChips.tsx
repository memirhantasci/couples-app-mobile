import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LayoutGrid, type LucideIcon } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/context/ThemeContext";
import { WISHLIST_CATEGORIES, type WishlistCategory } from "@/lib/wishlist";
import { CATEGORY_ICONS, CATEGORY_LABEL_KEYS, weakFill } from "./wishlistTheme";

/** Dokunma alanı 44 yüksekliğinde; görünen hap içeride daha ince durur. */
export function CategoryChip({
  icon: Icon,
  label,
  selected,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      activeOpacity={0.8}
      onPress={onPress}
      style={styles.touch}
    >
      <View
        style={[
          styles.pill,
          selected
            ? { backgroundColor: theme.pillAccentBg, borderColor: theme.pillAccentBorder }
            : { backgroundColor: weakFill(theme), borderColor: "transparent" },
        ]}
      >
        <Icon size={14} color={selected ? theme.accent : theme.textSecondary} />
        <Text
          numberOfLines={1}
          style={[
            styles.label,
            { color: selected ? theme.accent : theme.textSecondary },
            selected && styles.labelSelected,
          ]}
        >
          {label}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

/** Yatay kayan kategori seçici. `includeAll` verilirse başta "Tümü" olur ve null onu ifade eder. */
export function CategoryChips({
  value,
  onChange,
  includeAll = false,
}: {
  value: WishlistCategory | null;
  onChange: (category: WishlistCategory | null) => void;
  includeAll?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.row}
    >
      {includeAll ? (
        <CategoryChip
          icon={LayoutGrid}
          label={t("wishlist.categories.all")}
          selected={value === null}
          onPress={() => onChange(null)}
        />
      ) : null}
      {WISHLIST_CATEGORIES.map((category) => (
        <CategoryChip
          key={category}
          icon={CATEGORY_ICONS[category]}
          label={t(CATEGORY_LABEL_KEYS[category])}
          selected={value === category}
          // Filtre dışında (hızlı ekleme) seçili çipe yeniden dokunmak seçimi kaldırır
          onPress={() => onChange(!includeAll && value === category ? null : category)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: 8,
    alignItems: "center",
  },
  touch: {
    minHeight: 44,
    justifyContent: "center",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  label: {
    fontSize: 12.5,
    fontFamily: "Inter_500Medium",
  },
  labelSelected: {
    fontFamily: "Inter_700Bold",
  },
});
