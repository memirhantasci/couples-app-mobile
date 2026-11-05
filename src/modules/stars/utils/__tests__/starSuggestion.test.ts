/// <reference types="jest" />
import { starVisibility } from '../../canvas/macro/starStyle';
import { MAX_ZOOM } from '../../canvas/macro/skyProjection';
import {
  SUGGESTED_STAR_ZOOM,
  suggestedStarZoom,
  toSuggestedViewportStar,
  type SuggestedStarRow,
} from '../starSuggestion';

const row: SuggestedStarRow = {
  catalog_id: 42,
  catalog_code: 'HIP-677',
  ra: 2.0969,
  dec: 29.0904,
  magnitude: 2.07,
  spectral_type: 'B9p',
  base_color: '#A5C3FF',
  common_name: 'Alpheratz',
};

describe('toSuggestedViewportStar', () => {
  it("öneriyi boşta bir yıldız olarak (tescilsiz, sahipsiz, sönük baz ışık) çevirir", () => {
    const star = toSuggestedViewportStar(row);
    expect(star).toMatchObject({
      catalog_id: 42,
      catalog_code: 'HIP-677',
      ra: 2.0969,
      dec: 29.0904,
      magnitude: 2.07,
      spectral_type: 'B9p',
      base_color: '#A5C3FF',
      common_name: 'Alpheratz',
      is_claimed: false,
      is_mine: false,
      custom_name: null,
      resonance_active: false,
      owner_label: null,
      is_connected: false,
    });
    expect(star?.luminosity_level).toBe(0.2);
  });

  it("PostgREST'in metin olarak döndürdüğü numeric alanları sayıya çevirir", () => {
    const star = toSuggestedViewportStar({ ...row, catalog_id: '7', ra: '84.0533', dec: '-0.2991', magnitude: '2.23' });
    expect(star).toMatchObject({ catalog_id: 7, ra: 84.0533, dec: -0.2991, magnitude: 2.23 });
  });

  it('adı olmayan yıldızda common_name null olur', () => {
    expect(toSuggestedViewportStar({ ...row, common_name: undefined })?.common_name).toBeNull();
    expect(toSuggestedViewportStar({ ...row, common_name: null })?.common_name).toBeNull();
  });

  it('bozuk satırı (sayıya çevrilemeyen alan, eksik kod) null döndürür', () => {
    expect(toSuggestedViewportStar({ ...row, ra: 'abc' })).toBeNull();
    expect(toSuggestedViewportStar({ ...row, dec: Number.NaN })).toBeNull();
    expect(toSuggestedViewportStar({ ...row, catalog_id: undefined as unknown as number })).toBeNull();
    expect(toSuggestedViewportStar({ ...row, catalog_code: '' })).toBeNull();
  });
});

describe('suggestedStarZoom', () => {
  it('parlak ve orta yıldızlarda varsayılan yakınlığı kullanır', () => {
    expect(suggestedStarZoom(2.07)).toBe(SUGGESTED_STAR_ZOOM);
    expect(suggestedStarZoom(5.26)).toBe(SUGGESTED_STAR_ZOOM);
    // Canlı katalogdaki en sönük boşta yıldız (kadir 5.76) varsayılan yakınlıkta zaten tam görünür
    expect(suggestedStarZoom(5.76)).toBe(SUGGESTED_STAR_ZOOM);
  });

  it('varsayılan yakınlıkta çizilmeyecek kadar sönük yıldızda daha yakına gider', () => {
    expect(suggestedStarZoom(6.3)).toBeGreaterThan(SUGGESTED_STAR_ZOOM);
    expect(suggestedStarZoom(6.5)).toBeGreaterThan(SUGGESTED_STAR_ZOOM);
  });

  it('her kadir için önerilen yıldız varış yakınlığında tam görünür (öneri boş bir noktaya uçurmaz)', () => {
    // RPC kadir 6.5'e kadar yıldız önerebilir; 0.05 adımla tüm aralık taranır
    for (let magnitude = -1; magnitude <= 6.5; magnitude += 0.05) {
      const zoom = suggestedStarZoom(magnitude);
      expect(starVisibility(magnitude, false, zoom)).toBe(1);
    }
  });

  it('kamera yakınlığı hiçbir zaman izin verilen en yakın yakınlığı aşmaz', () => {
    expect(suggestedStarZoom(8.9)).toBeLessThanOrEqual(MAX_ZOOM);
    // Katalogdaki hiçbir yıldız tanımsız/NaN kadirde bile sonsuz döngü ya da tanımsız yakınlık üretmez
    expect(Number.isFinite(suggestedStarZoom(Number.NaN))).toBe(true);
  });
});
