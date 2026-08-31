import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { useRouter } from "expo-router";
import { AlignJustify } from "lucide-react-native";
import { useAuth } from "@/context/AuthContext";
import { dayjs } from "@/lib/date";

interface PageHeaderProps {
  title?: string;
  showBack?: boolean;
  showMenu?: boolean;
}

export function PageHeader({ title = "", showBack = true, showMenu = true }: PageHeaderProps) {
  const router = useRouter();
  const { profile } = useAuth();

  // Greeting name — display name or default
  const name = profile?.displayName || "Tatlım";
  // Formatted date: "17 Ağustos Pazartesi"
  const dateLabel = dayjs().format("D MMMM dddd");

  // If this is the home screen (no title, no back button), show the greeting style
  const isHome = !showBack && !title;

  if (isHome) {
    return (
      <View style={styles.homeHeader}>
        <View style={styles.greetingBlock}>
          <View style={styles.greetingRow}>
            <Text style={styles.greetingText}>
              Günaydın, {name}{" "}
            </Text>
            <Text style={styles.heartEmoji}>❤️</Text>
          </View>
          <Text style={styles.dateText}>{dateLabel}</Text>
        </View>

        {showMenu && (
          <TouchableOpacity onPress={() => router.push("/menu")} style={styles.menuBtn}>
            <AlignJustify color="rgba(255,255,255,0.75)" size={22} />
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={styles.headerContainer}>
      <View style={styles.side}>
        {showBack && (
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
            <AlignJustify color="#fff" size={24} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.center}>
        {title ? <Text style={styles.title} numberOfLines={1}>{title}</Text> : null}
      </View>

      <View style={styles.sideRight}>
        {showMenu && (
          <TouchableOpacity onPress={() => router.push("/menu")} style={styles.iconBtn}>
            <AlignJustify color="#fff" size={24} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  homeHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 58 : 38,
    paddingBottom: 4,
    backgroundColor: "transparent",
    zIndex: 10,
  },
  greetingBlock: {
    flex: 1,
  },
  greetingRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  greetingText: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    color: "#ffffff",
    letterSpacing: -0.4,
  },
  heartEmoji: {
    fontSize: 22,
  },
  dateText: {
    fontSize: 13,
    color: "rgba(255,255,255,0.45)",
    marginTop: 4,
    fontFamily: "Inter_400Regular",
  },
  menuBtn: {
    padding: 6,
    marginTop: 4,
  },
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingBottom: 15,
    backgroundColor: "transparent",
    zIndex: 10,
  },
  side: {
    flex: 1,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  sideRight: {
    flex: 1,
    justifyContent: "center",
    alignItems: "flex-end",
  },
  center: {
    flex: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: "#fff",
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  iconBtn: {
    padding: 5,
    marginHorizontal: -5,
  }
});
