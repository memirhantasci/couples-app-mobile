import type { PurchasesPackage } from "react-native-purchases";

const DAYS_PER_UNIT: Record<string, number> = { DAY: 1, WEEK: 7, MONTH: 30, YEAR: 365 };

/**
 * Pakette ücretsiz deneme varsa gün sayısı (yoksa null). Mağaza yalnızca fiyatı 0 olan tanıtım
 * teklifini deneme sayar; indirimli ilk dönem ("ilk ay 10 TL") deneme değildir.
 */
export function freeTrialDays(pkg: PurchasesPackage | null | undefined): number | null {
  const intro = pkg?.product.introPrice;
  if (!intro || intro.price !== 0) return null;
  const unitDays = DAYS_PER_UNIT[intro.periodUnit];
  if (!unitDays) return null;
  const days = unitDays * intro.periodNumberOfUnits * Math.max(1, intro.cycles);
  return days > 0 ? days : null;
}

/** Satın alma düğmesinin metni: deneme hakkı varsa "N Gün Ücretsiz Dene", yoksa "Premium'a Geç". */
export function purchaseButtonLabel(pkg: PurchasesPackage | null | undefined): string {
  const days = freeTrialDays(pkg);
  return days ? `${days} Gün Ücretsiz Dene` : "Premium'a Geç";
}
