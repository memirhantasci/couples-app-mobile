/// <reference types="jest" />
import { SKY_CONSTELLATIONS } from "../skyConstellationLines.data";
import { SKY_STAR_NAMES } from "../skyStarNames.data";
import { SKY_STARS } from "../skyStars.data";

const byHip = new Map(SKY_STARS.map((s) => [s[0], s]));

describe("gerçek gökyüzü verisi", () => {
  it("yıldız sayısı makul aralıktadır", () => {
    expect(SKY_STARS.length).toBeGreaterThanOrEqual(2800);
    expect(SKY_STARS.length).toBeLessThanOrEqual(3800);
  });

  it("HIP numaraları benzersizdir", () => {
    expect(byHip.size).toBe(SKY_STARS.length);
  });

  it("koordinatlar ve kadirler geçerlidir", () => {
    for (const [hip, ra, dec, mag, ci] of SKY_STARS) {
      expect(Number.isInteger(hip) && hip > 0).toBe(true);
      expect(ra).toBeGreaterThanOrEqual(0);
      expect(ra).toBeLessThan(360);
      expect(dec).toBeGreaterThanOrEqual(-90);
      expect(dec).toBeLessThanOrEqual(90);
      expect(Number.isFinite(mag)).toBe(true);
      expect(ci === null || Number.isFinite(ci)).toBe(true);
    }
  });

  it("yıldızlar sağ açıklığa göre sıralıdır", () => {
    for (let i = 1; i < SKY_STARS.length; i++) expect(SKY_STARS[i][1]).toBeGreaterThanOrEqual(SKY_STARS[i - 1][1]);
  });

  it("88 takımyıldızı vardır ve IAU kodları benzersizdir", () => {
    expect(SKY_CONSTELLATIONS).toHaveLength(88);
    expect(new Set(SKY_CONSTELLATIONS.map((c) => c.iau)).size).toBe(88);
  });

  it("her çizgi ucu katalogdadır ve kenar uçları farklıdır", () => {
    for (const c of SKY_CONSTELLATIONS) {
      expect(c.segments.length).toBeGreaterThan(0);
      for (const [a, b] of c.segments) {
        expect(a).not.toBe(b);
        expect(byHip.has(a)).toBe(true);
        expect(byHip.has(b)).toBe(true);
      }
    }
  });

  it("adlı yıldızların hepsi katalogdadır", () => {
    const hips = Object.keys(SKY_STAR_NAMES).map(Number);
    expect(hips.length).toBeGreaterThan(40);
    for (const hip of hips) expect(byHip.has(hip)).toBe(true);
  });

  it("bilinen yıldızlar doğrudur", () => {
    const sirius = byHip.get(32349)!;
    expect(sirius[3]).toBeGreaterThan(-1.5);
    expect(sirius[3]).toBeLessThan(-1.4);
    const betelgeuse = byHip.get(27989)!;
    expect(betelgeuse[3]).toBeGreaterThanOrEqual(0.4);
    expect(betelgeuse[3]).toBeLessThanOrEqual(0.5);
    const polaris = byHip.get(11767)!;
    expect(polaris[3]).toBeGreaterThan(1.9);
    expect(polaris[3]).toBeLessThan(2.1);
    expect(polaris[2]).toBeGreaterThan(89.2);
    expect(polaris[2]).toBeLessThan(89.3);
    const vega = byHip.get(91262)!;
    expect(vega[3]).toBeGreaterThan(-0.05);
    expect(vega[3]).toBeLessThan(0.1);
    expect(SKY_STAR_NAMES[32349]).toBe("Sirius");
  });
});
