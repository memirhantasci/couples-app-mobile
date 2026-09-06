import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { MapPin } from "lucide-react-native";
import { ScreenBackground } from "@/components/ui/ScreenBackground";

export default function MapScreen() {
  return (
    <ScreenBackground>
      <View style={styles.container}>
        <View style={styles.card}>
          <MapPin size={48} color="#38BDF8" style={{ marginBottom: 14 }} />
          <Text style={styles.title}>Aşk Haritası</Text>
          <Text style={styles.desc}>
            İnteraktif anı haritası mobil cihazlara (iOS / Android) özeldir.
            Web ortamında "Bizim Yıldızımız", Fotoğraflar ve diğer modülleri deneyimleyebilirsiniz.
          </Text>
        </View>
      </View>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "rgba(15, 12, 30, 0.85)",
    borderRadius: 24,
    padding: 28,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  title: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 10,
  },
  desc: {
    color: "rgba(255, 255, 255, 0.65)",
    fontSize: 13.5,
    textAlign: "center",
    lineHeight: 20,
  },
});
