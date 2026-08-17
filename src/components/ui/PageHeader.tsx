import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { useRouter } from "expo-router";
import { ChevronLeft, Menu } from "lucide-react-native";
import { useAuth } from "@/context/AuthContext";

interface PageHeaderProps {
  title?: string;
  showBack?: boolean;
  showMenu?: boolean;
}

export function PageHeader({ title = "", showBack = true, showMenu = true }: PageHeaderProps) {
  const router = useRouter();
  const { profile } = useAuth();

  return (
    <View style={styles.headerContainer}>
      <View style={styles.side}>
        {showBack && (
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
            <ChevronLeft color="#fff" size={28} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.center}>
        {title ? <Text style={styles.title} numberOfLines={1}>{title}</Text> : null}
      </View>

      <View style={styles.sideRight}>
        {showMenu && (
          <TouchableOpacity onPress={() => router.push("/menu")} style={[styles.iconBtn, { alignItems: "center", flexDirection: "row", justifyContent: "flex-end", gap: 8 }]}>
            {profile?.displayName && <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 14, fontWeight: "600" }}>{profile.displayName}</Text>}
            <Menu color="#fff" size={24} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
    fontWeight: "600",
    textAlign: "center",
  },
  iconBtn: {
    padding: 5,
    marginHorizontal: -5,
  }
});
