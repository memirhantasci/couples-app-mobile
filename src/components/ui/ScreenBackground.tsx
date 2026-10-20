import React, { memo } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleProp, ViewStyle, StatusBar } from 'react-native';
import { useIsFocused } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';

interface ScreenBackgroundProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  colors?: readonly [string, string, ...string[]];
}

export const ScreenBackground = memo(function ScreenBackground({ children, style, colors }: ScreenBackgroundProps) {
  const { theme, isLight } = useTheme();
  const backgroundColors = colors ?? theme.bgGradient;
  // Dondurulmuş (görünmeyen) sekmelerin eski bir temaya ait StatusBar kaydı kalmasın diye durum çubuğunu
  // yalnızca odaktaki ekran yönetir; odak değişince kayıt düşer/yeniden eklenir.
  const isFocused = useIsFocused();

  return (
    <LinearGradient colors={backgroundColors} style={[{ flex: 1 }, style]}>
      {/* Özel (koyu) renkler verilen ekranlarda (giriş/kurulum) durum çubuğu açık temada bile açık renk kalır */}
      {isFocused ? <StatusBar barStyle={!colors && isLight ? 'dark-content' : 'light-content'} /> : null}
      {children}
    </LinearGradient>
  );
});
