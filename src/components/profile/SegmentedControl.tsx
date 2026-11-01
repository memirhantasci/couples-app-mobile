import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import type { AppTheme } from "@/lib/theme";
import { fieldSurface } from "./profileTokens";

interface SegmentOption<T extends string> {
  key: T;
  label: string;
  emoji?: string;
}

interface SegmentedControlProps<T extends string> {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (key: T) => void;
  theme: AppTheme;
  disabled?: boolean;
}

/** Yan yana seçeneklerden birini seçtiren, seçili parçası vurgu renginde dolan kontrol. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  theme,
  disabled,
}: SegmentedControlProps<T>) {
  return (
    <View style={[styles.track, { backgroundColor: fieldSurface(theme) }]} accessibilityRole="radiogroup">
      {options.map((option) => {
        const selected = option.key === value;
        return (
          <Pressable
            key={option.key}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled }}
            accessibilityLabel={option.label}
            disabled={disabled}
            onPress={() => onChange(option.key)}
            style={[
              styles.segment,
              selected && { backgroundColor: theme.accent },
              disabled && !selected && { opacity: 0.45 },
            ]}
          >
            {option.emoji ? <Text style={styles.emoji}>{option.emoji}</Text> : null}
            <Text
              style={[
                styles.label,
                { color: selected ? "#ffffff" : theme.textSecondary },
                selected && { fontFamily: "Inter_700Bold" },
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    padding: 4,
    borderRadius: 18,
    gap: 4,
  },
  segment: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    height: 42,
    borderRadius: 14,
  },
  emoji: {
    fontSize: 15,
  },
  label: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
});
