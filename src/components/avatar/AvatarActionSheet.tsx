import React from "react";
import { View, Text, TouchableOpacity, Modal, StyleSheet, Pressable, Platform } from "react-native";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Camera, ImageIcon, Trash2, X } from "lucide-react-native";
import { useTheme } from "@/context/ThemeContext";
import type { AvatarSource } from "@/lib/avatar";

interface AvatarActionSheetProps {
  visible: boolean;
  onClose: () => void;
  onPick: (source: AvatarSource) => void;
  onRemove: () => void;
  canRemove: boolean;
}

export function AvatarActionSheet({ visible, onClose, onPick, onRemove, canRemove }: AvatarActionSheetProps) {
  const { theme, isLight } = useTheme();
  const insets = useSafeAreaInsets();
  const cameraAvailable = Platform.OS !== "web";

  const rowStyle = [
    styles.row,
    {
      backgroundColor: isLight ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.06)",
      borderColor: isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.08)",
    },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Kapat" />
      <View style={[styles.sheetWrap, { paddingBottom: insets.bottom + 16 }]}>
        <BlurView
          intensity={Platform.OS === "ios" ? 60 : 90}
          tint={isLight ? "light" : "dark"}
          style={[StyleSheet.absoluteFill, styles.blur]}
        />
        <View
          style={[
            StyleSheet.absoluteFill,
            styles.blur,
            styles.tintLayer,
            { backgroundColor: isLight ? "rgba(255,255,255,0.72)" : "rgba(26,22,36,0.78)", borderColor: theme.cardBorder },
          ]}
        />

        <View style={[styles.handle, { backgroundColor: isLight ? "rgba(0,0,0,0.15)" : "rgba(255,255,255,0.2)" }]} />
        <Text style={[styles.title, { color: theme.text }]}>Profil Fotoğrafı</Text>
        <Text style={[styles.subtitle, { color: theme.textMuted }]}>Sevgilin seni bu fotoğrafla görecek 💕</Text>

        <View style={styles.rows}>
          {cameraAvailable && (
            <TouchableOpacity style={rowStyle} onPress={() => onPick("camera")} activeOpacity={0.8}>
              <View style={[styles.iconCircle, { backgroundColor: theme.pillAccentBg }]}>
                <Camera size={18} color={theme.accent} />
              </View>
              <Text style={[styles.rowText, { color: theme.text }]}>Fotoğraf Çek</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={rowStyle} onPress={() => onPick("library")} activeOpacity={0.8}>
            <View style={[styles.iconCircle, { backgroundColor: theme.pillAccentBg }]}>
              <ImageIcon size={18} color={theme.accent} />
            </View>
            <Text style={[styles.rowText, { color: theme.text }]}>Galeriden Seç</Text>
          </TouchableOpacity>

          {canRemove && (
            <TouchableOpacity style={rowStyle} onPress={onRemove} activeOpacity={0.8}>
              <View style={[styles.iconCircle, { backgroundColor: "rgba(255, 77, 106, 0.15)" }]}>
                <Trash2 size={18} color="#ff4d6a" />
              </View>
              <Text style={[styles.rowText, { color: "#ff4d6a" }]}>Mevcut Fotoğrafı Kaldır</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={[rowStyle, styles.cancelRow]} onPress={onClose} activeOpacity={0.8}>
            <View style={[styles.iconCircle, { backgroundColor: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.08)" }]}>
              <X size={18} color={theme.textSecondary} />
            </View>
            <Text style={[styles.rowText, { color: theme.textSecondary }]}>Vazgeç</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheetWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  blur: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    overflow: "hidden",
  },
  tintLayer: {
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 14,
  },
  title: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 12.5,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginTop: 4,
    marginBottom: 16,
  },
  rows: {
    gap: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  cancelRow: {
    marginTop: 4,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
});
