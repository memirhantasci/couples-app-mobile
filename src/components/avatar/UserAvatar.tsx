import React from "react";
import { View, Text, StyleSheet, ActivityIndicator, type StyleProp, type ViewStyle } from "react-native";
import { Image } from "expo-image";
import { useTheme } from "@/context/ThemeContext";
import { useTranslation } from "react-i18next";
import { upperInitial } from "@/lib/textCase";

interface UserAvatarProps {
  /** Profil fotoğrafı; yoksa baş harf gösterilir */
  uri?: string | null;
  /** Baş harf için isim */
  name?: string | null;
  size?: number;
  /** Varsayılan: tema vurgu rengi */
  borderColor?: string;
  borderWidth?: number;
  /** Sağ alt köşe rozeti (kamera, ruh hali emojisi vb.) */
  badge?: React.ReactNode;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function UserAvatar({
  uri,
  name,
  size = 40,
  borderColor,
  borderWidth = 1.5,
  badge,
  loading = false,
  style,
}: UserAvatarProps) {
  const { theme } = useTheme();
  const { i18n } = useTranslation();
  const initial = name?.trim() ? upperInitial(name.trim(), i18n.language) : "?";
  const radius = size / 2;

  return (
    <View style={[{ width: size, height: size }, style]}>
      <View
        style={[
          styles.circle,
          {
            width: size,
            height: size,
            borderRadius: radius,
            borderWidth,
            borderColor: borderColor ?? theme.accent,
            backgroundColor: theme.pillAccentBg,
          },
        ]}
      >
        {uri ? (
          <Image
            source={{ uri }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
            transition={150}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <Text style={[styles.initial, { color: theme.accent, fontSize: Math.round(size * 0.42) }]}>{initial}</Text>
        )}

        {loading && (
          <View style={[StyleSheet.absoluteFill, styles.loadingOverlay]}>
            <ActivityIndicator size="small" color="#FFFFFF" />
          </View>
        )}
      </View>

      {badge ? <View style={styles.badge}>{badge}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  initial: {
    fontFamily: "Inter_700Bold",
  },
  loadingOverlay: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  badge: {
    position: "absolute",
    right: -2,
    bottom: -2,
  },
});
