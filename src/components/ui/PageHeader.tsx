import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { useRouter } from "expo-router";
import { ChevronLeft, Menu } from "lucide-react-native";

interface PageHeaderProps {
  title?: string;
  showBack?: boolean;
  showMenu?: boolean;
}

export function PageHeader({ title = "", showBack = true, showMenu = true }: PageHeaderProps) {
  const router = useRouter();

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

      <View style={styles.side}>
        {showMenu && (
          <TouchableOpacity onPress={() => router.push("/menu")} style={[styles.iconBtn, { alignItems: "flex-end" }]}>
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
    width: 50,
    justifyContent: "center",
  },
  center: {
    flex: 1,
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
