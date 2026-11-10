import { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { ArrowUp, Crown } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/context/ThemeContext";
import { useSubmitLock } from "@/hooks/useSubmitLock";
import { TEXT_WHITE } from "@/lib/theme";
import { WISHLIST_TITLE_MAX, type WishlistCategory, type WishlistQuota } from "@/lib/wishlist";
import { CategoryChips } from "./CategoryChips";
import { weakFill } from "./wishlistTheme";

interface QuickAddBarProps {
  quota: WishlistQuota;
  /** Tek kalan: yazı kutusu açılmaz, dokununca neden kapalı olduğu anlatılır */
  locked: boolean;
  onLockedPress: () => void;
  /** Limit dolduğunda gönderme ve ipucu paywall'a gider */
  onLimitPress: () => void;
  /** Eklendiyse true döner; kutu yalnızca o zaman temizlenir */
  onSubmit: (title: string, category: WishlistCategory) => Promise<boolean>;
}

export function QuickAddBar({ quota, locked, onLockedPress, onLimitPress, onSubmit }: QuickAddBarProps) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<WishlistCategory | null>(null);
  // Klavyedeki "gönder" ile düğme aynı karede gelebilir: kilit ref tabanlı (useSubmitLock)
  const submit = useSubmitLock();
  const submitting = submit.pending;

  const canSend = title.trim().length > 0 && !submitting;
  // Ücretsiz sınır dolunca taç görünür: basmak paywall açar. Premium üst sınırı ayrıca ekranda uyarılır.
  const paywallMode = quota.reached && quota.showCounter;

  const handleSend = () => {
    if (locked) return onLockedPress();
    if (paywallMode) return onLimitPress();
    const text = title.trim();
    if (!text) return;
    void submit.run(async () => {
      if (await onSubmit(text, category ?? "other")) {
        setTitle("");
        setCategory(null);
      }
    });
  };

  // Tek kalanda düğme basılabilir kalır (nedenini anlatır) ama etkin görünmez
  const sendEnabled = locked || paywallMode || canSend;
  const sendActive = !locked && (paywallMode || canSend);

  return (
    <View style={[styles.card, { backgroundColor: theme.cardBg, ...theme.cardShadow }]}>
      <View style={styles.inputRow}>
        <TouchableOpacity
          activeOpacity={1}
          disabled={!locked}
          onPress={onLockedPress}
          style={[styles.inputWrap, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}
        >
          <TextInput
            value={title}
            onChangeText={setTitle}
            editable={!locked}
            pointerEvents={locked ? "none" : "auto"}
            maxLength={WISHLIST_TITLE_MAX}
            placeholder={t("wishlist.quick.placeholder")}
            placeholderTextColor={theme.textMuted}
            returnKeyType="send"
            onSubmitEditing={handleSend}
            accessibilityLabel={t("wishlist.quick.placeholder")}
            style={[styles.input, { color: theme.text }]}
          />
          {quota.showCounter ? (
            <Text
              accessibilityLabel={t("wishlist.quick.counterA11y", { used: quota.shownCount, limit: quota.limit })}
              style={[
                styles.counter,
                { color: quota.reached ? theme.accent : theme.textMuted },
                quota.reached && styles.counterReached,
              ]}
            >
              {quota.shownCount}/{quota.limit}
            </Text>
          ) : null}
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={paywallMode ? t("wishlist.quick.limitA11y") : t("wishlist.quick.sendA11y")}
          accessibilityState={{ disabled: !sendEnabled }}
          activeOpacity={0.85}
          onPress={handleSend}
          disabled={!sendEnabled}
          style={[styles.send, { backgroundColor: sendActive ? theme.accent : weakFill(theme) }]}
        >
          {submitting ? (
            <ActivityIndicator size="small" color={TEXT_WHITE} />
          ) : paywallMode ? (
            <Crown size={20} color={TEXT_WHITE} />
          ) : (
            <ArrowUp size={22} color={sendActive ? TEXT_WHITE : theme.textMuted} />
          )}
        </TouchableOpacity>
      </View>

      <CategoryChips value={category} onChange={setCategory} />

      {paywallMode ? (
        <TouchableOpacity accessibilityRole="button" onPress={onLimitPress} style={styles.limitHint} activeOpacity={0.8}>
          <Text style={[styles.limitText, { color: theme.textSecondary }]}>
            {t("wishlist.quick.limitHint", { limit: quota.limit })}{" "}
            <Text style={[styles.limitCta, { color: theme.accent }]}>{t("wishlist.quick.limitCta")}</Text>
          </Text>
          {/* Sınır kişi başına sayılır: önceki eşleşmeden kalan fikirler yalnızca sahibine görünür (bulgu 14) */}
          <Text style={[styles.limitNote, { color: theme.textMuted }]}>{t("wishlist.quick.limitPerPerson")}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    padding: 12,
    gap: 4,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  inputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    gap: 8,
  },
  input: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 10,
    fontSize: 14.5,
    fontFamily: "Inter_400Regular",
  },
  counter: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  counterReached: {
    fontFamily: "Inter_700Bold",
  },
  send: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  limitHint: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  limitText: {
    fontSize: 12.5,
    lineHeight: 18,
    fontFamily: "Inter_400Regular",
  },
  limitCta: {
    fontFamily: "Inter_700Bold",
  },
  limitNote: {
    marginTop: 2,
    fontSize: 11.5,
    lineHeight: 16,
    fontFamily: "Inter_400Regular",
  },
});
