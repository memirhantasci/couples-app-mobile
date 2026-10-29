import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  type LayoutChangeEvent,
} from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, ChevronRight, Heart, HelpCircle, Mail, Sparkles } from "lucide-react-native";
import { useTheme } from "@/context/ThemeContext";
import { TAB_BAR_HEIGHT, getTabBarBottomOffset } from "@/constants/tabBar";
import {
  computeTooltipLayout,
  getTooltipWidth,
  resolveSpotlightRect,
  type Rect,
  type Size,
  type VisibleArea,
} from "./spotlightLayout";
import { useTranslation } from "react-i18next";

// Skia yalnızca native modül mevcutsa yüklenir (Expo Go vb. ortamlarda çökmesin);
// yoksa tur, ışık deliği olmadan ortalanmış kartlarla çalışmaya devam eder.
let SkiaLib: typeof import("@shopify/react-native-skia") | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("@shopify/react-native-skia");
  if (mod?.Skia && mod?.Canvas) SkiaLib = mod;
} catch {
  SkiaLib = null;
}

const ICON_MAP: Record<string, any> = { Heart, Mail, Sparkles, HelpCircle };

const SPOTLIGHT_PADDING = 6;
const MEASURE_TIMEOUT_MS = 400;
const MOVE_DURATION_MS = 380;
const ARROW_SIZE = 14;
// CustomTabBar ((tabs)/_layout.tsx): 64px yükseklik + alt boşluk; spotlight bu alanın altına inmez

export interface SpotlightStep {
  id: string;
  title: string;
  description: string;
  icon?: string;
  /** Hedef görünüm; ölçülemezse adım ortalanmış kart olarak gösterilir */
  targetRef: React.RefObject<View | null>;
  /** Hedefin köşe yarıçapı (spotlight şekli buna uyar) */
  radius?: number;
}

interface SpotlightTourProps {
  visible: boolean;
  /** Sabit referanslı olmalı (her render'da yeni dizi verilirse ölçüm tekrarlanır) */
  steps: SpotlightStep[];
  /** completed: son adım bitirildi; skipped: "Turu Geç" / geri tuşu */
  onClose: (reason: "completed" | "skipped") => void;
}

function measureInWindow(node: View | null): Promise<Rect | null> {
  return new Promise((resolve) => {
    if (!node) return resolve(null);
    let settled = false;
    const timer = setTimeout(() => {
      settled = true;
      resolve(null);
    }, MEASURE_TIMEOUT_MS);
    const finish = (rect: Rect | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(rect);
    };
    try {
      node.measureInWindow((x, y, width, height) => finish({ x, y, width, height }));
    } catch {
      finish(null);
    }
  });
}

export function SpotlightTour({ visible, steps, onClose }: SpotlightTourProps) {
  // İçerik yalnızca görünürken mount edilir: her açılış ilk adımdan, temiz durumla başlar
  if (!visible || steps.length === 0) return null;
  return <SpotlightTourContent steps={steps} onClose={onClose} />;
}

function SpotlightTourContent({ steps, onClose }: Omit<SpotlightTourProps, "visible">) {
  const { t } = useTranslation();
  const { theme, isLight } = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const rootRef = useRef<View>(null);

  const [index, setIndex] = useState(0);
  const [overlaySize, setOverlaySize] = useState<Size | null>(null);
  // Ölçümü tamamlanmış adım: kart içeriği ve spotlight bu adıma göre çizilir
  const [resolved, setResolved] = useState<{ index: number; rect: Rect | null } | null>(null);
  const [cardSize, setCardSize] = useState<{ index: number; height: number } | null>(null);

  const step = steps[index];
  const shownIndex = resolved?.index ?? index;
  const shownStep = steps[shownIndex];

  const area = useMemo<VisibleArea | null>(() => {
    if (!overlaySize) return null;
    const tabBarBottom = getTabBarBottomOffset(insets.bottom);
    return {
      top: insets.top,
      bottom: overlaySize.height - tabBarBottom - TAB_BAR_HEIGHT - 8,
    };
  }, [overlaySize, insets.top, insets.bottom]);

  // ─── Animasyon durumları ───
  const spotX = useSharedValue(0);
  const spotY = useSharedValue(0);
  const spotW = useSharedValue(0);
  const spotH = useSharedValue(0);
  const spotR = useSharedValue(0);
  const ringOpacity = useSharedValue(0);
  const pulse = useSharedValue(0);
  const cardOpacity = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    pulse.set(
      withRepeat(withTiming(1, { duration: 1400, easing: Easing.out(Easing.quad) }), -1, false)
    );
    return () => cancelAnimation(pulse);
  }, [reduceMotion, pulse]);

  // ─── Adım değişince hedefi ölç ───
  useEffect(() => {
    if (!overlaySize || !area || !step) return;
    let cancelled = false;
    cardOpacity.set(withTiming(0, { duration: reduceMotion ? 0 : 120 }));

    (async () => {
      const [origin, measured] = await Promise.all([
        measureInWindow(rootRef.current),
        SkiaLib ? measureInWindow(step.targetRef.current) : Promise.resolve(null),
      ]);
      if (cancelled) return;
      // Hedef ve overlay aynı pencere koordinatlarına indirgenir (Android/iOS farkı kalmaz)
      const relative = measured
        ? { ...measured, x: measured.x - (origin?.x ?? 0), y: measured.y - (origin?.y ?? 0) }
        : null;
      setResolved({
        index,
        rect: resolveSpotlightRect(relative, overlaySize, area, SPOTLIGHT_PADDING),
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [index, step, overlaySize, area, reduceMotion, cardOpacity]);

  // ─── Spotlight'ı yeni hedefe kaydır ───
  useEffect(() => {
    if (!resolved || !overlaySize) return;
    const rect = resolved.rect;
    const config = { duration: reduceMotion ? 0 : MOVE_DURATION_MS, easing: Easing.out(Easing.cubic) };
    if (rect) {
      const radius = (steps[resolved.index]?.radius ?? 16) + SPOTLIGHT_PADDING;
      spotX.set(withTiming(rect.x, config));
      spotY.set(withTiming(rect.y, config));
      spotW.set(withTiming(rect.width, config));
      spotH.set(withTiming(rect.height, config));
      spotR.set(withTiming(Math.min(radius, rect.height / 2, rect.width / 2), config));
      ringOpacity.set(withTiming(1, config));
    } else {
      // Ölçülemeyen hedef: ışık ekranın ortasında kapanır, kart ortada gösterilir
      spotX.set(withTiming(overlaySize.width / 2, config));
      spotY.set(withTiming(overlaySize.height / 2, config));
      spotW.set(withTiming(0, config));
      spotH.set(withTiming(0, config));
      spotR.set(withTiming(0, config));
      ringOpacity.set(withTiming(0, config));
    }
  }, [resolved, overlaySize, steps, reduceMotion, spotX, spotY, spotW, spotH, spotR, ringOpacity]);

  // ─── Balon yerleşimi ───
  const tooltipWidth = overlaySize ? getTooltipWidth(overlaySize.width) : 0;
  const layout = useMemo(() => {
    if (!resolved || !overlaySize || !area || cardSize?.index !== resolved.index) return null;
    return computeTooltipLayout(
      resolved.rect,
      { width: tooltipWidth, height: cardSize.height },
      overlaySize,
      area
    );
  }, [resolved, overlaySize, area, cardSize, tooltipWidth]);

  useEffect(() => {
    if (!layout) return;
    cardOpacity.set(withTiming(1, { duration: reduceMotion ? 0 : 220 }));
  }, [layout, reduceMotion, cardOpacity]);

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ translateY: (1 - cardOpacity.value) * 8 }],
  }));

  // ─── Skia türetilmiş değerleri (halka + nabız) ───
  const pulseInset = useDerivedValue(() => 2 + pulse.value * 8);
  const pulseX = useDerivedValue(() => spotX.value - pulseInset.value);
  const pulseY = useDerivedValue(() => spotY.value - pulseInset.value);
  const pulseW = useDerivedValue(() => spotW.value + pulseInset.value * 2);
  const pulseH = useDerivedValue(() => spotH.value + pulseInset.value * 2);
  const pulseR = useDerivedValue(() => spotR.value + pulseInset.value);
  const pulseOpacity = useDerivedValue(() => ringOpacity.value * (1 - pulse.value) * 0.55);

  const handleRootLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setOverlaySize((prev) =>
      prev && prev.width === width && prev.height === height ? prev : { width, height }
    );
  }, []);

  const handleCardLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const height = e.nativeEvent.layout.height;
      setCardSize((prev) =>
        prev && prev.index === shownIndex && prev.height === height ? prev : { index: shownIndex, height }
      );
    },
    [shownIndex]
  );

  // Geçiş sırasında kartta hâlâ önceki adım görünebilir; gezinme ekrandaki adıma göre yapılır
  const handleNext = () => {
    if (shownIndex >= steps.length - 1) onClose("completed");
    else setIndex(shownIndex + 1);
  };
  const handlePrev = () => setIndex(Math.max(shownIndex - 1, 0));
  const handleSkip = () => onClose("skipped");

  if (!shownStep) return null;

  const dimColor = isLight ? "rgba(24, 14, 32, 0.62)" : "rgba(0, 0, 0, 0.74)";
  const cardBg = isLight ? "#FFFFFF" : "#1E1928";
  const cardBorder = isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.12)";
  const mutedText = isLight ? "#6B6577" : "rgba(255,255,255,0.6)";
  const Icon = ICON_MAP[shownStep.icon ?? ""] ?? Sparkles;
  const arrowX = layout?.arrowX ?? null;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={handleSkip}
    >
      {/* Dokunuşlar overlay'de kalır: tur sırasında arka plandaki butonlar tetiklenmez */}
      <View ref={rootRef} style={StyleSheet.absoluteFill} onLayout={handleRootLayout}>
        {SkiaLib && overlaySize ? (
          <SkiaLib.Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
            <SkiaLib.Group layer>
              <SkiaLib.Rect x={0} y={0} width={overlaySize.width} height={overlaySize.height} color={dimColor} />
              <SkiaLib.RoundedRect
                x={spotX}
                y={spotY}
                width={spotW}
                height={spotH}
                r={spotR}
                color="black"
                blendMode="clear"
              />
            </SkiaLib.Group>
            <SkiaLib.RoundedRect
              x={pulseX}
              y={pulseY}
              width={pulseW}
              height={pulseH}
              r={pulseR}
              color={theme.accent}
              style="stroke"
              strokeWidth={2}
              opacity={pulseOpacity}
            />
            <SkiaLib.RoundedRect
              x={spotX}
              y={spotY}
              width={spotW}
              height={spotH}
              r={spotR}
              color={theme.accent}
              style="stroke"
              strokeWidth={2}
              opacity={ringOpacity}
            />
          </SkiaLib.Canvas>
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: dimColor }]} pointerEvents="none" />
        )}

        {overlaySize && (
          <Animated.View
            style={[
              styles.cardWrapper,
              { width: tooltipWidth, left: layout?.left ?? 0, top: layout?.top ?? 0 },
              cardAnimatedStyle,
            ]}
            pointerEvents={layout ? "auto" : "none"}
          >
            {/* key: içerik değişince yeniden ölçülsün (yükseklik aynı kalsa bile onLayout tetiklenir) */}
            <View
              key={shownIndex}
              onLayout={handleCardLayout}
              style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}
            >
              <View style={styles.topRow}>
                <View style={styles.dots}>
                  {steps.map((s, i) => (
                    <View
                      key={s.id}
                      style={[
                        styles.dot,
                        i === shownIndex
                          ? { width: 18, backgroundColor: theme.accent }
                          : { backgroundColor: isLight ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.18)" },
                      ]}
                    />
                  ))}
                  <Text style={[styles.counterText, { color: mutedText }]}>
                    {shownIndex + 1} / {steps.length}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={handleSkip}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={[styles.skipBtn, { backgroundColor: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.08)" }]}
                  accessibilityRole="button"
                  accessibilityLabel={t("tour.skipA11y")}
                >
                  <Text style={[styles.skipText, { color: mutedText }]}>{t("tour.skip")}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.titleRow}>
                <View style={[styles.iconBox, { backgroundColor: theme.pillAccentBg, borderColor: theme.pillAccentBorder }]}>
                  <Icon size={18} color={theme.accent} />
                </View>
                <Text style={[styles.title, { color: theme.text }]} numberOfLines={2}>
                  {shownStep.title}
                </Text>
              </View>

              <Text style={[styles.description, { color: isLight ? "#4E4858" : "rgba(255,255,255,0.82)" }]}>
                {shownStep.description}
              </Text>

              <View style={styles.navRow}>
                {shownIndex > 0 ? (
                  <TouchableOpacity
                    onPress={handlePrev}
                    style={[styles.prevBtn, { borderColor: cardBorder }]}
                    activeOpacity={0.8}
                  >
                    <ChevronLeft size={16} color={theme.text} />
                    <Text style={[styles.prevText, { color: theme.text }]}>{t("common.back")}</Text>
                  </TouchableOpacity>
                ) : (
                  <View />
                )}
                <TouchableOpacity
                  onPress={handleNext}
                  style={[styles.nextBtn, { backgroundColor: theme.accent }]}
                  activeOpacity={0.85}
                >
                  <Text style={styles.nextText}>{shownIndex === steps.length - 1 ? t("tour.letsBegin") : t("common.forward")}</Text>
                  {shownIndex !== steps.length - 1 && <ChevronRight size={16} color="#FFFFFF" />}
                </TouchableOpacity>
              </View>
            </View>

            {arrowX !== null && layout && layout.placement !== "center" && (
              <View
                pointerEvents="none"
                style={[
                  styles.arrow,
                  { left: arrowX - ARROW_SIZE / 2, backgroundColor: cardBg, borderColor: cardBorder },
                  layout.placement === "bottom"
                    ? { top: -ARROW_SIZE / 2 + 1, borderTopWidth: 1, borderLeftWidth: 1 }
                    : { bottom: -ARROW_SIZE / 2 + 1, borderBottomWidth: 1, borderRightWidth: 1 },
                ]}
              />
            )}
          </Animated.View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  cardWrapper: {
    position: "absolute",
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  arrow: {
    position: "absolute",
    width: ARROW_SIZE,
    height: ARROW_SIZE,
    transform: [{ rotate: "45deg" }],
    elevation: 12,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  dots: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  counterText: {
    fontSize: 11,
    fontWeight: "600",
    marginLeft: 6,
  },
  skipBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  skipText: {
    fontSize: 12,
    fontWeight: "700",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: "800",
  },
  description: {
    fontSize: 13.5,
    lineHeight: 20,
  },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
  },
  prevBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 2,
  },
  prevText: {
    fontSize: 13,
    fontWeight: "600",
  },
  nextBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 14,
    gap: 4,
  },
  nextText: {
    color: "#FFFFFF",
    fontSize: 13.5,
    fontWeight: "700",
  },
});
