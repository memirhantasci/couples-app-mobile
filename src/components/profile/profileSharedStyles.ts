import { StyleSheet } from "react-native";

/** Styles reused by several profile sections (and by the profile screen itself). */
export const profileSharedStyles = StyleSheet.create({
  // Açılır kartın içeriği `gap: 16` ile aralanır; alan grubu kendi içinde etiket-alan boşluğunu tutar
  inputGroup: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 12.5,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.6)",
    letterSpacing: -0.1,
  },
  actionSaveBtn: {
    height: 50,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  actionSaveBtnText: {
    color: "#ffffff",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.2,
  },
  sessionHintText: {
    fontSize: 12.5,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.5)",
    lineHeight: 18,
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 16,
  },
  logoutBtnText: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
});
