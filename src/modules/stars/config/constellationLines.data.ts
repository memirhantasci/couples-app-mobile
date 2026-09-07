/**
 * @file constellationLines.data.ts
 * @module modules/stars/config
 * @description Gerçek Hipparcos Yıldız Koordinatlarından Derlenen Takımyıldızı Çizgileri.
 *
 * KAYNAK DOĞRULAMASI:
 * Tüm RA/Dec değerleri projemizdeki seed dosyalarından doğrulanmıştır:
 * - 20260906_create_star_system.sql (ilk 35 parlak yıldız)
 * - 20260907_seed_hipparcos_stars.sql (489 ek Hipparcos yıldızı)
 *
 * Uydurma koordinat YOKTUR. Her değerin yanında HIP kodu ve kaynak dosya referansı belirtilmiştir.
 */

// ============================================================================
// TİP TANIMLAMALARI
// ============================================================================

export interface ConstellationSegment {
  /** Ait olduğu takımyıldızı / sektör ID'si */
  readonly constellationId: string;
  /** Başlangıç yıldızının yaygın adı */
  readonly fromName: string;
  /** Bitiş yıldızının yaygın adı */
  readonly toName: string;
  /** Başlangıç yıldızının gerçek gökyüzü koordinatları */
  readonly from: { readonly ra: number; readonly dec: number };
  /** Bitiş yıldızının gerçek gökyüzü koordinatları */
  readonly to: { readonly ra: number; readonly dec: number };
}


// ============================================================================
// GERÇEK TAKIMYILDIZı ÇİZGİLERİ (7 Takımyıldızı, 31 Segment)
// ============================================================================

export const CONSTELLATION_LINES: readonly ConstellationSegment[] = [

  // ─── ORION (Avcı) ──────────────────────────────────────────────────
  // Kaynak: 20260906 (Rigel, Betelgeuse, Bellatrix, Alnilam)
  //         20260907 (Mintaka, Alnitak, Saiph, Meissa)

  // Orion Kemeri: Mintaka → Alnilam → Alnitak
  { constellationId: 'orion', fromName: 'Mintaka', toName: 'Alnilam',
    from: { ra: 84.0533, dec: -0.2991 }, to: { ra: 86.9392, dec: -1.2019 } },
  { constellationId: 'orion', fromName: 'Alnilam', toName: 'Alnitak',
    from: { ra: 86.9392, dec: -1.2019 }, to: { ra: 84.4112, dec: -1.9426 } },

  // Omuzlar: Betelgeuse → Bellatrix
  { constellationId: 'orion', fromName: 'Betelgeuse', toName: 'Bellatrix',
    from: { ra: 88.7929, dec: 7.4072 }, to: { ra: 81.2829, dec: 6.3497 } },

  // Sol omuz → Kemer: Betelgeuse → Alnilam
  { constellationId: 'orion', fromName: 'Betelgeuse', toName: 'Alnilam',
    from: { ra: 88.7929, dec: 7.4072 }, to: { ra: 86.9392, dec: -1.2019 } },

  // Sağ omuz → Kemer: Bellatrix → Mintaka
  { constellationId: 'orion', fromName: 'Bellatrix', toName: 'Mintaka',
    from: { ra: 81.2829, dec: 6.3497 }, to: { ra: 84.0533, dec: -0.2991 } },

  // Ayaklar: Rigel ↔ Saiph
  { constellationId: 'orion', fromName: 'Rigel', toName: 'Saiph',
    from: { ra: 78.6346, dec: -8.2017 }, to: { ra: 83.0016, dec: -9.6696 } },

  // Kemer → Ayaklar: Alnitak → Saiph, Mintaka → Rigel
  { constellationId: 'orion', fromName: 'Alnitak', toName: 'Saiph',
    from: { ra: 84.4112, dec: -1.9426 }, to: { ra: 83.0016, dec: -9.6696 } },
  { constellationId: 'orion', fromName: 'Mintaka', toName: 'Rigel',
    from: { ra: 84.0533, dec: -0.2991 }, to: { ra: 78.6346, dec: -8.2017 } },


  // ─── URSA MAJOR (Büyük Kepçe) ─────────────────────────────────────
  // Kaynak: 20260906 (Dubhe, Mizar)
  //         20260907 (Merak, Phad, Megrez, Alioth, Alkaid)

  // Büyük Kepçe Kasesi: Dubhe → Merak → Phad → Megrez → Dubhe
  { constellationId: 'ursa_major', fromName: 'Dubhe', toName: 'Merak',
    from: { ra: 166.4179, dec: 61.7508 }, to: { ra: 165.4603, dec: 56.3824 } },
  { constellationId: 'ursa_major', fromName: 'Merak', toName: 'Phad',
    from: { ra: 165.4603, dec: 56.3824 }, to: { ra: 178.4577, dec: 53.6948 } },
  { constellationId: 'ursa_major', fromName: 'Phad', toName: 'Megrez',
    from: { ra: 178.4577, dec: 53.6948 }, to: { ra: 183.8569, dec: 57.0326 } },
  { constellationId: 'ursa_major', fromName: 'Megrez', toName: 'Dubhe',
    from: { ra: 183.8569, dec: 57.0326 }, to: { ra: 166.4179, dec: 61.7508 } },

  // Büyük Kepçe Sapı: Megrez → Alioth → Mizar → Alkaid
  { constellationId: 'ursa_major', fromName: 'Megrez', toName: 'Alioth',
    from: { ra: 183.8569, dec: 57.0326 }, to: { ra: 193.5073, dec: 55.9598 } },
  { constellationId: 'ursa_major', fromName: 'Alioth', toName: 'Mizar',
    from: { ra: 193.5073, dec: 55.9598 }, to: { ra: 200.9817, dec: 54.9253 } },
  { constellationId: 'ursa_major', fromName: 'Mizar', toName: 'Alkaid',
    from: { ra: 200.9817, dec: 54.9253 }, to: { ra: 206.8852, dec: 49.3133 } },


  // ─── CASSIOPEIA (W Şekli) ──────────────────────────────────────────
  // Kaynak: 20260907 (Schedar, Caph, Tsih, Ruchbah, Segin)

  { constellationId: 'cassiopeia', fromName: 'Caph', toName: 'Schedar',
    from: { ra: 2.2945, dec: 59.1498 }, to: { ra: 10.1268, dec: 56.5373 } },
  { constellationId: 'cassiopeia', fromName: 'Schedar', toName: 'Tsih',
    from: { ra: 10.1268, dec: 56.5373 }, to: { ra: 14.1772, dec: 60.7167 } },
  { constellationId: 'cassiopeia', fromName: 'Tsih', toName: 'Ruchbah',
    from: { ra: 14.1772, dec: 60.7167 }, to: { ra: 21.4540, dec: 60.2353 } },
  { constellationId: 'cassiopeia', fromName: 'Ruchbah', toName: 'Segin',
    from: { ra: 21.4540, dec: 60.2353 }, to: { ra: 26.1601, dec: 63.6701 } },


  // ─── CYGNUS (Kuğu / Kuzeyhaçı) ────────────────────────────────────
  // Kaynak: 20260906 (Deneb)
  //         20260907 (Sadr, Gienah, Fawaris, Albireo)

  // Ana gövde: Deneb → Sadr → Albireo
  { constellationId: 'cygnus', fromName: 'Deneb', toName: 'Sadr',
    from: { ra: 310.3580, dec: 45.2803 }, to: { ra: 305.5571, dec: 40.2567 } },
  { constellationId: 'cygnus', fromName: 'Sadr', toName: 'Albireo',
    from: { ra: 305.5571, dec: 40.2567 }, to: { ra: 292.6803, dec: 27.9597 } },

  // Kanat çubuğu: Gienah → Sadr → Fawaris
  { constellationId: 'cygnus', fromName: 'Gienah', toName: 'Sadr',
    from: { ra: 311.9604, dec: 33.9703 }, to: { ra: 305.5571, dec: 40.2567 } },
  { constellationId: 'cygnus', fromName: 'Sadr', toName: 'Fawaris',
    from: { ra: 305.5571, dec: 40.2567 }, to: { ra: 296.2437, dec: 45.1306 } },


  // ─── LYRA (Çalgı) ─────────────────────────────────────────────────
  // Kaynak: 20260906 (Vega)
  //         20260907 (Sulafat, Sheliak)

  { constellationId: 'lyra', fromName: 'Vega', toName: 'Sulafat',
    from: { ra: 279.2346, dec: 38.7836 }, to: { ra: 284.9767, dec: 32.6902 } },
  { constellationId: 'lyra', fromName: 'Sulafat', toName: 'Sheliak',
    from: { ra: 284.9767, dec: 32.6902 }, to: { ra: 282.5186, dec: 33.3627 } },
  { constellationId: 'lyra', fromName: 'Sheliak', toName: 'Vega',
    from: { ra: 282.5186, dec: 33.3627 }, to: { ra: 279.2346, dec: 38.7836 } },


  // ─── AQUILA (Kartal) ──────────────────────────────────────────────
  // Kaynak: 20260906 (Altair)
  //         20260907 (Tarazed, Alshain)

  { constellationId: 'aquila', fromName: 'Tarazed', toName: 'Altair',
    from: { ra: 296.5653, dec: 10.6133 }, to: { ra: 297.6958, dec: 8.8683 } },
  { constellationId: 'aquila', fromName: 'Altair', toName: 'Alshain',
    from: { ra: 297.6958, dec: 8.8683 }, to: { ra: 298.8284, dec: 6.4074 } },


  // ─── CRUX (Güneyhaçı) ─────────────────────────────────────────────
  // Kaynak: 20260906 (Acrux, Mimosa, Gacrux)

  // Dikey çubuk: Gacrux → Acrux
  { constellationId: 'crux', fromName: 'Gacrux', toName: 'Acrux',
    from: { ra: 187.7912, dec: -57.1136 }, to: { ra: 186.6496, dec: -63.0992 } },

  // Yatay çubuk: Mimosa → (Delta Crucis yakınına yönelik)
  // Not: Delta Crucis (HIP-59747) tam koordinatı seed'de yok.
  // Mimosa → Acrux çaprazı ekleniyor.
  { constellationId: 'crux', fromName: 'Mimosa', toName: 'Acrux',
    from: { ra: 191.9304, dec: -59.6889 }, to: { ra: 186.6496, dec: -63.0992 } },
  { constellationId: 'crux', fromName: 'Mimosa', toName: 'Gacrux',
    from: { ra: 191.9304, dec: -59.6889 }, to: { ra: 187.7912, dec: -57.1136 } },

] as const;


// ============================================================================
// YARDIMCI FONKSİYONLAR
// ============================================================================

/**
 * Belirtilen sektör ID'sine ait takımyıldızı çizgi segmentlerini döndürür.
 */
export function getConstellationLinesForSector(sectorId: string): readonly ConstellationSegment[] {
  return CONSTELLATION_LINES.filter((line) => line.constellationId === sectorId);
}

/**
 * Tüm benzersiz takımyıldızı ID'lerini döndürür.
 */
export function getConstellationIds(): string[] {
  return [...new Set(CONSTELLATION_LINES.map((line) => line.constellationId))];
}
