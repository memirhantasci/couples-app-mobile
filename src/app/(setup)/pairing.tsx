import { View, Text } from "react-native";

// Faz 2'de geliştirilecek — eşleşme kodu girme ekranı
export default function PairingScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: "#080811", alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: "#fff", fontSize: 24 }}>Eşleşme Ekranı</Text>
      <Text style={{ color: "rgba(255,255,255,0.5)", marginTop: 8 }}>Faz 2'de gelecek...</Text>
    </View>
  );
}
