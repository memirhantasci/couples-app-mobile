import { StyleSheet } from "react-native";

/** Tüm harita pinlerinin altındaki küçük ok (stem). Rengi `borderTopColor` ile verilir. */
export const markerStyles = StyleSheet.create({
  markerStem: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 7,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    marginTop: -1,
    alignSelf: "center",
  },
});
