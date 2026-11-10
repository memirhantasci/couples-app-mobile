import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Plus } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/context/ThemeContext";
import { useSubmitLock } from "@/hooks/useSubmitLock";
import { getWishlistIdeas, type WishlistIdea } from "@/lib/wishlistIdeas";
import { CATEGORY_ICONS, weakFill } from "./wishlistTheme";

/**
 * Boş listede dokununca eklenen hazır fikirler. Bir ekleme sürerken çiplerin hepsi pasiftir: hızlı çift dokunma
 * aynı fikri iki kez eklemez (kilit ref tabanlı, useSubmitLock).
 */
export function WishlistIdeas({ onPick }: { onPick: (idea: WishlistIdea) => Promise<unknown> }) {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const submit = useSubmitLock();

  return (
    <View style={styles.block}>
      <Text style={[styles.label, { color: theme.textMuted }]}>{t("wishlist.empty.ideasLabel")}</Text>
      <View style={styles.wrap}>
        {getWishlistIdeas(i18n.language).map((idea) => {
          const Icon = CATEGORY_ICONS[idea.category];
          return (
            <TouchableOpacity
              key={idea.key}
              accessibilityRole="button"
              accessibilityLabel={t("wishlist.empty.addIdeaA11y", { title: idea.title })}
              accessibilityState={{ disabled: submit.pending, busy: submit.pending }}
              activeOpacity={0.8}
              disabled={submit.pending}
              onPress={() => void submit.run(() => onPick(idea))}
              style={[styles.chip, { backgroundColor: weakFill(theme) }, submit.pending && styles.chipPending]}
            >
              <Icon size={14} color={theme.accent} />
              <Text style={[styles.chipText, { color: theme.text }]} numberOfLines={2}>
                {idea.title}
              </Text>
              <Plus size={14} color={theme.textMuted} />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: 10,
  },
  label: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.8,
    marginLeft: 4,
  },
  wrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 44,
    maxWidth: "100%",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
  chipPending: {
    opacity: 0.5,
  },
  chipText: {
    flexShrink: 1,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
});
