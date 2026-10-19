import React, { memo } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleProp, ViewStyle, StatusBar } from 'react-native';
import { useTheme } from '@/context/ThemeContext';

interface ScreenBackgroundProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  colors?: readonly [string, string, ...string[]];
}

export const ScreenBackground = memo(function ScreenBackground({ children, style, colors }: ScreenBackgroundProps) {
  const { theme, isLight } = useTheme();
  const backgroundColors = colors ?? theme.bgGradient;

  return (
    <LinearGradient colors={backgroundColors} style={[{ flex: 1 }, style]}>
      {/* Özel (koyu) renkler verilen ekranlarda (giriş/kurulum) durum çubuğu açık temada bile açık renk kalır */}
      <StatusBar barStyle={!colors && isLight ? 'dark-content' : 'light-content'} />
      {children}
    </LinearGradient>
  );
});
