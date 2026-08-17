import React from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleProp, ViewStyle } from 'react-native';

interface ScreenBackgroundProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  colors?: readonly [string, string, ...string[]];
}

export function ScreenBackground({ children, style, colors }: ScreenBackgroundProps) {
  // Premium karanlık tema (Dark Mode) varsayılan arka planı
  const defaultColors = ["#080811", "#0A0A0C", "#080811"] as const;
  
  return (
    <LinearGradient colors={colors || defaultColors} style={[{ flex: 1 }, style]}>
      {children}
    </LinearGradient>
  );
}
