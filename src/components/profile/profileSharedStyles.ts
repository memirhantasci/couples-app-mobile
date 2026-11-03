import { StyleSheet } from "react-native";

/**
 * Styles reused by several profile sections (and by the profile screen itself).
 * Renk içermez: metin renkleri çağıranda temadan gelir (`theme.textSecondary` / `theme.textMuted`),
 * böylece sabit beyaz tonlar açık temada görünmez kalmaz.
 */
export const profileSharedStyles = StyleSheet.create({
  // Açılır kartın içeriği `gap: 16` ile aralanır; alan grubu kendi içinde etiket-alan boşluğunu tutar
  inputGroup: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 12.5,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: -0.1,
  },
  sessionHintText: {
    fontSize: 12.5,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
});
