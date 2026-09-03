import React from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleProp, ViewStyle, StatusBar } from 'react-native';
import { useTheme } from '@/context/ThemeContext';

interface ScreenBackgroundProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  colors?: readonly [string, string, ...string[]];
}

export function ScreenBackground({ children, style, colors }: ScreenBackgroundProps) {
  const { theme, isLight } = useTheme();
  const backgroundColors = colors ?? theme.bgGradient;

  return (
    <LinearGradient colors={backgroundColors} style={[{ flex: 1 }, style]}>
      <StatusBar barStyle={isLight ? 'dark-content' : 'light-content'} />
      {children}
    </LinearGradient>
  );
}
