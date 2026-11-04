import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ticket } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { REFERRAL_CODE_PREFIX } from "@/lib/referral";

/** Kutunun çizildiği zemine göre renkler (eşleşme ekranı sabit koyu, davet penceresi temalı) */
export interface ReferralEntryPalette {
  readonly text: string;
  readonly textMuted: string;
  /** Giriş kutusunun dolgusu */
  readonly field: string;
  readonly accent: string;
  readonly error: string;
}

interface ReferralCodeEntryProps {
  readonly value: string;
  readonly onChangeValue: (text: string) => void;
  readonly onSubmit: () => void;
  readonly submitting: boolean;
  readonly error: string | null;
  readonly title: string;
  readonly hint: string;
  readonly palette: ReferralEntryPalette;
}

/** Yazılan kod "SKY-XXXXX" biçiminde görünür; değer ayraçsız tutulur. */
function displayValue(value: string): string {
  return value.length > REFERRAL_CODE_PREFIX.length
    ? `${value.slice(0, REFERRAL_CODE_PREFIX.length)}-${value.slice(REFERRAL_CODE_PREFIX.length)}`
    : value;
}

/** "Bir arkadaşınız mı davet etti?" kod kutusu. Durum `useReferralCodeEntry` kancasındadır. */
export function ReferralCodeEntry({
  value,
  onChangeValue,
  onSubmit,
  submitting,
  error,
  title,
  hint,
  palette,
}: ReferralCodeEntryProps) {
  const { t } = useTranslation();
  const canSubmit = value.length > REFERRAL_CODE_PREFIX.length && !submitting;

  return (
    <View>
      <View style={styles.header}>
        <Ticket size={17} color={palette.accent} />
        <Text style={[styles.title, { color: palette.text }]}>{title}</Text>
      </View>
      <Text style={[styles.hint, { color: palette.textMuted }]}>{hint}</Text>

      <View style={styles.row}>
        <TextInput
          value={displayValue(value)}
          onChangeText={onChangeValue}
          onSubmitEditing={onSubmit}
          placeholder={t("referral.enter.placeholder")}
          placeholderTextColor={palette.textMuted}
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="done"
          accessibilityLabel={title}
          style={[styles.input, { color: palette.text, backgroundColor: palette.field }]}
        />
        <TouchableOpacity
          onPress={onSubmit}
          disabled={!canSubmit}
          activeOpacity={0.85}
          accessibilityRole="button"
          style={[styles.submit, { backgroundColor: palette.accent, opacity: canSubmit ? 1 : 0.45 }]}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.submitText}>{t("referral.enter.submit")}</Text>
          )}
        </TouchableOpacity>
      </View>

      {!!error && <Text style={[styles.error, { color: palette.error }]}>{error}</Text>}

      <Text style={[styles.privacy, { color: palette.textMuted }]}>{t("referral.enter.privacy")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  title: { fontSize: 15, fontFamily: "Inter_700Bold", flexShrink: 1 },
  hint: { fontSize: 12.5, lineHeight: 18, marginBottom: 14 },
  row: { flexDirection: "row", gap: 10 },
  input: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    letterSpacing: 2,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  submit: {
    borderRadius: 14,
    paddingHorizontal: 16,
    minWidth: 104,
    alignItems: "center",
    justifyContent: "center",
  },
  submitText: { color: "#FFFFFF", fontSize: 13.5, fontFamily: "Inter_700Bold" },
  error: { fontSize: 12.5, marginTop: 10, textAlign: "center" },
  privacy: { fontSize: 11, lineHeight: 16, marginTop: 12 },
});
