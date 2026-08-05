import { View, Text, TouchableOpacity } from "react-native";
import { useAuth } from "@/context/AuthContext";

export default function HomeScreen() {
  const { session, signOut } = useAuth();

  return (
    <View style={{ flex: 1, backgroundColor: "#080811", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <Text style={{ color: "#fff", fontSize: 32, fontWeight: "800", marginBottom: 8 }}>
        Merhaba! 💑
      </Text>
      <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 15, marginBottom: 40 }}>
        {session?.user?.email}
      </Text>
      <TouchableOpacity
        onPress={signOut}
        style={{ backgroundColor: "rgba(232,0,45,0.2)", paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14 }}
      >
        <Text style={{ color: "#E8002D", fontWeight: "700" }}>Çıkış Yap</Text>
      </TouchableOpacity>
    </View>
  );
}
