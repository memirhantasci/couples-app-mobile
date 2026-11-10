import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { type LucideIcon } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/context/ThemeContext";
import { WISHLIST_CATEGORIES, type WishlistCategory } from "@/lib/wishlist";
import { CATEGORY_ICONS, CATEGORY_LABEL_KEYS, weakFill } from "./wishlistTheme";

/** Seçim çipi (ekleme çubuğu ve pencere): ikonlu, seçilince vurgu tonlu. Dokunma alanı 44, görünen hap daha ince. */
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

/**
 * Filtre çipi: ekranın tek kalıcı çip sırası. Seçim çiplerinden bilerek ayrışır: ikonsuz, daha küçük, vurgu rengi
 * yok. Seçili olan kart yüzeyinde (bölümlü düğme gibi) durur; vurgu rengi "İkimiz de istiyoruz"a kalır.
 */
function FilterChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { theme } = useTheme();
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      activeOpacity={0.7}
      onPress={onPress}
      style={styles.touch}
    >
      <View
        style={[
          styles.filterPill,
          selected
            ? { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }
            : { backgroundColor: "transparent", borderColor: "transparent" },
        ]}
      >
        <Text
          numberOfLines={1}
          style={[
            styles.filterLabel,
            { color: selected ? theme.text : theme.textSecondary },
            selected && styles.labelSelected,
          ]}
        >
          {label}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

/** Yatay kayan kategori seçici (ekleme çubuğu ve pencere). Seçili çipe yeniden dokunmak seçimi kaldırır. */
export function CategoryChips({
  value,
  onChange,
}: {
  value: WishlistCategory | null;
  onChange: (category: WishlistCategory | null) => void;
}) {
  const { t } = useTranslation();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.row}
    >
      {WISHLIST_CATEGORIES.map((category) => (
        <CategoryChip
          key={category}
          icon={CATEGORY_ICONS[category]}
          label={t(CATEGORY_LABEL_KEYS[category])}
          selected={value === category}
          onPress={() => onChange(value === category ? null : category)}
        />
      ))}
    </ScrollView>
  );
}

/**
 * Liste filtresi: başta "Tümü" (null). Seçili kategoriye yeniden dokunmak bir şey değiştirmez.
 * `inset`: sıra ekran kenarına kadar kayar, ilk ve son çip bu kadar içeriden başlar (ekranın yatay boşluğu).
 */
export function CategoryFilter({
  value,
  onChange,
  inset = 0,
}: {
  value: WishlistCategory | null;
  onChange: (category: WishlistCategory | null) => void;
  inset?: number;
}) {
  const { t } = useTranslation();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      style={inset ? { marginHorizontal: -inset } : undefined}
      contentContainerStyle={[styles.filterRow, { paddingHorizontal: inset }]}
    >
      <FilterChip label={t("wishlist.categories.all")} selected={value === null} onPress={() => onChange(null)} />
      {WISHLIST_CATEGORIES.map((category) => (
        <FilterChip
          key={category}
          label={t(CATEGORY_LABEL_KEYS[category])}
          selected={value === category}
          onPress={() => onChange(category)}
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
  filterRow: {
    gap: 2,
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
  filterPill: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  filterLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
});
