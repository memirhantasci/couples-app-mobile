import React from "react";
import { Text, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import type { AppTheme } from "@/lib/theme";
import { fieldSurface } from "./profileTokens";

interface SettingsButtonProps {
  label: string;
  onPress: () => void;
  theme: AppTheme;
  loading?: boolean;
  disabled?: boolean;
  /** primary: dolu vurgu rengi, tinted: vurgu tonlu arka plan, plain: nötr dolgu. */
  variant?: "primary" | "tinted" | "plain" | "danger";
}

export function SettingsButton({
  label,
  onPress,
  theme,
  loading,
  disabled,
  variant = "primary",
}: SettingsButtonProps) {
  const isPrimary = variant === "primary";
  const background = isPrimary ? theme.accent : variant === "tinted" ? `${theme.accent}22` : variant === "danger" ? "rgba(216, 88, 112,0.14)" : fieldSurface(theme);
  const textColor = isPrimary ? "#ffffff" : variant === "tinted" ? theme.accent : variant === "danger" ? "#D85870" : theme.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled || !!loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: background },
        disabled && { opacity: 0.45 },
        pressed && { opacity: 0.8 },
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={textColor} />
      ) : (
        <Text style={[styles.label, { color: textColor }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 50,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  label: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.2,
  },
});
