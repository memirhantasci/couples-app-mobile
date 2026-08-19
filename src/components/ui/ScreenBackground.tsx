import React from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleProp, ViewStyle } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { getTheme } from '@/lib/theme';

interface ScreenBackgroundProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  colors?: readonly [string, string, ...string[]];
}

export function ScreenBackground({ children, style, colors }: ScreenBackgroundProps) {
  const { profile } = useAuth();
  const theme = getTheme(profile?.gender);
  const backgroundColors = colors ?? theme.bgGradient;

  return (
    <LinearGradient colors={backgroundColors} style={[{ flex: 1 }, style]}>
      {children}
    </LinearGradient>
  );
}
