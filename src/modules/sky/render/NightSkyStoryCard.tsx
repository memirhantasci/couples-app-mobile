import type { RefObject } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { StoryCard, type StoryTone } from "@/components/share/StoryCard";
import { GOLD, GoldKicker } from "@/components/share/storyDecor";
import type { SkyResult } from "../astronomy/types";
import { STORY_ROWS, storyPosterLayout } from "./posterLayout";
import { cleanLine, PosterLine } from "./PosterLine";
import { SkyChart, type SkyChartHighlight } from "./SkyChart";
import { usePosterTexts } from "./usePosterTexts";

export interface NightSkyStoryCardProps {
  /** Ekranda kaplayacağı genişlik (dp) */
  width: number;
  /** Paylaşılırken görüntüsü alınan görünüm */
  cardRef: RefObject<View | null>;
  sky: SkyResult;
  /** Hazır biçimli "14 Şubat 2025 · 22:00" */
  dateLine: string;
  placeName?: string | null;
  /** "Emirhan & Elif"; boşsa satır kalkar, grafik büyür */
  names?: string | null;
  /** Verilmezse varsayılan başlık */
  title?: string | null;
  kicker?: string | null;
  highlight?: SkyChartHighlight;
  southern?: boolean;
  tone?: StoryTone;
}

/** 9:16 gece gökyüzü kartı. Altbilgi ve indirme çağrısı StoryCard'dandır. */
export function NightSkyStoryCard({ width, cardRef, sky, dateLine, placeName, names, title, kicker, highlight, southern, tone = "azure" }: NightSkyStoryCardProps) {
  const { t } = useTranslation();
  const { chartLabels, moonLine } = usePosterTexts(sky.moon);
  const place = cleanLine(placeName);
  const coupleNames = cleanLine(names);
  const layout = storyPosterLayout({ hasPlace: Boolean(place), hasNames: Boolean(coupleNames) });
  const rows = STORY_ROWS;

  return (
    <StoryCard width={width} cardRef={cardRef} tone={tone}>
      {(s) => {
        const lineWidth = s(layout.contentWidth);
        return (
          <View style={{ flex: 1, alignItems: "center" }}>
            <View style={{ height: s(rows.kicker.height), justifyContent: "center" }}>
              <GoldKicker s={s}>{cleanLine(kicker) ?? t("sky.poster.kicker")}</GoldKicker>
            </View>
            <PosterLine
              width={lineWidth}
              height={s(rows.title.height)}
              marginTop={s(rows.title.marginTop)}
              fontSize={s(25)}
              fontFamily="PlayfairDisplay_700Bold"
              color="#FFFFFF"
            >
              {cleanLine(title) ?? t("sky.poster.defaultTitle")}
            </PosterLine>

            <View style={{ marginTop: s(rows.chart.marginTop) }}>
              <SkyChart sky={sky} size={s(layout.chartSize)} labels={chartLabels} highlight={highlight} southern={southern} />
            </View>

            <PosterLine width={lineWidth} height={s(rows.date.height)} marginTop={s(rows.date.marginTop)} fontSize={s(12)} fontFamily="Inter_600SemiBold" color={GOLD.ink} letterSpacing={s(0.5)}>
              {dateLine}
            </PosterLine>
            {place ? (
              <PosterLine width={lineWidth} height={s(rows.place.height)} marginTop={s(rows.place.marginTop)} fontSize={s(11)} fontFamily="Inter_500Medium" color="rgba(255, 255, 255, 0.78)">
                {place}
              </PosterLine>
            ) : null}
            {coupleNames ? (
              <PosterLine width={lineWidth} height={s(rows.names.height)} marginTop={s(rows.names.marginTop)} fontSize={s(16)} fontFamily="PlayfairDisplay_400Regular_Italic" color="#FFFFFF">
                {coupleNames}
              </PosterLine>
            ) : null}
            <PosterLine width={lineWidth} height={s(rows.moon.height)} marginTop={s(rows.moon.marginTop)} fontSize={s(10)} fontFamily="Inter_500Medium" color={GOLD.soft}>
              {moonLine}
            </PosterLine>
            <PosterLine width={lineWidth} height={s(rows.note.height)} marginTop={s(rows.note.marginTop)} fontSize={s(7.4)} fontFamily="Inter_500Medium" color="rgba(255, 255, 255, 0.5)">
              {t("sky.poster.realSkyNote")}
            </PosterLine>
          </View>
        );
      }}
    </StoryCard>
  );
}
