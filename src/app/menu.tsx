import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { X, Heart, Settings, FileClock } from "lucide-react-native";

export default function MenuScreen() {
  const router = useRouter();

  return (
    <LinearGradient colors={["#1c1c1e", "#0A0A0C"]} style={{ flex: 1 }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
            <X color="#fff" size={24} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Menü</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <TouchableOpacity style={styles.menuItem} onPress={() => { router.back(); router.push("/memories"); }}>
            <View style={[styles.iconBox, { backgroundColor: "rgba(255,45,85,0.12)" }]}>
              <Heart color="#FF2D55" size={20} />
            </View>
            <Text style={styles.menuText}>Özel Günler</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => { router.back(); /* TODO: route to daily notes history */ }}>
            <View style={[styles.iconBox, { backgroundColor: "rgba(232,0,45,0.12)" }]}>
              <FileClock color="#E8002D" size={20} />
            </View>
            <Text style={styles.menuText}>Geçmiş Günlük Notlar</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => { router.back(); /* TODO: route to settings */ }}>
            <View style={[styles.iconBox, { backgroundColor: "rgba(255,255,255,0.1)" }]}>
              <Settings color="#fff" size={20} />
            </View>
            <Text style={styles.menuText}>Ayarlar</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  closeBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },
  content: {
    padding: 20,
    gap: 12,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.03)",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    gap: 16,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  menuText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  }
});
