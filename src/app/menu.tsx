import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { ScreenBackground } from "@/components/ui/ScreenBackground";
import { useRouter } from "expo-router";
import { X, Heart, Settings, Home, Pill, CalendarHeart, Droplet, MapPin, LogOut, ChevronRight, User, BookOpen, Mail, Image as ImageIcon, Camera } from "lucide-react-native";
import { useAuth } from "@/context/AuthContext";
import { getTheme } from "@/lib/theme";
import { decrypt } from "@/utils/crypto";
import { dayjs, daysSince } from "@/lib/date";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";

export default function MenuScreen() {
  const router = useRouter();
  const { profile, session, signOut } = useAuth();

  const handleRoute = (path: string) => {
    router.back();
    setTimeout(() => {
      router.push(path as any);
    }, 100);
  };

  const handleSignOut = async () => {
    router.replace("/(auth)/login" as any);
    setTimeout(() => {
      signOut();
    }, 100);
  };

  const theme = getTheme(profile?.gender);
  
  const relDate = profile?.relationshipStartDate;
  const daysSinceTogether = relDate ? daysSince(dayjs(relDate)) : 0;
  
  const coupleId = profile?.coupleId;
  const currentUserId = session?.user?.id;

  const { data: partnerName } = useQuery({
    queryKey: ["partner_name", coupleId],
    enabled: !!coupleId && !!currentUserId,
    queryFn: async () => {
      const { data } = await supabase
        .from("users")
        .select("display_name")
        .eq("couple_id", coupleId)
        .neq("id", currentUserId)
        .maybeSingle();
      return data?.display_name ? decrypt(data.display_name) : "Partner";
    },
    staleTime: 1000 * 60 * 60,
  });

  const displayName = profile?.displayName || "Kullanıcı";

  return (
    <ScreenBackground>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Menü</Text>
          <TouchableOpacity onPress={() => router.back()} style={[styles.closeBtn, { backgroundColor: theme.cardBg }]}>
            <X color="#fff" size={20} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {/* Profile Card */}
          <View style={[styles.profileCard, { backgroundColor: theme.cardBg }]}>
            <View style={styles.avatarCircle}>
              <User color="rgba(255,255,255,0.8)" size={32} />
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{displayName}</Text>
              <Text style={styles.profileSubtitle}>{displayName} & {partnerName || "Partner"} • {daysSinceTogether} Gündür ❤️</Text>
            </View>
          </View>
          <TouchableOpacity style={[styles.menuItem, { backgroundColor: theme.cardBg }]} onPress={() => handleRoute("/(tabs)/home")}>
            <Home color="#fff" size={20} />
            <Text style={styles.menuText}>Ana Sayfa</Text>
            <ChevronRight color="rgba(255,255,255,0.3)" size={20} style={{ marginLeft: "auto" }} />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.menuItem, { backgroundColor: theme.cardBg }]} onPress={() => handleRoute("/(tabs)/medicine")}>
            <Pill color="#fff" size={20} />
            <Text style={styles.menuText}>İlaçlar</Text>
            <ChevronRight color="rgba(255,255,255,0.3)" size={20} style={{ marginLeft: "auto" }} />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.menuItem, { backgroundColor: theme.cardBg }]} onPress={() => handleRoute("/(tabs)/memories")}>
            <Heart color="#fff" size={20} />
            <Text style={styles.menuText}>Özel Günler</Text>
            <ChevronRight color="rgba(255,255,255,0.3)" size={20} style={{ marginLeft: "auto" }} />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.menuItem, { backgroundColor: theme.cardBg }]} onPress={() => handleRoute("/(tabs)/photos")}>
            <ImageIcon color="#fff" size={20} />
            <Text style={styles.menuText}>Ortak Galeri</Text>
            <ChevronRight color="rgba(255,255,255,0.3)" size={20} style={{ marginLeft: "auto" }} />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.menuItem, { backgroundColor: theme.cardBg }]} onPress={() => handleRoute("/(tabs)/add-photo")}>
            <Camera color="#fff" size={20} />
            <Text style={styles.menuText}>Fotoğraf Yükle</Text>
            <ChevronRight color="rgba(255,255,255,0.3)" size={20} style={{ marginLeft: "auto" }} />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.menuItem, { backgroundColor: theme.cardBg }]} onPress={() => handleRoute("/(tabs)/daily-notes")}>
            <BookOpen color="#fff" size={20} />
            <Text style={styles.menuText}>Günlüğüm</Text>
            <ChevronRight color="rgba(255,255,255,0.3)" size={20} style={{ marginLeft: "auto" }} />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.menuItem, { backgroundColor: theme.cardBg }]} onPress={() => handleRoute("/(tabs)/calendar")}>
            <CalendarHeart color="#fff" size={20} />
            <Text style={styles.menuText}>Takvim</Text>
            <ChevronRight color="rgba(255,255,255,0.3)" size={20} style={{ marginLeft: "auto" }} />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.menuItem, { backgroundColor: theme.cardBg }]} onPress={() => handleRoute("/(tabs)/letters")}>
            <View style={styles.iconCircle}>
              <X color="#fff" size={14} strokeWidth={3} />
            </View>
            <Text style={styles.menuText}>Mektuplar</Text>
            <ChevronRight color="rgba(255,255,255,0.3)" size={20} style={{ marginLeft: "auto" }} />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.menuItem, { backgroundColor: theme.cardBg }]} onPress={() => handleRoute("/profile")}>
            <Settings color="#fff" size={20} />
            <Text style={styles.menuText}>Ayarlar</Text>
            <ChevronRight color="rgba(255,255,255,0.3)" size={20} style={{ marginLeft: "auto" }} />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.menuItem, { backgroundColor: theme.cardBg }]} onPress={() => handleRoute("/(tabs)/period-tracker")}>
            <Droplet color="#fff" size={20} />
            <Text style={styles.menuText}>Regl Takvimi</Text>
            <ChevronRight color="rgba(255,255,255,0.3)" size={20} style={{ marginLeft: "auto" }} />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.menuItem, { backgroundColor: theme.cardBg }]} onPress={() => handleRoute("/(tabs)/meetings")}>
            <MapPin color="#fff" size={20} />
            <Text style={styles.menuText}>Buluşmalar</Text>
            <ChevronRight color="rgba(255,255,255,0.3)" size={20} style={{ marginLeft: "auto" }} />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.menuItem, { backgroundColor: theme.cardBg }]} onPress={handleSignOut}>
            <LogOut color={theme.accent} size={20} />
            <Text style={[styles.menuText, { color: theme.accent }]}>Çıkış Yap</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenBackground>
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
  },
  closeBtn: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: "PlayfairDisplay_400Regular_Italic",
    color: "#fff",
  },
  content: {
    padding: 20,
    paddingBottom: 100,
    gap: 12,
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 20,
    marginBottom: 8,
    gap: 14,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  profileInfo: {
    flex: 1,
    justifyContent: "center",
  },
  profileName: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
    marginBottom: 2,
  },
  profileSubtitle: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.6)",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 18,
    borderRadius: 18,
    gap: 14,
  },
  iconCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  menuText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  }
});
