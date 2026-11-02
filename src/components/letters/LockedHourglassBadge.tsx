import { memo, useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Path, Rect } from "react-native-svg";
import { useTheme } from "@/context/ThemeContext";
import { useFocusClock } from "@/hooks/useFocusClock";

interface LockedHourglassBadgeProps {
  /** Rozetteki yazı (ör. "Kilitli • 12 Kas 2026"). */
  label: string;
  /** Mektubun yazıldığı andan açılışına kadar geçen zamanın oranı (0..1): alt haznedeki kum bu kadar birikir. */
  progress: number;
}

const HG_W = 16;
const HG_H = 22;
/** Her saniye boğazdan bir kum tanesi düşer. */
const GRAIN_MS = 1000;
const FILL_MS = 1600;

/**
 * Tarihi gelmemiş gelen mektubun rozeti: düz asma kilit yerine kumu süzülen minik bir kum saati.
 * Üst hazne mektubun açılışı yaklaştıkça boşalır, alt haznede kum birikir.
 */
export const LockedHourglassBadge = memo(function LockedHourglassBadge({ label, progress }: LockedHourglassBadgeProps) {
  const { theme } = useTheme();
  const amber = theme.isLight ? "#B45309" : "#f59e0b";

  return (
    <View style={styles.badge}>
      <MagicHourglass progress={progress} frame={amber} sand={theme.isLight ? "#E0A526" : "#F5C563"} />
      <Text style={[styles.badgeText, { color: amber }]}>{label}</Text>
    </View>
  );
});

function MagicHourglass({ progress, frame, sand }: { progress: number; frame: string; sand: string }) {
  const reduceMotion = useReducedMotion();
  const fill = useSharedValue(reduceMotion ? progress : 0);
  const grain = useFocusClock(GRAIN_MS, !reduceMotion);

  // Kum, rozet belirirken yavaşça bugünkü seviyesine akar
  useEffect(() => {
    fill.set(reduceMotion ? progress : withTiming(progress, { duration: FILL_MS, easing: Easing.out(Easing.quad) }));
  }, [progress, reduceMotion, fill]);

  const topSandStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: 1 - 0.85 * fill.get() }] }));
  const pileStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: 0.2 + 0.8 * fill.get() }] }));

  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.hourglass}>
      <Animated.View style={[styles.layer, styles.topSandOrigin, topSandStyle]}>
        <Svg width={HG_W} height={HG_H} viewBox={`0 0 ${HG_W} ${HG_H}`}>
          <Path d="M4.4 5.2 H11.6 C11.3 7.6 9 9.2 8 10.8 C7 9.2 4.7 7.6 4.4 5.2 Z" fill={sand} />
        </Svg>
      </Animated.View>
      <Animated.View style={[styles.layer, styles.pileOrigin, pileStyle]}>
        <Svg width={HG_W} height={HG_H} viewBox={`0 0 ${HG_W} ${HG_H}`}>
          <Path d="M4.2 19.4 C5.2 16.6 6.8 15.4 8 15.2 C9.2 15.4 10.8 16.6 11.8 19.4 Z" fill={sand} />
        </Svg>
      </Animated.View>
      <View style={[styles.stream, { backgroundColor: sand }]} />
      {reduceMotion ? null : <FallingGrain clock={grain} color={sand} />}
      <Svg width={HG_W} height={HG_H} viewBox={`0 0 ${HG_W} ${HG_H}`} style={styles.layer}>
        <Path
          d="M3.2 2.4 C3.2 7.4 6.6 9.2 7.2 11 C6.6 12.8 3.2 14.6 3.2 19.6 H12.8 C12.8 14.6 9.4 12.8 8.8 11 C9.4 9.2 12.8 7.4 12.8 2.4 Z"
          fill={frame}
          fillOpacity={0.1}
          stroke={frame}
          strokeWidth={1}
          strokeLinejoin="round"
        />
        <Rect x={1} y={0} width={14} height={2.4} rx={1.2} fill={frame} />
        <Rect x={1} y={19.6} width={14} height={2.4} rx={1.2} fill={frame} />
      </Svg>
    </View>
  );
}

/** Boğazdan alt hazneye süzülen tek kum tanesi; dibe yaklaşınca kum tepesine karışıp söner. */
function FallingGrain({ clock, color }: { clock: SharedValue<number>; color: string }) {
  const style = useAnimatedStyle(() => {
    const p = clock.get();
    return {
      opacity: p < 0.8 ? 1 : (1 - p) * 5,
      transform: [{ translateY: 5.5 * p }],
    };
  });
  return <Animated.View style={[styles.grain, { backgroundColor: color }, style]} />;
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(245,158,11,0.12)",
    paddingLeft: 6,
    paddingRight: 9,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.25)",
  },
  badgeText: {
    fontSize: 11.5,
    fontFamily: "Inter_600SemiBold",
  },
  hourglass: {
    width: HG_W,
    height: HG_H,
  },
  layer: {
    position: "absolute",
    top: 0,
    left: 0,
  },
  // Üst kum boğaza doğru, alt kum tabandan yukarı ölçeklenir
  topSandOrigin: {
    transformOrigin: "50% 49%",
  },
  pileOrigin: {
    transformOrigin: "50% 88%",
  },
  stream: {
    position: "absolute",
    left: HG_W / 2 - 0.3,
    top: 10.8,
    width: 0.6,
    height: 5,
    opacity: 0.55,
  },
  grain: {
    position: "absolute",
    left: HG_W / 2 - 0.65,
    top: 10.4,
    width: 1.3,
    height: 2.2,
    borderRadius: 0.65,
  },
});
