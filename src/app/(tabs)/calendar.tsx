import { View, Text } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

export default function CalendarScreen() {
  return (
    <LinearGradient colors={["#080811", "#0A0A0C", "#080811"]} style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text style={{ color: "#FFF", fontSize: 24, fontWeight: "bold" }}>Takvim & Anılar</Text>
      <Text style={{ color: "rgba(255,255,255,0.6)", marginTop: 8 }}>Çok Yakında</Text>
    </LinearGradient>
  );
}
