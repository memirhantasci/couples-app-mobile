/**
 * @file skySectors.data.ts
 * @module modules/stars/config
 * @description 24 Astronomik Gökyüzü Sektörünün Statik Yapılandırması (Single Source of Truth).
 *
 * Bu dosya:
 * 1. Sektör isimleri, Türkçe açıklamaları, sembolleri, tema renkleri ve nebula paletlerini içerir.
 *    (Bu veriler ASLA veritabanında tutulmaz; görsel/metinsel değişiklikler migration gerektirmez.)
 * 2. Koordinat sınırları (bounds) veritabanındaki sky_sectors tablosundaki min_ra/max_ra/min_dec/max_dec
 *    ile birebir aynıdır. Geometrik sınırlar IAU standardıdır ve pratikte hiç değişmez.
 * 3. getSectorByCoords() helper'ı, SQL'deki deterministik tie-break ve RA-dilim fallback
 *    kurallarını %100 birebir yansıtır. DB ile HUD arasında mutlak senkronizasyon garanti edilir.
 */

import type { ParseKeys } from 'i18next';

// ============================================================================
// TİP TANIMLAMALARI
// ============================================================================

export interface SectorBounds {
  readonly minRa: number;
  readonly maxRa: number;
  readonly minDec: number;
  readonly maxDec: number;
}

export interface SectorConfig {
  readonly id: string;
  readonly code3: string;
  readonly nameKey: ParseKeys;
  readonly latinName: string;
  readonly symbol: string;
  readonly displayOrder: number;
  readonly bounds: SectorBounds;
  readonly center: { readonly ra: number; readonly dec: number };
  readonly themeColor: string;
  readonly nebulaPalette: readonly [string, string];
  readonly descriptionKey: ParseKeys;
  readonly mythologyNoteKey: ParseKeys;
}


// ============================================================================
// 24 SEKTÖR YAPILANDIRMASI (Kalibre Edilmiş Sınırlar — DB İle Birebir)
// ============================================================================

export const SKY_SECTORS: Record<string, SectorConfig> = {
  orion: {
    id: 'orion',
    code3: 'ORI',
    nameKey: 'stars.sectors.orion.name',
    latinName: 'Orion',
    symbol: '🏹',
    displayOrder: 1,
    bounds: { minRa: 60, maxRa: 90, minDec: -15, maxDec: 15 },
    center: { ra: 84.1, dec: -1.9 },
    themeColor: '#38BDF8',
    nebulaPalette: ['#0C4A6E', '#0284C7'],
    descriptionKey: 'stars.sectors.orion.description',
    mythologyNoteKey: 'stars.sectors.orion.mythology',
  },
  ursa_major: {
    id: 'ursa_major',
    code3: 'UMA',
    nameKey: 'stars.sectors.ursa_major.name',
    latinName: 'Ursa Major',
    symbol: '🐻',
    displayOrder: 2,
    bounds: { minRa: 120, maxRa: 210, minDec: 30, maxDec: 70 },
    center: { ra: 165.5, dec: 56.4 },
    themeColor: '#A78BFA',
    nebulaPalette: ['#4C1D95', '#7C3AED'],
    descriptionKey: 'stars.sectors.ursa_major.description',
    mythologyNoteKey: 'stars.sectors.ursa_major.mythology',
  },
  cassiopeia: {
    id: 'cassiopeia',
    code3: 'CAS',
    nameKey: 'stars.sectors.cassiopeia.name',
    latinName: 'Cassiopeia',
    symbol: '👑',
    displayOrder: 3,
    bounds: { minRa: 0, maxRa: 45, minDec: 50, maxDec: 75 },
    center: { ra: 14.2, dec: 60.7 },
    themeColor: '#F472B6',
    nebulaPalette: ['#831843', '#DB2777'],
    descriptionKey: 'stars.sectors.cassiopeia.description',
    mythologyNoteKey: 'stars.sectors.cassiopeia.mythology',
  },
  cygnus: {
    id: 'cygnus',
    code3: 'CYG',
    nameKey: 'stars.sectors.cygnus.name',
    latinName: 'Cygnus',
    symbol: '🦢',
    displayOrder: 4,
    bounds: { minRa: 280, maxRa: 325, minDec: 25, maxDec: 55 },
    center: { ra: 305.6, dec: 40.3 },
    themeColor: '#34D399',
    nebulaPalette: ['#064E3B', '#059669'],
    descriptionKey: 'stars.sectors.cygnus.description',
    mythologyNoteKey: 'stars.sectors.cygnus.mythology',
  },
  taurus: {
    id: 'taurus',
    code3: 'TAU',
    nameKey: 'stars.sectors.taurus.name',
    latinName: 'Taurus',
    symbol: '🐂',
    displayOrder: 5,
    bounds: { minRa: 50, maxRa: 85, minDec: 10, maxDec: 32 },
    center: { ra: 69.0, dec: 16.5 },
    themeColor: '#FB923C',
    nebulaPalette: ['#7C2D12', '#EA580C'],
    descriptionKey: 'stars.sectors.taurus.description',
    mythologyNoteKey: 'stars.sectors.taurus.mythology',
  },
  gemini: {
    id: 'gemini',
    code3: 'GEM',
    nameKey: 'stars.sectors.gemini.name',
    latinName: 'Gemini',
    symbol: '♊',
    displayOrder: 6,
    bounds: { minRa: 90, maxRa: 120, minDec: 10, maxDec: 35 },
    center: { ra: 113.7, dec: 28.0 },
    themeColor: '#FACC15',
    nebulaPalette: ['#713F12', '#CA8A04'],
    descriptionKey: 'stars.sectors.gemini.description',
    mythologyNoteKey: 'stars.sectors.gemini.mythology',
  },
  aries: {
    id: 'aries',
    code3: 'ARI',
    nameKey: 'stars.sectors.aries.name',
    latinName: 'Aries',
    symbol: '🐏',
    displayOrder: 7,
    bounds: { minRa: 25, maxRa: 55, minDec: 10, maxDec: 32 },
    center: { ra: 31.8, dec: 21.0 },
    themeColor: '#EF4444',
    nebulaPalette: ['#7F1D1D', '#DC2626'],
    descriptionKey: 'stars.sectors.aries.description',
    mythologyNoteKey: 'stars.sectors.aries.mythology',
  },
  cancer: {
    id: 'cancer',
    code3: 'CNC',
    nameKey: 'stars.sectors.cancer.name',
    latinName: 'Cancer',
    symbol: '🦀',
    displayOrder: 8,
    bounds: { minRa: 120, maxRa: 140, minDec: 5, maxDec: 33 },
    center: { ra: 130.0, dec: 20.0 },
    themeColor: '#94A3B8',
    nebulaPalette: ['#1E293B', '#475569'],
    descriptionKey: 'stars.sectors.cancer.description',
    mythologyNoteKey: 'stars.sectors.cancer.mythology',
  },
  leo: {
    id: 'leo',
    code3: 'LEO',
    nameKey: 'stars.sectors.leo.name',
    latinName: 'Leo',
    symbol: '🦁',
    displayOrder: 9,
    bounds: { minRa: 140, maxRa: 180, minDec: 0, maxDec: 35 },
    center: { ra: 152.1, dec: 12.0 },
    themeColor: '#F59E0B',
    nebulaPalette: ['#78350F', '#D97706'],
    descriptionKey: 'stars.sectors.leo.description',
    mythologyNoteKey: 'stars.sectors.leo.mythology',
  },
  virgo: {
    id: 'virgo',
    code3: 'VIR',
    nameKey: 'stars.sectors.virgo.name',
    latinName: 'Virgo',
    symbol: '🌾',
    displayOrder: 10,
    bounds: { minRa: 175, maxRa: 225, minDec: -20, maxDec: 15 },
    center: { ra: 201.3, dec: -11.2 },
    themeColor: '#A3E635',
    nebulaPalette: ['#365314', '#65A30D'],
    descriptionKey: 'stars.sectors.virgo.description',
    mythologyNoteKey: 'stars.sectors.virgo.mythology',
  },
  libra: {
    id: 'libra',
    code3: 'LIB',
    nameKey: 'stars.sectors.libra.name',
    latinName: 'Libra',
    symbol: '⚖️',
    displayOrder: 11,
    bounds: { minRa: 215, maxRa: 245, minDec: -30, maxDec: 0 },
    center: { ra: 229.2, dec: -15.0 },
    themeColor: '#06B6D4',
    nebulaPalette: ['#164E63', '#0891B2'],
    descriptionKey: 'stars.sectors.libra.description',
    mythologyNoteKey: 'stars.sectors.libra.mythology',
  },
  scorpius: {
    id: 'scorpius',
    code3: 'SCO',
    nameKey: 'stars.sectors.scorpius.name',
    latinName: 'Scorpius',
    symbol: '🦂',
    displayOrder: 12,
    bounds: { minRa: 235, maxRa: 265, minDec: -45, maxDec: -10 },
    center: { ra: 247.4, dec: -26.4 },
    themeColor: '#DC2626',
    nebulaPalette: ['#450A0A', '#B91C1C'],
    descriptionKey: 'stars.sectors.scorpius.description',
    mythologyNoteKey: 'stars.sectors.scorpius.mythology',
  },
  sagittarius: {
    id: 'sagittarius',
    code3: 'SGR',
    nameKey: 'stars.sectors.sagittarius.name',
    latinName: 'Sagittarius',
    symbol: '🏹',
    displayOrder: 13,
    bounds: { minRa: 265, maxRa: 305, minDec: -45, maxDec: -10 },
    center: { ra: 283.8, dec: -29.8 },
    themeColor: '#8B5CF6',
    nebulaPalette: ['#3B0764', '#7C3AED'],
    descriptionKey: 'stars.sectors.sagittarius.description',
    mythologyNoteKey: 'stars.sectors.sagittarius.mythology',
  },
  capricornus: {
    id: 'capricornus',
    code3: 'CAP',
    nameKey: 'stars.sectors.capricornus.name',
    latinName: 'Capricornus',
    symbol: '🐐',
    displayOrder: 14,
    bounds: { minRa: 300, maxRa: 330, minDec: -30, maxDec: -5 },
    center: { ra: 315.0, dec: -18.0 },
    themeColor: '#78716C',
    nebulaPalette: ['#292524', '#57534E'],
    descriptionKey: 'stars.sectors.capricornus.description',
    mythologyNoteKey: 'stars.sectors.capricornus.mythology',
  },
  aquarius: {
    id: 'aquarius',
    code3: 'AQR',
    nameKey: 'stars.sectors.aquarius.name',
    latinName: 'Aquarius',
    symbol: '🏺',
    displayOrder: 15,
    bounds: { minRa: 310, maxRa: 345, minDec: -25, maxDec: 6 },
    center: { ra: 334.0, dec: -10.0 },
    themeColor: '#2DD4BF',
    nebulaPalette: ['#134E4A', '#14B8A6'],
    descriptionKey: 'stars.sectors.aquarius.description',
    mythologyNoteKey: 'stars.sectors.aquarius.mythology',
  },
  pisces: {
    id: 'pisces',
    code3: 'PSC',
    nameKey: 'stars.sectors.pisces.name',
    latinName: 'Pisces',
    symbol: '🐟',
    displayOrder: 16,
    bounds: { minRa: 345, maxRa: 360, minDec: -5, maxDec: 8 },
    center: { ra: 352.5, dec: 1.5 },
    themeColor: '#818CF8',
    nebulaPalette: ['#312E81', '#6366F1'],
    descriptionKey: 'stars.sectors.pisces.description',
    mythologyNoteKey: 'stars.sectors.pisces.mythology',
  },
  pegasus: {
    id: 'pegasus',
    code3: 'PEG',
    nameKey: 'stars.sectors.pegasus.name',
    latinName: 'Pegasus',
    symbol: '🐴',
    displayOrder: 17,
    bounds: { minRa: 320, maxRa: 360, minDec: 8, maxDec: 36 },
    center: { ra: 346.0, dec: 15.2 },
    themeColor: '#E879F9',
    nebulaPalette: ['#701A75', '#C026D3'],
    descriptionKey: 'stars.sectors.pegasus.description',
    mythologyNoteKey: 'stars.sectors.pegasus.mythology',
  },
  andromeda: {
    id: 'andromeda',
    code3: 'AND',
    nameKey: 'stars.sectors.andromeda.name',
    latinName: 'Andromeda',
    symbol: '👸',
    displayOrder: 18,
    bounds: { minRa: 0, maxRa: 40, minDec: 22, maxDec: 48 },
    center: { ra: 10.0, dec: 41.3 },
    themeColor: '#FB7185',
    nebulaPalette: ['#881337', '#E11D48'],
    descriptionKey: 'stars.sectors.andromeda.description',
    mythologyNoteKey: 'stars.sectors.andromeda.mythology',
  },
  lyra: {
    id: 'lyra',
    code3: 'LYR',
    nameKey: 'stars.sectors.lyra.name',
    latinName: 'Lyra',
    symbol: '🎵',
    displayOrder: 19,
    bounds: { minRa: 275, maxRa: 295, minDec: 25, maxDec: 48 },
    center: { ra: 279.2, dec: 38.8 },
    themeColor: '#60A5FA',
    nebulaPalette: ['#1E3A5F', '#3B82F6'],
    descriptionKey: 'stars.sectors.lyra.description',
    mythologyNoteKey: 'stars.sectors.lyra.mythology',
  },
  aquila: {
    id: 'aquila',
    code3: 'AQL',
    nameKey: 'stars.sectors.aquila.name',
    latinName: 'Aquila',
    symbol: '🦅',
    displayOrder: 20,
    bounds: { minRa: 285, maxRa: 305, minDec: -10, maxDec: 20 },
    center: { ra: 297.7, dec: 8.9 },
    themeColor: '#FBBF24',
    nebulaPalette: ['#78350F', '#D97706'],
    descriptionKey: 'stars.sectors.aquila.description',
    mythologyNoteKey: 'stars.sectors.aquila.mythology',
  },
  canis_major: {
    id: 'canis_major',
    code3: 'CMA',
    nameKey: 'stars.sectors.canis_major.name',
    latinName: 'Canis Major',
    symbol: '🐕',
    displayOrder: 21,
    bounds: { minRa: 95, maxRa: 115, minDec: -35, maxDec: -10 },
    center: { ra: 101.3, dec: -16.7 },
    themeColor: '#38BDF8',
    nebulaPalette: ['#075985', '#0EA5E9'],
    descriptionKey: 'stars.sectors.canis_major.description',
    mythologyNoteKey: 'stars.sectors.canis_major.mythology',
  },
  centaurus: {
    id: 'centaurus',
    code3: 'CEN',
    nameKey: 'stars.sectors.centaurus.name',
    latinName: 'Centaurus',
    symbol: '🐴',
    displayOrder: 22,
    bounds: { minRa: 170, maxRa: 220, minDec: -65, maxDec: -30 },
    center: { ra: 219.9, dec: -60.8 },
    themeColor: '#14B8A6',
    nebulaPalette: ['#042F2E', '#0D9488'],
    descriptionKey: 'stars.sectors.centaurus.description',
    mythologyNoteKey: 'stars.sectors.centaurus.mythology',
  },
  crux: {
    id: 'crux',
    code3: 'CRU',
    nameKey: 'stars.sectors.crux.name',
    latinName: 'Crux',
    symbol: '✝️',
    displayOrder: 23,
    bounds: { minRa: 180, maxRa: 200, minDec: -65, maxDec: -55 },
    center: { ra: 186.6, dec: -63.1 },
    themeColor: '#F472B6',
    nebulaPalette: ['#9D174D', '#EC4899'],
    descriptionKey: 'stars.sectors.crux.description',
    mythologyNoteKey: 'stars.sectors.crux.mythology',
  },
  phoenix: {
    id: 'phoenix',
    code3: 'PHE',
    nameKey: 'stars.sectors.phoenix.name',
    latinName: 'Phoenix',
    symbol: '🔥',
    displayOrder: 24,
    bounds: { minRa: 0, maxRa: 35, minDec: -60, maxDec: -40 },
    center: { ra: 17.5, dec: -50.0 },
    themeColor: '#F97316',
    nebulaPalette: ['#7C2D12', '#EA580C'],
    descriptionKey: 'stars.sectors.phoenix.description',
    mythologyNoteKey: 'stars.sectors.phoenix.mythology',
  },
};

/**
 * Hızlı erişim için sektör dizisi (display_order sıralı).
 */
export const SKY_SECTORS_LIST: SectorConfig[] = Object.values(SKY_SECTORS).sort(
  (a, b) => a.displayOrder - b.displayOrder,
);


// ============================================================================
// RA-DİLİM FALLBACK DİZİSİ (SQL İLE BİREBİR AYNI)
// ============================================================================

/**
 * SQL'deki `CASE FLOOR(ra / 15)::int` tablosunun birebir aynası.
 * Hiçbir sektör kutusuna düşmeyen koordinatlar için kullanılır.
 * İndeks = FLOOR(ra / 15), Değer = sektör id'si.
 */
export const RA_SLICE_FALLBACK: readonly string[] = [
  'pisces',      // 0  (0° - 15°)
  'aries',       // 1  (15° - 30°)
  'aries',       // 2  (30° - 45°)
  'taurus',      // 3  (45° - 60°)
  'taurus',      // 4  (60° - 75°)
  'orion',       // 5  (75° - 90°)
  'gemini',      // 6  (90° - 105°)
  'canis_major', // 7  (105° - 120°)
  'cancer',      // 8  (120° - 135°)
  'cancer',      // 9  (135° - 150°)
  'leo',         // 10 (150° - 165°)
  'leo',         // 11 (165° - 180°)
  'virgo',       // 12 (180° - 195°)
  'virgo',       // 13 (195° - 210°)
  'libra',       // 14 (210° - 225°)
  'libra',       // 15 (225° - 240°)
  'scorpius',    // 16 (240° - 255°)
  'sagittarius', // 17 (255° - 270°)
  'sagittarius', // 18 (270° - 285°)
  'aquila',      // 19 (285° - 300°)
  'cygnus',      // 20 (300° - 315°)
  'capricornus', // 21 (315° - 330°)
  'aquarius',    // 22 (330° - 345°)
  'pegasus',     // 23 (345° - 360°)
] as const;


// ============================================================================
// DETERMİNİSTİK KOORDINAT ÇÖZÜCÜ (SQL İLE %100 SENKRON)
// ============================================================================

/**
 * Verilen gökyüzü koordinatı (RA, Dec) için doğru sektörü belirler.
 *
 * 3 kademeli akış:
 * 1. Bounding box eşleşmesi (tek eşleşme → direkt dön).
 * 2. Çoklu eşleşme → Deterministik Tie-Break:
 *    SQL ile birebir aynı exact float sıralama:
 *    `ORDER BY ((max_ra - min_ra) * (max_dec - min_dec)) ASC, display_order ASC`
 *    (Epsilon toleransı yok — SQL'deki ham float karşılaştırmasıyla aynı)
 * 3. Kutu dışı → RA_SLICE_FALLBACK[floor(ra / 15)] ile SQL fallback tablosu aynılanır.
 *
 * Dönüş: Her zaman geçerli bir SectorConfig — null ASLA dönmez.
 */
export function getSectorByCoords(ra: number, dec: number): SectorConfig {
  const normalizedRa = ((ra % 360) + 360) % 360;
  const matches: SectorConfig[] = [];

  for (const sector of SKY_SECTORS_LIST) {
    if (
      normalizedRa >= sector.bounds.minRa &&
      normalizedRa <= sector.bounds.maxRa &&
      dec >= sector.bounds.minDec &&
      dec <= sector.bounds.maxDec
    ) {
      matches.push(sector);
    }
  }

  // Kademe 1: Tek kutu eşleşmesi
  if (matches.length === 1) return matches[0];

  // Kademe 2: Çoklu eşleşme — SQL ile birebir exact float tie-break
  if (matches.length > 1) {
    matches.sort((a, b) => {
      const areaA = (a.bounds.maxRa - a.bounds.minRa) * (a.bounds.maxDec - a.bounds.minDec);
      const areaB = (b.bounds.maxRa - b.bounds.minRa) * (b.bounds.maxDec - b.bounds.minDec);
      if (areaA !== areaB) {
        return areaA - areaB; // Küçük alan kazanır (en spesifik sektör)
      }
      return a.displayOrder - b.displayOrder;
    });
    return matches[0];
  }

  // Kademe 3: Hiçbir kutuya düşmedi — SQL fallback tablosu ile birebir aynı sektör
  const sliceIndex = Math.min(23, Math.max(0, Math.floor(normalizedRa / 15.0)));
  const fallbackSectorId = RA_SLICE_FALLBACK[sliceIndex] || 'pegasus';
  return SKY_SECTORS[fallbackSectorId] || SKY_SECTORS.orion;
}
