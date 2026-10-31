import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Gift, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/context/ThemeContext";
import { PromoCodeForm } from "@/components/profile/PromoCodeForm";

interface PromoCodeModalProps {
  visible: boolean;
  onClose: () => void;
  refreshProfile: () => Promise<unknown>;
  /** Kod premium açtı: çağıran ekran kutlama / kapanışı yönetir. */
  onPremiumSuccess: () => void;
}

/** Paywall'daki "Kodu Kullan" bağlantısının açtığı küçük kod girişi penceresi (Android). */
export function PromoCodeModal({ visible, onClose, refreshProfile, onPremiumSuccess }: PromoCodeModalProps) {
  const { t } = useTranslation();
  const { theme, isLight } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
          style={[
            styles.card,
            {
              backgroundColor: isLight ? "#FFFFFF" : "#13131F",
              borderColor: isLight ? theme.inputBorder : "rgba(255,255,255,0.12)",
            },
          ]}
        >
          <View style={styles.header}>
            <Gift size={18} color={theme.accent} />
            <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
              {t("paywall.redeemCodeTitle")}
            </Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t("a11y.close")}
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.08)" }]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={18} color={theme.textMuted} />
            </TouchableOpacity>
          </View>

          <PromoCodeForm
            theme={theme}
            isLight={isLight}
            refreshProfile={refreshProfile}
            onPremiumSuccess={onPremiumSuccess}
            onTokensAdded={onClose}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 24,
    borderWidth: 1.2,
    padding: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
});
