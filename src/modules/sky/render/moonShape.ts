export interface MoonShape {
  /** 'none': yalnızca karanlık disk; 'full': tüm disk aydınlık; 'partial': `litPath` çizilir */
  kind: "none" | "full" | "partial";
  litOnRight: boolean;
  /** Sonlandırıcı (gölge sınırı) yarı-elipsinin yatay yarıçapı */
  terminatorRx: number;
  litPath: string | null;
}

const NEW_MOON_LIMIT = 0.005;

/**
 * Evre çizimi: aydınlık bölge bir yanda diskin yarım çemberi, öbür yanda sonlandırıcı yarı-elipstir,
 * rx = r·|1 − 2k|. Harita her yerde aynı yöndedir (kuzey üstte, doğu solda): büyüyen Ay'ın Güneş'e dönük yanı
 * batı, yani sağdır; küçülende doğu, yani sol. Bu, gözlemcinin yarım küresine bağlı değildir.
 * Basitleştirme: Ay diski gerçek konum açısıyla döndürülmez, yüksek enlemde gerçek eğim farklı olabilir.
 */
export function moonShape(cx: number, cy: number, r: number, illumination: number, waxing: boolean): MoonShape {
  const k = Math.min(1, Math.max(0, illumination));
  const litOnRight = waxing;
  const terminatorRx = r * Math.abs(1 - 2 * k);
  if (k <= NEW_MOON_LIMIT) return { kind: "none", litOnRight, terminatorRx, litPath: null };
  if (k >= 1 - NEW_MOON_LIMIT) return { kind: "full", litOnRight, terminatorRx, litPath: null };

  const top = `${cx} ${cy - r}`;
  const bottom = `${cx} ${cy + r}`;
  const crescent = k < 0.5;
  // y aşağı eksende sweep 1 saat yönüdür. Yay üstten alta aydınlık kenardan iner, sonlandırıcıdan döner.
  const limbSweep = litOnRight ? 1 : 0;
  const terminatorSweep = crescent === litOnRight ? 0 : 1;
  // Yarım evrede rx = 0: yay yerine düz çizgi, platformların rx=0 yay davranışına bağlı kalmamak için
  const back = terminatorRx < 1e-3 ? `L ${top}` : `A ${terminatorRx} ${r} 0 0 ${terminatorSweep} ${top}`;
  return { kind: "partial", litOnRight, terminatorRx, litPath: `M ${top} A ${r} ${r} 0 0 ${limbSweep} ${bottom} ${back} Z` };
}
