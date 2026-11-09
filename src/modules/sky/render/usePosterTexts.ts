import { useTranslation } from "react-i18next";
import type { SkyMoon } from "../astronomy/types";
import type { SkyChartLabels } from "./SkyChart";

/** Kartların ortak metinleri: yön harfleri ve Ay evresi satırı. */
export function usePosterTexts(moon: SkyMoon): { chartLabels: SkyChartLabels; moonLine: string } {
  const { t } = useTranslation();
  return {
    chartLabels: {
      N: t("sky.poster.direction.N"),
      E: t("sky.poster.direction.E"),
      S: t("sky.poster.direction.S"),
      W: t("sky.poster.direction.W"),
    },
    moonLine: t("sky.poster.moonLine", {
      phase: t(`sky.poster.moonPhase.${moon.phaseName}`),
      percent: Math.round(moon.illumination * 100),
    }),
  };
}
