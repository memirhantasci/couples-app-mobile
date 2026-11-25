import React from "react";
import { Platform, View, type ViewProps } from "react-native";
import { BlurView, type BlurViewProps } from "expo-blur";

export interface PlatformBlurViewProps extends BlurViewProps {
  /**
   * Android yüzey rolü: `expo-blur` varsayılan olarak Android'de soluk/çamurlu düz gri kaplama
   * çizer; `dimezisBlurView` ise Google Maps (`SurfaceView`) ve yarı saydam `<Modal>` pencerelerinde
   * titreme/siyah kare yapabilir. Bu yüzden Android'de tema uyumlu temiz yarı-opak yüzey kullanılır.
   * - `"surface"` (varsayılan): kart, alt çubuk, üst çubuk ve hap yüzeyleri
   * - `"backdrop"`: modal arka plan perdesi
   */
  variant?: "surface" | "backdrop";
  /** Android için açık arka plan rengi (ör. kardeşte zaten renk katmanı varsa `"transparent"`). */
  androidBackgroundColor?: string;
}

function isLightTint(tint: BlurViewProps["tint"]): boolean {
  return (
    tint === "light" ||
    tint === "extraLight" ||
    tint === "systemThinMaterialLight" ||
    tint === "systemMaterialLight" ||
    tint === "systemThickMaterialLight" ||
    tint === "systemChromeMaterialLight" ||
    tint === "systemUltraThinMaterialLight"
  );
}

function resolveAndroidBackground(
  tint: BlurViewProps["tint"],
  variant: "surface" | "backdrop",
  override?: string
): string {
  if (override !== undefined) return override;
  const light = isLightTint(tint);
  if (variant === "backdrop") {
    return light ? "rgba(15, 23, 42, 0.36)" : "rgba(4, 3, 10, 0.72)";
  }
  return light ? "rgba(255, 255, 255, 0.94)" : "rgba(16, 14, 26, 0.92)";
}

/**
 * Çapraz platform buzlu cam bileşeni.
 * - iOS / Web: yerel `expo-blur` `<BlurView>` (görsel görünüm %100 korunur).
 * - Android: çamurlu gri katman ve harita/modal titremesi olmadan net, tema uyumlu yüzey.
 */
export function PlatformBlurView({
  tint = "default",
  intensity = 50,
  variant = "surface",
  androidBackgroundColor,
  style,
  children,
  pointerEvents,
  ...rest
}: PlatformBlurViewProps) {
  if (Platform.OS === "android") {
    const backgroundColor = resolveAndroidBackground(tint, variant, androidBackgroundColor);
    const viewProps: ViewProps = {
      pointerEvents,
      style: [style, backgroundColor ? { backgroundColor } : null],
    };
    return <View {...viewProps}>{children}</View>;
  }

  return (
    <BlurView
      tint={tint}
      intensity={intensity}
      style={style}
      pointerEvents={pointerEvents}
      {...rest}
    >
      {children}
    </BlurView>
  );
}
