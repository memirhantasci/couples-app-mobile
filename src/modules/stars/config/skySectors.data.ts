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
  readonly name: string;
  readonly latinName: string;
  readonly symbol: string;
  readonly displayOrder: number;
  readonly bounds: SectorBounds;
  readonly center: { readonly ra: number; readonly dec: number };
  readonly themeColor: string;
  readonly nebulaPalette: readonly [string, string];
  readonly description: string;
  readonly mythologyNote: string;
}


// ============================================================================
// 24 SEKTÖR YAPILANDIRMASI (Kalibre Edilmiş Sınırlar — DB İle Birebir)
// ============================================================================

export const SKY_SECTORS: Record<string, SectorConfig> = {
  orion: {
    id: 'orion',
    code3: 'ORI',
    name: 'Avcı Sektörü',
    latinName: 'Orion',
    symbol: '🏹',
    displayOrder: 1,
    bounds: { minRa: 60, maxRa: 90, minDec: -15, maxDec: 15 },
    center: { ra: 84.1, dec: -1.9 },
    themeColor: '#38BDF8',
    nebulaPalette: ['#0C4A6E', '#0284C7'],
    description: 'Gökyüzünün en görkemli avcısı. Rigel ve Betelgeuse gibi süperdevlere ev sahipliği yapar.',
    mythologyNote: 'Mitolojide gök kubbenin koruyucu savaşçısı olarak kabul edilir.',
  },
  ursa_major: {
    id: 'ursa_major',
    code3: 'UMA',
    name: 'Büyük Ayı Sektörü',
    latinName: 'Ursa Major',
    symbol: '🐻',
    displayOrder: 2,
    bounds: { minRa: 120, maxRa: 210, minDec: 30, maxDec: 70 },
    center: { ra: 165.5, dec: 56.4 },
    themeColor: '#A78BFA',
    nebulaPalette: ['#4C1D95', '#7C3AED'],
    description: 'Yedi parlak yıldızdan oluşan Büyük Kepçe ile kuzey göğünün kılavuzudur.',
    mythologyNote: 'Kutup yıldızını bulduran sonsuz yön gösterici.',
  },
  cassiopeia: {
    id: 'cassiopeia',
    code3: 'CAS',
    name: 'Kraliçe Sektörü',
    latinName: 'Cassiopeia',
    symbol: '👑',
    displayOrder: 3,
    bounds: { minRa: 0, maxRa: 45, minDec: 50, maxDec: 75 },
    center: { ra: 14.2, dec: 60.7 },
    themeColor: '#F472B6',
    nebulaPalette: ['#831843', '#DB2777'],
    description: 'Gökyüzünde belirgin W şekliyle parıldayan kraliçe takımyıldızı.',
    mythologyNote: 'Güzelliğiyle övünen efsanevi Etiyopya Kraliçesi.',
  },
  cygnus: {
    id: 'cygnus',
    code3: 'CYG',
    name: 'Kuğu Sektörü',
    latinName: 'Cygnus',
    symbol: '🦢',
    displayOrder: 4,
    bounds: { minRa: 280, maxRa: 325, minDec: 25, maxDec: 55 },
    center: { ra: 305.6, dec: 40.3 },
    themeColor: '#34D399',
    nebulaPalette: ['#064E3B', '#059669'],
    description: 'Samanyolu kuşağı boyunca kanat çırpan zarif Kuğu.',
    mythologyNote: 'Kuzeyhaçı olarak da bilinen sadakat sembolü.',
  },
  taurus: {
    id: 'taurus',
    code3: 'TAU',
    name: 'Boğa Sektörü',
    latinName: 'Taurus',
    symbol: '🐂',
    displayOrder: 5,
    bounds: { minRa: 50, maxRa: 85, minDec: 10, maxDec: 32 },
    center: { ra: 69.0, dec: 16.5 },
    themeColor: '#FB923C',
    nebulaPalette: ['#7C2D12', '#EA580C'],
    description: 'Aldebaran\'ın kızıl ateşiyle yanan antik Boğa takımyıldızı.',
    mythologyNote: 'Zeus\'un Europa\'yı kaçırdığı beyaz boğa formunun gökyüzü yansıması.',
  },
  gemini: {
    id: 'gemini',
    code3: 'GEM',
    name: 'İkizler Sektörü',
    latinName: 'Gemini',
    symbol: '♊',
    displayOrder: 6,
    bounds: { minRa: 90, maxRa: 120, minDec: 10, maxDec: 35 },
    center: { ra: 113.7, dec: 28.0 },
    themeColor: '#FACC15',
    nebulaPalette: ['#713F12', '#CA8A04'],
    description: 'Castor ve Pollux ikiz yıldızlarıyla gökyüzündeki kardeşlik sembolü.',
    mythologyNote: 'Ayrılmaz ikizler — biri ölümlü, biri tanrısal.',
  },
  aries: {
    id: 'aries',
    code3: 'ARI',
    name: 'Koç Sektörü',
    latinName: 'Aries',
    symbol: '🐏',
    displayOrder: 7,
    bounds: { minRa: 25, maxRa: 55, minDec: 10, maxDec: 32 },
    center: { ra: 31.8, dec: 21.0 },
    themeColor: '#EF4444',
    nebulaPalette: ['#7F1D1D', '#DC2626'],
    description: 'İlkbahar ekinoksunun antik kapısı ve Altın Post\'un sahibi.',
    mythologyNote: 'Jason ve Arganotlar\'ın aradığı efsanevi Altın Post\'u taşıyan koç.',
  },
  cancer: {
    id: 'cancer',
    code3: 'CNC',
    name: 'Yengeç Sektörü',
    latinName: 'Cancer',
    symbol: '🦀',
    displayOrder: 8,
    bounds: { minRa: 120, maxRa: 140, minDec: 5, maxDec: 33 },
    center: { ra: 130.0, dec: 20.0 },
    themeColor: '#94A3B8',
    nebulaPalette: ['#1E293B', '#475569'],
    description: 'Gökyüzünün en sade ama en gizemli köşesi, Arı Kovanı kümelenmesin barındırır.',
    mythologyNote: 'Herkül ile savaşta savaşan küçük ama cesur yengeç.',
  },
  leo: {
    id: 'leo',
    code3: 'LEO',
    name: 'Aslan Sektörü',
    latinName: 'Leo',
    symbol: '🦁',
    displayOrder: 9,
    bounds: { minRa: 140, maxRa: 180, minDec: 0, maxDec: 35 },
    center: { ra: 152.1, dec: 12.0 },
    themeColor: '#F59E0B',
    nebulaPalette: ['#78350F', '#D97706'],
    description: 'Regulus\'un mavi ışığıyla taçlanan gökyüzünün kralı.',
    mythologyNote: 'Nemea Aslanı — Herkül\'ün ilk ve en zorlu görevi.',
  },
  virgo: {
    id: 'virgo',
    code3: 'VIR',
    name: 'Başak Sektörü',
    latinName: 'Virgo',
    symbol: '🌾',
    displayOrder: 10,
    bounds: { minRa: 175, maxRa: 225, minDec: -20, maxDec: 15 },
    center: { ra: 201.3, dec: -11.2 },
    themeColor: '#A3E635',
    nebulaPalette: ['#365314', '#65A30D'],
    description: 'Spica yıldızıyla parlayan bereket tanrıçası ve galaksi kümelerinin evi.',
    mythologyNote: 'Hasat mevsiminin habercisi, bereket ve adalet tanrıçası.',
  },
  libra: {
    id: 'libra',
    code3: 'LIB',
    name: 'Terazi Sektörü',
    latinName: 'Libra',
    symbol: '⚖️',
    displayOrder: 11,
    bounds: { minRa: 215, maxRa: 245, minDec: -30, maxDec: 0 },
    center: { ra: 229.2, dec: -15.0 },
    themeColor: '#06B6D4',
    nebulaPalette: ['#164E63', '#0891B2'],
    description: 'Gökyüzündeki adalet ve denge sembolü.',
    mythologyNote: 'Astrea\'nın dünyayı terk ederken bıraktığı adalet terazisi.',
  },
  scorpius: {
    id: 'scorpius',
    code3: 'SCO',
    name: 'Akrep Sektörü',
    latinName: 'Scorpius',
    symbol: '🦂',
    displayOrder: 12,
    bounds: { minRa: 235, maxRa: 265, minDec: -45, maxDec: -10 },
    center: { ra: 247.4, dec: -26.4 },
    themeColor: '#DC2626',
    nebulaPalette: ['#450A0A', '#B91C1C'],
    description: 'Antares\'in kırmızı kalbiyle atan gökyüzünün en tehlikeli avcısı.',
    mythologyNote: 'Orion\'u öldüren efsanevi akrep — ikisi aynı anda gökyüzünde görünmez.',
  },
  sagittarius: {
    id: 'sagittarius',
    code3: 'SGR',
    name: 'Yay Sektörü',
    latinName: 'Sagittarius',
    symbol: '🏹',
    displayOrder: 13,
    bounds: { minRa: 265, maxRa: 305, minDec: -45, maxDec: -10 },
    center: { ra: 283.8, dec: -29.8 },
    themeColor: '#8B5CF6',
    nebulaPalette: ['#3B0764', '#7C3AED'],
    description: 'Samanyolu\'nun merkezine ok atan okçu. Galaktik çekirdeğin kapısı.',
    mythologyNote: 'Bilge centaur Chiron\'un gökyüzündeki yansıması.',
  },
  capricornus: {
    id: 'capricornus',
    code3: 'CAP',
    name: 'Oğlak Sektörü',
    latinName: 'Capricornus',
    symbol: '🐐',
    displayOrder: 14,
    bounds: { minRa: 300, maxRa: 330, minDec: -30, maxDec: -5 },
    center: { ra: 315.0, dec: -18.0 },
    themeColor: '#78716C',
    nebulaPalette: ['#292524', '#57534E'],
    description: 'Kış gündönümünün kapısı, antik denizkızı-keçi hibridi.',
    mythologyNote: 'Pan\'ın balık kuyruğuna dönüşerek Typhon\'dan kaçışının anısı.',
  },
  aquarius: {
    id: 'aquarius',
    code3: 'AQR',
    name: 'Kova Sektörü',
    latinName: 'Aquarius',
    symbol: '🏺',
    displayOrder: 15,
    bounds: { minRa: 310, maxRa: 345, minDec: -25, maxDec: 6 },
    center: { ra: 334.0, dec: -10.0 },
    themeColor: '#2DD4BF',
    nebulaPalette: ['#134E4A', '#14B8A6'],
    description: 'Gökyüzünden yeryüzüne su döken su taşıyıcısı.',
    mythologyNote: 'Tanrıların su taşıyıcısı Ganymede\'nin gökyüzündeki yeri.',
  },
  pisces: {
    id: 'pisces',
    code3: 'PSC',
    name: 'Balık Sektörü',
    latinName: 'Pisces',
    symbol: '🐟',
    displayOrder: 16,
    bounds: { minRa: 345, maxRa: 360, minDec: -5, maxDec: 8 },
    center: { ra: 352.5, dec: 1.5 },
    themeColor: '#818CF8',
    nebulaPalette: ['#312E81', '#6366F1'],
    description: 'İlkbahar ekinoksunun modern kapısı, iki balığın kozmik dansı.',
    mythologyNote: 'Afrodit ve Eros\'un nehirdeki balıklara dönüşerek kurtulduğu an.',
  },
  pegasus: {
    id: 'pegasus',
    code3: 'PEG',
    name: 'Kanatlı At Sektörü',
    latinName: 'Pegasus',
    symbol: '🐴',
    displayOrder: 17,
    bounds: { minRa: 320, maxRa: 360, minDec: 8, maxDec: 36 },
    center: { ra: 346.0, dec: 15.2 },
    themeColor: '#E879F9',
    nebulaPalette: ['#701A75', '#C026D3'],
    description: 'Büyük Kare ile sonbahar göğünün en belirgin işareti.',
    mythologyNote: 'Medusa\'nın kanından doğan efsanevi kanatlı at.',
  },
  andromeda: {
    id: 'andromeda',
    code3: 'AND',
    name: 'Zincirli Prenses Sektörü',
    latinName: 'Andromeda',
    symbol: '👸',
    displayOrder: 18,
    bounds: { minRa: 0, maxRa: 40, minDec: 22, maxDec: 48 },
    center: { ra: 10.0, dec: 41.3 },
    themeColor: '#FB7185',
    nebulaPalette: ['#881337', '#E11D48'],
    description: 'En yakın büyük galaksimizin (M31) ev sahibi.',
    mythologyNote: 'Kayalara zincirlenip deniz canavarından kurtarılan prenses.',
  },
  lyra: {
    id: 'lyra',
    code3: 'LYR',
    name: 'Çalgı Sektörü',
    latinName: 'Lyra',
    symbol: '🎵',
    displayOrder: 19,
    bounds: { minRa: 275, maxRa: 295, minDec: 25, maxDec: 48 },
    center: { ra: 279.2, dec: 38.8 },
    themeColor: '#60A5FA',
    nebulaPalette: ['#1E3A5F', '#3B82F6'],
    description: 'Vega ile parıldayan yaz üçgeninin en parlak köşesi.',
    mythologyNote: 'Orpheus\'un büyüleyici lir müziğinin gökyüzündeki yankısı.',
  },
  aquila: {
    id: 'aquila',
    code3: 'AQL',
    name: 'Kartal Sektörü',
    latinName: 'Aquila',
    symbol: '🦅',
    displayOrder: 20,
    bounds: { minRa: 285, maxRa: 305, minDec: -10, maxDec: 20 },
    center: { ra: 297.7, dec: 8.9 },
    themeColor: '#FBBF24',
    nebulaPalette: ['#78350F', '#D97706'],
    description: 'Altair ile parıldayan yaz üçgeninin güney ayağı.',
    mythologyNote: 'Zeus\'un şimşek taşıyan kartalı.',
  },
  canis_major: {
    id: 'canis_major',
    code3: 'CMA',
    name: 'Büyük Köpek Sektörü',
    latinName: 'Canis Major',
    symbol: '🐕',
    displayOrder: 21,
    bounds: { minRa: 95, maxRa: 115, minDec: -35, maxDec: -10 },
    center: { ra: 101.3, dec: -16.7 },
    themeColor: '#38BDF8',
    nebulaPalette: ['#075985', '#0EA5E9'],
    description: 'Gökyüzünün en parlak yıldızı Sirius\'un evi.',
    mythologyNote: 'Avcı Orion\'un sadık av köpeği.',
  },
  centaurus: {
    id: 'centaurus',
    code3: 'CEN',
    name: 'Kentaur Sektörü',
    latinName: 'Centaurus',
    symbol: '🐴',
    displayOrder: 22,
    bounds: { minRa: 170, maxRa: 220, minDec: -65, maxDec: -30 },
    center: { ra: 219.9, dec: -60.8 },
    themeColor: '#14B8A6',
    nebulaPalette: ['#042F2E', '#0D9488'],
    description: 'Alpha Centauri ve Hadar ile güney göğünün en parlak çifti.',
    mythologyNote: 'Bilge centaur Chiron, yıldızlara yükselen şifacı ve öğretmen.',
  },
  crux: {
    id: 'crux',
    code3: 'CRU',
    name: 'Güneyhaçı Sektörü',
    latinName: 'Crux',
    symbol: '✝️',
    displayOrder: 23,
    bounds: { minRa: 180, maxRa: 200, minDec: -65, maxDec: -55 },
    center: { ra: 186.6, dec: -63.1 },
    themeColor: '#F472B6',
    nebulaPalette: ['#9D174D', '#EC4899'],
    description: 'Gökyüzünün en küçük ama en tanınır takımyıldızı.',
    mythologyNote: 'Güneye yön gösteren kutsal haç.',
  },
  phoenix: {
    id: 'phoenix',
    code3: 'PHE',
    name: 'Anka Kuşu Sektörü',
    latinName: 'Phoenix',
    symbol: '🔥',
    displayOrder: 24,
    bounds: { minRa: 0, maxRa: 35, minDec: -60, maxDec: -40 },
    center: { ra: 17.5, dec: -50.0 },
    themeColor: '#F97316',
    nebulaPalette: ['#7C2D12', '#EA580C'],
    description: 'Ateşten doğan efsanevi kuşun gökyüzündeki yuvası.',
    mythologyNote: 'Külleriinden yeniden doğan ölümsüz anka kuşu.',
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
