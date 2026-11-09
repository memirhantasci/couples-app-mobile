import { useMemo } from "react";
import { Text, View } from "react-native";
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from "react-native-svg";
import { GOLD } from "@/components/share/storyDecor";
import { SKY_STAR_NAMES } from "../data/skyStarNames.data";
import type { SkyResult } from "../astronomy/types";
import {
  CHART_BAND,
  CHART_CENTER,
  CHART_HORIZON_RADIUS,
  CHART_VIEWBOX,
  directionMarkers,
  toChartCoordinate,
  type ChartDirection,
} from "./chartGeometry";
import { LABEL_FONT_SIZE, placeStarLabels, type LabelBox } from "./labelPlacement";
import { moonShape } from "./moonShape";
import { buildSegmentsPath, buildStarBatches } from "./starStyle";

/** Ay'ın viewBox yarıçapı: görünür olması için gerçek açısal boyundan büyük çizilir. */
const MOON_RADIUS = 26;
const HIGHLIGHT_RADIUS = 17;

export type SkyChartLabels = Record<ChartDirection, string>;

export interface SkyChartHighlight {
  hip: number;
  label?: string;
}

export interface SkyChartProps {
  sky: SkyResult;
  /** Kenar uzunluğu (gerçek ölçü, kart ölçeğinde) */
  size: number;
  /** Yön harfleri: N, E, S, W anahtarlarıyla */
  labels: SkyChartLabels;
  /** Altın halkayla çizilecek yıldız ("yıldızımız") */
  highlight?: SkyChartHighlight;
  /** Güney yarım kürede Ay'ın aydınlık yanı ters olur */
  southern?: boolean;
}

/**
 * Dairesel gökyüzü. Yazılar RN `Text` ile SVG'nin üstüne biner: react-native-svg `Text` özel yazı tipini
 * platformlar arasında tutarsız çizer. Skia bilerek yok: view-shot Skia tuvalini Android'de güvenilir yakalamaz.
 */
export function SkyChart({ sky, size, labels, highlight, southern = false }: SkyChartProps) {
  const unit = size / CHART_VIEWBOX;

  const { batches, segmentsPath, placedLabels, moon, highlightPoint } = useMemo(() => {
    const showMoon = sky.moon.aboveHorizon;
    const moonUnit = (MOON_RADIUS * 1.25) / CHART_HORIZON_RADIUS;
    const obstacles: LabelBox[] = showMoon
      ? [{ left: sky.moon.x - moonUnit, right: sky.moon.x + moonUnit, top: sky.moon.y - moonUnit, bottom: sky.moon.y + moonUnit }]
      : [];
    const highlighted = highlight ? sky.stars.find((star) => star.hip === highlight.hip) : undefined;
    const moonX = toChartCoordinate(sky.moon.x);
    const moonY = toChartCoordinate(sky.moon.y);
    return {
      batches: buildStarBatches(sky.stars),
      segmentsPath: buildSegmentsPath(sky.segments),
      placedLabels: placeStarLabels(sky.stars, SKY_STAR_NAMES, { obstacles, priority: highlight }),
      moon: showMoon ? { x: moonX, y: moonY, shape: moonShape(moonX, moonY, MOON_RADIUS, sky.moon.illumination, sky.moon.waxing, southern) } : null,
      highlightPoint: highlighted ? { x: toChartCoordinate(highlighted.x), y: toChartCoordinate(highlighted.y) } : null,
    };
  }, [sky, highlight, southern]);

  const labelFontSize = LABEL_FONT_SIZE * CHART_HORIZON_RADIUS * unit;
  const directionFontSize = CHART_BAND * 0.68 * unit;
  const directionBox = CHART_BAND * unit;

  return (
    <View style={{ width: size, height: size }} pointerEvents="none">
      <Svg width={size} height={size} viewBox={`0 0 ${CHART_VIEWBOX} ${CHART_VIEWBOX}`}>
        <Defs>
          <RadialGradient id="skyDisc" cx={CHART_CENTER} cy={CHART_CENTER} r={CHART_HORIZON_RADIUS} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#141A3A" />
            <Stop offset="0.75" stopColor="#0D1029" />
            <Stop offset="1" stopColor="#080A1A" />
          </RadialGradient>
        </Defs>
        <Circle cx={CHART_CENTER} cy={CHART_CENTER} r={CHART_HORIZON_RADIUS} fill="url(#skyDisc)" />
        {segmentsPath ? <Path d={segmentsPath} fill="none" stroke={GOLD.light} strokeOpacity={0.42} strokeWidth={1.5} strokeLinecap="round" /> : null}
        {batches.map((batch) => (
          <Path key={batch.key} d={batch.d} fill={batch.fill} opacity={batch.opacity} />
        ))}
        {moon ? (
          <>
            <Circle cx={moon.x} cy={moon.y} r={MOON_RADIUS * 1.25} fill={GOLD.light} opacity={0.1} />
            <Circle cx={moon.x} cy={moon.y} r={MOON_RADIUS} fill={moon.shape.kind === "full" ? "#F6EFD9" : "#2A2F45"} />
            {moon.shape.litPath ? <Path d={moon.shape.litPath} fill="#F6EFD9" /> : null}
          </>
        ) : null}
        {highlightPoint ? (
          <>
            <Circle cx={highlightPoint.x} cy={highlightPoint.y} r={HIGHLIGHT_RADIUS} fill="none" stroke={GOLD.base} strokeWidth={3} />
            <Circle cx={highlightPoint.x} cy={highlightPoint.y} r={HIGHLIGHT_RADIUS * 1.5} fill="none" stroke={GOLD.base} strokeOpacity={0.4} strokeWidth={1.5} />
          </>
        ) : null}
        <Circle cx={CHART_CENTER} cy={CHART_CENTER} r={CHART_HORIZON_RADIUS} fill="none" stroke={GOLD.base} strokeOpacity={0.85} strokeWidth={2.4} />
        <Circle cx={CHART_CENTER} cy={CHART_CENTER} r={CHART_HORIZON_RADIUS + 9} fill="none" stroke={GOLD.base} strokeOpacity={0.28} strokeWidth={1.2} />
      </Svg>

      {placedLabels.map((label) => (
        <Text
          key={label.hip}
          allowFontScaling={false}
          numberOfLines={1}
          style={{
            position: "absolute",
            left: toChartCoordinate(label.left) * unit,
            top: toChartCoordinate(label.top) * unit,
            width: (label.right - label.left) * CHART_HORIZON_RADIUS * unit,
            height: (label.bottom - label.top) * CHART_HORIZON_RADIUS * unit,
            lineHeight: (label.bottom - label.top) * CHART_HORIZON_RADIUS * unit,
            fontSize: labelFontSize,
            fontFamily: label.hip === highlight?.hip ? "Inter_700Bold" : "Inter_500Medium",
            color: label.hip === highlight?.hip ? GOLD.ink : "rgba(255, 255, 255, 0.82)",
            textAlign: label.side === "right" ? "left" : "right",
            includeFontPadding: false,
          }}
        >
          {label.text}
        </Text>
      ))}

      {directionMarkers().map((marker) => (
        <Text
          key={marker.direction}
          allowFontScaling={false}
          numberOfLines={1}
          style={{
            position: "absolute",
            left: marker.x * unit - directionBox / 2,
            top: marker.y * unit - directionBox / 2,
            width: directionBox,
            height: directionBox,
            lineHeight: directionBox,
            fontSize: directionFontSize,
            fontFamily: "Inter_700Bold",
            color: GOLD.ink,
            textAlign: "center",
            includeFontPadding: false,
          }}
        >
          {labels[marker.direction]}
        </Text>
      ))}
    </View>
  );
}
