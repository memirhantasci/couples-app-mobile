import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { X, Heart, Settings, FileClock, Home, Pill, CalendarHeart, Mail, Activity, Image as ImageIcon, UploadCloud, LogOut, BookOpen } from "lucide-react-native";
import { useAuth } from "@/context/AuthContext";

export default function MenuScreen() {
  const router = useRouter();
  const { signOut } = useAuth();

  const handleRoute = (path: string) => {
    router.back();
    setTimeout(() => {
      router.push(path as any);
    }, 100);
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace("/(auth)/login" as any);
  };

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
          <TouchableOpacity style={styles.menuItem} onPress={() => handleRoute("/(tabs)/home")}>
            <Home color="#fff" size={20} />
            <Text style={styles.menuText}>Ana Sayfa</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => handleRoute("/(tabs)/medicine")}>
            <Pill color="#fff" size={20} />
            <Text style={styles.menuText}>İlaçlar</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => handleRoute("/(tabs)/memories")}>
            <Heart color="#fff" size={20} />
            <Text style={styles.menuText}>Özel Günler</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => handleRoute("/(tabs)/calendar")}>
            <CalendarHeart color="#fff" size={20} />
            <Text style={styles.menuText}>Takvim</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => handleRoute("/(tabs)/daily-notes")}>
            <BookOpen color="#fff" size={20} />
            <Text style={styles.menuText}>Günlüğüm</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => handleRoute("/(tabs)/letters")}>
            <Mail color="#fff" size={20} />
            <Text style={styles.menuText}>Mektuplar</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => handleRoute("/(tabs)/period-tracker")}>
            <Activity color="#fff" size={20} />
            <Text style={styles.menuText}>Regl Takvimi</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => handleRoute("/(tabs)/meetings")}>
            <CalendarHeart color="#fff" size={20} />
            <Text style={styles.menuText}>Buluşmalar</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => handleRoute("/(tabs)/photos")}>
            <ImageIcon color="#fff" size={20} />
            <Text style={styles.menuText}>Fotoğraflar</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => handleRoute("/(tabs)/add-photo")}>
            <UploadCloud color="#fff" size={20} />
            <Text style={styles.menuText}>Fotoğraf Yükle</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={handleSignOut}>
            <LogOut color="#E8002D" size={20} />
            <Text style={[styles.menuText, { color: "#E8002D" }]}>Çıkış Yap</Text>
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
