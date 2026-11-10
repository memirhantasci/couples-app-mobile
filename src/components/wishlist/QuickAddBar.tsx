import { useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { ArrowUp, ChevronRight, Crown, NotebookPen } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/context/ThemeContext";
import { useSubmitLock } from "@/hooks/useSubmitLock";
import { TEXT_WHITE } from "@/lib/theme";
import { WISHLIST_TITLE_MAX, type WishlistCategory, type WishlistQuota } from "@/lib/wishlist";
import { CategoryChips } from "./CategoryChips";
import { Collapse } from "./Collapse";
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
  /**
   * "Ayrıntı ekle": yazılmış başlık ve seçili kategoriyle ekleme penceresini açar. Pencere kapanınca çözülür:
   * true (eklendi) ise çubuk sıfırlanır; iptalde (false) çubuktaki yazı ve kategori olduğu gibi kalır.
   */
  onOpenDetails: (draft: { title: string; category: WishlistCategory | null }) => Promise<boolean>;
}

/**
 * Hızlı ekleme çubuğu. Dinlenirken tek satırdır (yazı kutusu + sayaç + gönder); kategori çipleri ve "Ayrıntı ekle"
 * yalnızca kutu odaktayken ya da içinde yazı varken açılır, ikisi de yokken kapanır. Seçili kategori kapanınca da
 * korunur (yeniden yazmaya başlayınca görünür). Sınır dolunca uyarı metni kapalıyken de görünür.
 */
export function QuickAddBar({ quota, locked, onLockedPress, onLimitPress, onSubmit, onOpenDetails }: QuickAddBarProps) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<WishlistCategory | null>(null);
  const [focused, setFocused] = useState(false);
  // Klavyedeki "gönder" ile düğme aynı karede gelebilir: kilit ref tabanlı (useSubmitLock)
  const submit = useSubmitLock();
  const submitting = submit.pending;
  // Pencere açıkken ikinci kez açılmaz (hızlı çift dokunma)
  const detailsOpen = useRef(false);

  const canSend = title.trim().length > 0 && !submitting;
  // Ücretsiz sınır dolunca taç görünür: basmak paywall açar. Premium üst sınırı ayrıca ekranda uyarılır.
  const paywallMode = quota.reached && quota.showCounter;
  // Tek kalanda kutu odaklanamaz: çubuk hep tek satır kalır
  const expanded = !locked && (focused || title.length > 0);

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

  const handleDetails = () => {
    if (locked) return onLockedPress();
    if (paywallMode) return onLimitPress();
    // Hızlı gönderim sürerken açılmaz: aynı başlık hem çubuktan hem pencereden eklenebilirdi
    if (submit.isBusy() || detailsOpen.current) return;
    detailsOpen.current = true;
    void onOpenDetails({ title, category }).then((added) => {
      detailsOpen.current = false;
      if (added) {
        setTitle("");
        setCategory(null);
      }
    });
  };

  // Tek kalanda düğme basılabilir kalır (nedenini anlatır) ama etkin görünmez
  const sendEnabled = locked || paywallMode || canSend;
  const sendActive = !locked && (paywallMode || canSend);

  return (
    <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, ...theme.cardShadow }]}>
      <View style={styles.inputRow}>
        <TouchableOpacity activeOpacity={1} disabled={!locked} onPress={onLockedPress} style={styles.inputWrap}>
          <TextInput
            value={title}
            onChangeText={setTitle}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
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
            <Crown size={19} color={TEXT_WHITE} />
          ) : (
            <ArrowUp size={21} color={sendActive ? TEXT_WHITE : theme.textMuted} />
          )}
        </TouchableOpacity>
      </View>

      <Collapse open={expanded}>
        <View style={[styles.extras, { borderTopColor: theme.cardBorder }]}>
          <CategoryChips value={category} onChange={setCategory} />

          {/* İkincil eylem: dolgu yok (koyu temada parlamaz), vurgu yalnızca ikon karosunda */}
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={
              paywallMode
                ? t("wishlist.quick.limitA11y")
                : `${t("wishlist.quick.details")}, ${t("wishlist.quick.detailsHint")}`
            }
            accessibilityState={{ disabled: submitting }}
            activeOpacity={0.7}
            onPress={handleDetails}
            disabled={submitting}
            style={styles.details}
          >
            <View style={[styles.detailsTile, { backgroundColor: theme.pillAccentBg }]}>
              <NotebookPen size={14} color={theme.accent} />
            </View>
            <Text numberOfLines={2} style={[styles.detailsText, { color: theme.textSecondary }]}>
              <Text style={[styles.detailsLabel, { color: theme.text }]}>{t("wishlist.quick.details")}</Text>
              {"  ·  "}
              {t("wishlist.quick.detailsHint")}
            </Text>
            <ChevronRight size={16} color={theme.textMuted} />
          </TouchableOpacity>
        </View>
      </Collapse>

      {paywallMode ? (
        <TouchableOpacity
          accessibilityRole="button"
          onPress={onLimitPress}
          style={[styles.limitHint, { borderTopColor: theme.cardBorder }]}
          activeOpacity={0.8}
        >
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
    borderRadius: 22,
    borderWidth: 1,
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 6,
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
    minHeight: 44,
    gap: 8,
  },
  input: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 8,
    fontSize: 15,
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
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  extras: {
    marginTop: 6,
    paddingRight: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  details: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 44,
  },
  detailsTile: {
    width: 26,
    height: 26,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  detailsText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 17,
    fontFamily: "Inter_400Regular",
  },
  detailsLabel: {
    fontFamily: "Inter_600SemiBold",
  },
  limitHint: {
    minHeight: 44,
    justifyContent: "center",
    marginTop: 6,
    paddingTop: 8,
    paddingBottom: 4,
    paddingRight: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
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
