/// <reference types="jest" />
import { precessFromJ2000 } from "../precession";
import { J2000_JD } from "../time";

describe("presesyon", () => {
  it("α=0, δ=0 için 100 yılda Δα ≈ +1.28°, Δδ ≈ +0.557°", () => {
    const { ra, dec } = precessFromJ2000(0, 0, J2000_JD + 36525);
    expect(Math.abs(ra - 1.28)).toBeLessThan(0.02);
    expect(Math.abs(dec - 0.557)).toBeLessThan(0.02);
  });

  it("J2000'de kimliktir", () => {
    for (const [ra0, dec0] of [[0, 0], [101.287, -16.716], [279.235, 38.784], [37.946, 89.264], [359.9, -89]]) {
      const { ra, dec } = precessFromJ2000(ra0, dec0, J2000_JD);
      expect(ra).toBeCloseTo(ra0, 9);
      expect(dec).toBeCloseTo(dec0, 9);
    }
  });

  it("Meeus 21.b (θ Persei, 2028-11-13.19, öz hareket elle eklenmiş)", () => {
    const years = 28.867;
    const ra0 = (2 + 44 / 60 + (11.986 + 0.03425 * years) / 3600) * 15;
    const dec0 = 49 + 13 / 60 + (42.48 - 0.0895 * years) / 3600;
    const { ra, dec } = precessFromJ2000(ra0, dec0, 2462088.69);
    expect(Math.abs(ra - 41.547214)).toBeLessThan(1e-3);
    expect(Math.abs(dec - 49.348483)).toBeLessThan(1e-3);
  });

  it("geçmişe doğru ters yönde çalışır", () => {
    const { ra, dec } = precessFromJ2000(10, 10, J2000_JD - 36525);
    expect(ra).toBeLessThan(10);
    expect(dec).toBeLessThan(10);
  });
});
