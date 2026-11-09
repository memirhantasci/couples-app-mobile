import type { RefObject } from "react";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { GOLD } from "@/components/share/storyDecor";
import type { SkyResult } from "../astronomy/types";
import { PRINT_CANVAS, PRINT_ROWS, printPosterLayout } from "./posterLayout";
import { cleanLine, PosterLine } from "./PosterLine";
import { SkyChart, type SkyChartHighlight } from "./SkyChart";
import { usePosterTexts } from "./usePosterTexts";

export interface NightSkyPrintLayoutProps {
  /** Genişlik (gerçek ölçü); yükseklik 3:4 oranından türetilir. Dışa aktarma boyutunu Bölüm 5 belirler. */
  width: number;
  cardRef: RefObject<View | null>;
  sky: SkyResult;
  /** Hazır biçimli "14 Şubat 2025 · 22:00" */
  dateLine: string;
  placeName?: string | null;
  names?: string | null;
  /** Verilmezse varsayılan başlık */
  title?: string | null;
  subtitle?: string | null;
  highlight?: SkyChartHighlight;
  /** "Yıldızımız" cümlesi; boşsa satır kalkar */
  starLine?: string | null;
  southern?: boolean;
}

/** 3:4 baskı düzeni (Premium): indirme çağrısı yok, altta yalnızca küçük veri atfı. */
export function NightSkyPrintLayout({ width, cardRef, sky, dateLine, placeName, names, title, subtitle, highlight, starLine, southern }: NightSkyPrintLayoutProps) {
  const { t } = useTranslation();
  const { chartLabels, moonLine } = usePosterTexts(sky.moon);
  const place = cleanLine(placeName);
  const coupleNames = cleanLine(names);
  const subtitleLine = cleanLine(subtitle);
  const star = cleanLine(starLine);
  const layout = printPosterLayout({ hasSubtitle: Boolean(subtitleLine), hasPlace: Boolean(place), hasNames: Boolean(coupleNames), hasStarLine: Boolean(star) });
  const s = (units: number) => (units * width) / PRINT_CANVAS.width;
  const height = (width * PRINT_CANVAS.height) / PRINT_CANVAS.width;
  const lineWidth = s(layout.contentWidth);
  const rows = PRINT_ROWS;

  return (
    <View ref={cardRef} collapsable={false} style={{ width, height, backgroundColor: "#0A0A0C" }}>
      <LinearGradient colors={["#0A0A0C", "#0E0D1E", "#160B1E"]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      {/* Çerçeve View: react-native-svg Android'de tuval boyunda ayrı bitmap ayırır, baskı boyunda ~30 MB boşa giderdi */}
      <View pointerEvents="none" style={{ position: "absolute", left: s(10), top: s(10), right: s(10), bottom: s(10), borderRadius: s(6), borderWidth: s(0.8), borderColor: "rgba(226, 184, 92, 0.55)" }} />
      <View pointerEvents="none" style={{ position: "absolute", left: s(14), top: s(14), right: s(14), bottom: s(14), borderRadius: s(4), borderWidth: s(0.5), borderColor: "rgba(226, 184, 92, 0.2)" }} />
      <View style={{ flex: 1, alignItems: "center", paddingTop: s(PRINT_CANVAS.paddingTop), paddingBottom: s(PRINT_CANVAS.paddingBottom) }}>
        <PosterLine width={lineWidth} height={s(rows.title.height)} marginTop={s(rows.title.marginTop)} fontSize={s(24)} fontFamily="PlayfairDisplay_700Bold" color="#FFFFFF">
          {cleanLine(title) ?? t("sky.poster.defaultTitle")}
        </PosterLine>
        {subtitleLine ? (
          <PosterLine width={lineWidth} height={s(rows.subtitle.height)} marginTop={s(rows.subtitle.marginTop)} fontSize={s(10.5)} fontFamily="PlayfairDisplay_400Regular_Italic" color={GOLD.ink}>
            {subtitleLine}
          </PosterLine>
        ) : null}

        <View style={{ marginTop: s(rows.chart.marginTop) }}>
          <SkyChart sky={sky} size={s(layout.chartSize)} labels={chartLabels} highlight={highlight} southern={southern} />
        </View>

        <PosterLine width={lineWidth} height={s(rows.date.height)} marginTop={s(rows.date.marginTop)} fontSize={s(11)} fontFamily="Inter_600SemiBold" color={GOLD.ink} letterSpacing={s(0.5)}>
          {dateLine}
        </PosterLine>
        {place ? (
          <PosterLine width={lineWidth} height={s(rows.place.height)} marginTop={s(rows.place.marginTop)} fontSize={s(10)} fontFamily="Inter_500Medium" color="rgba(255, 255, 255, 0.78)">
            {place}
          </PosterLine>
        ) : null}
        {coupleNames ? (
          <PosterLine width={lineWidth} height={s(rows.names.height)} marginTop={s(rows.names.marginTop)} fontSize={s(15)} fontFamily="PlayfairDisplay_400Regular_Italic" color="#FFFFFF">
            {coupleNames}
          </PosterLine>
        ) : null}
        <PosterLine width={lineWidth} height={s(rows.moon.height)} marginTop={s(rows.moon.marginTop)} fontSize={s(9)} fontFamily="Inter_500Medium" color={GOLD.soft}>
          {moonLine}
        </PosterLine>
        {star ? (
          <PosterLine width={lineWidth} height={s(rows.star.height)} marginTop={s(rows.star.marginTop)} fontSize={s(8.5)} fontFamily="Inter_500Medium" color={GOLD.ink}>
            {star}
          </PosterLine>
        ) : null}
        <PosterLine width={lineWidth} height={s(rows.attribution.height)} marginTop={s(rows.attribution.marginTop)} fontSize={s(6)} fontFamily="Inter_500Medium" color="rgba(255, 255, 255, 0.55)" minimumFontScale={0.7}>
          {t("sky.poster.attribution")}
        </PosterLine>
      </View>
    </View>
  );
}
