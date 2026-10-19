import React from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import Svg, { Polygon, Defs, LinearGradient, Stop } from "react-native-svg";

/** Hem SharedValue hem useDerivedValue sonucu (set'siz) kabul edilsin diye yalnızca okunabilirlik istenir. */
export interface ReadableNumber {
  get(): number;
}

/** Kuşun sprite kutusu (px). Üst bileşenler bunu scale ederek boyutlandırır. */
export const ORIGAMI_BIRD_SIZE = 140;

/**
 * Sprite'ın baş yönü dikeyden yaklaşık 28° sola eğik çizilmiştir. Kuşu bir hareket yönüne
 * çevirirken (yukarıdan saat yönünde derece) bu kadarı eklenir ki burnu gittiği yönü göstersin.
 */
export const ORIGAMI_BIRD_HEAD_OFFSET = 28;

interface OrigamiBirdProps {
  /**
   * Kanat çırpma ilerlemesi, 0..1 (0 = kanatlar yukarı, 1 = aşağı).
   * UI iş parçacığında sürülür (SharedValue ya da useDerivedValue sonucu).
   */
  flap: ReadableNumber;
}

/** Beyaz, pembe tonlu origami turna kuşu. Kanatlar `flap` değerine göre çırpar. */
export function OrigamiBird({ flap }: OrigamiBirdProps) {
  const leftWingStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${-18 + 46 * flap.get()}deg` },
      { scaleY: 1 - 0.22 * flap.get() },
    ],
  }));
  const rightWingStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${18 - 46 * flap.get()}deg` },
      { scaleY: 1 - 0.22 * flap.get() },
    ],
  }));

  return (
    <View style={styles.wrapper}>
      {/* Sol kanat */}
      <Animated.View style={[styles.wingLeft, leftWingStyle]}>
        <Svg width={65} height={75} viewBox="0 0 65 75">
          <Defs>
            <LinearGradient id="leftWingMain" x1="100%" y1="100%" x2="0%" y2="0%">
              <Stop offset="0%" stopColor="#FFFFFF" />
              <Stop offset="60%" stopColor="#FFF0F5" />
              <Stop offset="100%" stopColor="#FFD1DC" />
            </LinearGradient>
            <LinearGradient id="leftWingFold" x1="100%" y1="100%" x2="0%" y2="0%">
              <Stop offset="0%" stopColor="#FFF5F7" />
              <Stop offset="100%" stopColor="#FFB8C6" />
            </LinearGradient>
          </Defs>
          <Polygon points="60,65 5,12 38,30" fill="url(#leftWingMain)" />
          <Polygon points="60,65 38,30 46,55" fill="url(#leftWingFold)" />
        </Svg>
      </Animated.View>

      {/* Gövde, baş ve kuyruk */}
      <Svg width={90} height={95} viewBox="0 0 90 95">
        <Defs>
          <LinearGradient id="bodyFaceLeft" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#FFFFFF" />
            <Stop offset="100%" stopColor="#FFF2F5" />
          </LinearGradient>
          <LinearGradient id="bodyFaceRight" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#FFE8EE" />
            <Stop offset="100%" stopColor="#FFCCD7" />
          </LinearGradient>
          <LinearGradient id="headBeak" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#FFFFFF" />
            <Stop offset="100%" stopColor="#FF9EB5" />
          </LinearGradient>
          <LinearGradient id="tailGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#FFF5F8" />
            <Stop offset="100%" stopColor="#FFA6BC" />
          </LinearGradient>
        </Defs>
        <Polygon points="45,65 58,92 50,75" fill="url(#tailGradient)" />
        <Polygon points="45,45 32,18 22,12 26,24" fill="url(#headBeak)" />
        <Polygon points="45,35 34,55 45,72 45,35" fill="url(#bodyFaceLeft)" />
        <Polygon points="45,35 56,55 45,72 45,35" fill="url(#bodyFaceRight)" />
      </Svg>

      {/* Sağ kanat */}
      <Animated.View style={[styles.wingRight, rightWingStyle]}>
        <Svg width={65} height={75} viewBox="0 0 65 75">
          <Defs>
            <LinearGradient id="rightWingMain" x1="0%" y1="100%" x2="100%" y2="0%">
              <Stop offset="0%" stopColor="#FFFFFF" />
              <Stop offset="60%" stopColor="#FFF0F5" />
              <Stop offset="100%" stopColor="#FFCCD7" />
            </LinearGradient>
            <LinearGradient id="rightWingFold" x1="0%" y1="100%" x2="100%" y2="0%">
              <Stop offset="0%" stopColor="#FFE4EC" />
              <Stop offset="100%" stopColor="#FFA6BC" />
            </LinearGradient>
          </Defs>
          <Polygon points="5,65 60,12 27,30" fill="url(#rightWingMain)" />
          <Polygon points="5,65 27,30 19,55" fill="url(#rightWingFold)" />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: ORIGAMI_BIRD_SIZE,
    height: ORIGAMI_BIRD_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  wingLeft: {
    position: "absolute",
    left: 4,
    top: 18,
  },
  wingRight: {
    position: "absolute",
    right: 4,
    top: 18,
  },
});
