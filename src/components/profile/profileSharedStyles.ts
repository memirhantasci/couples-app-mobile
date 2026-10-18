import { StyleSheet } from "react-native";

/** Styles reused by several profile sections (and by the profile screen itself). */
export const profileSharedStyles = StyleSheet.create({
  inputGroup: {
    marginTop: 12,
    gap: 6,
  },
  fieldLabel: {
    fontSize: 11.5,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.6)",
    letterSpacing: 0.5,
  },
  actionSaveBtn: {
    marginTop: 14,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  actionSaveBtnText: {
    color: "#ffffff",
    fontSize: 14.5,
    fontFamily: "Inter_700Bold",
  },
  sessionHintText: {
    fontSize: 12.5,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.5)",
    lineHeight: 18,
    marginTop: 10,
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    marginTop: 10,
  },
  logoutBtnText: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
});
