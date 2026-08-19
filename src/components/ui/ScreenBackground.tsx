import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';

interface ScreenBackgroundProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  colors?: readonly [string, string, ...string[]];
}

export function ScreenBackground({ children, style, colors }: ScreenBackgroundProps) {
  // Koyu bordo-siyah arka plan
  const defaultColors = ["#1a0e12", "#160b0f", "#1a0e12"] as const;

  return (
    <LinearGradient colors={colors || defaultColors} style={[{ flex: 1 }, style]}>
      {children}
    </LinearGradient>
  );
}
