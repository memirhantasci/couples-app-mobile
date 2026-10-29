import i18n from "@/lib/i18n";
import type { ParseKeys } from "i18next";

/**
 * Güneş Sistemi cisimlerinin görünen adları. `catalog_code` (SOL-SUN …) sabit kimliktir ve çevrilmez;
 * yalnızca ekranda gösterilen ad geçerli dile göre çözülür.
 */
export const SOLAR_NAME_KEYS: Readonly<Record<string, ParseKeys>> = {
  "SOL-SUN": "stars.solar.sun",
  "SOL-MERCURY": "stars.solar.mercury",
  "SOL-VENUS": "stars.solar.venus",
  "SOL-EARTH": "stars.solar.earth",
  "SOL-MOON": "stars.solar.moon",
  "SOL-MARS": "stars.solar.mars",
  "SOL-JUPITER": "stars.solar.jupiter",
  "SOL-SATURN": "stars.solar.saturn",
  "SOL-URANUS": "stars.solar.uranus",
  "SOL-NEPTUNE": "stars.solar.neptune",
  "SOL-PLUTO": "stars.solar.pluto",
};

/** Katalog kodu bir Güneş Sistemi cismine aitse geçerli dildeki adı, değilse null */
export function solarBodyName(catalogCode: string | null | undefined): string | null {
  const key = catalogCode ? SOLAR_NAME_KEYS[catalogCode] : undefined;
  return key ? i18n.t(key) : null;
}
