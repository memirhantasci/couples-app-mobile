import React from "react";
import { TouchableOpacity, StyleSheet, View } from "react-native";
import { HelpCircle, Lightbulb } from "lucide-react-native";
import { useTheme } from "@/context/ThemeContext";

interface TourGuideButtonProps {
  onPress: () => void;
  size?: number;
  variant?: "lightbulb" | "help";
}

export function TourGuideButton({
  onPress,
  size = 18,
  variant = "lightbulb",
}: TourGuideButtonProps) {
  const { theme, isLight } = useTheme();

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[
        styles.button,
        {
          backgroundColor: isLight
            ? "rgba(0,0,0,0.05)"
            : "rgba(255,255,255,0.08)",
          borderColor: isLight
            ? "rgba(0,0,0,0.08)"
            : "rgba(255,255,255,0.12)",
        },
      ]}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityLabel="Sayfa Rehberi"
    >
      {variant === "lightbulb" ? (
        <Lightbulb size={size} color={theme.accent} />
      ) : (
        <HelpCircle size={size} color={theme.accent} />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
