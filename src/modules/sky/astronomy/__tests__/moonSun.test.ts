/// <reference types="jest" />
import { lunarParallaxInAltitude, moonEcliptic, moonEquatorial, moonPhase, moonPhaseName } from "../moon";
import { sunPosition, twilightFromAltitude } from "../sun";
import { julianDateFromUtcMs } from "../time";

const jdOf = (iso: string) => julianDateFromUtcMs(Date.parse(iso));

describe("Güneş", () => {
  it("Meeus 25.a (1992-10-13 0h)", () => {
    const { ra, dec, distanceAu } = sunPosition(2448908.5);
    expect(Math.abs(ra - 198.38083)).toBeLessThan(0.001);
    expect(Math.abs(dec - -7.78507)).toBeLessThan(0.001);
    expect(Math.abs(distanceAu - 0.99766)).toBeLessThan(0.0001);
  });

  it("alacakaranlık eşikleri", () => {
    expect(twilightFromAltitude(10)).toBe("day");
    expect(twilightFromAltitude(-0.833)).toBe("civil");
    expect(twilightFromAltitude(-0.8)).toBe("day");
    expect(twilightFromAltitude(-6)).toBe("nautical");
    expect(twilightFromAltitude(-5.9)).toBe("civil");
    expect(twilightFromAltitude(-12)).toBe("astronomical");
    expect(twilightFromAltitude(-11.9)).toBe("nautical");
    expect(twilightFromAltitude(-18)).toBe("night");
    expect(twilightFromAltitude(-17.9)).toBe("astronomical");
  });
});

describe("Ay konumu", () => {
  it("Meeus 47.a (1992-04-12 0h), baş terimlerle", () => {
    const jd = 2448724.5;
    const position = moonEcliptic(jd);
    expect(Math.abs(position.longitude - 133.162655)).toBeLessThan(0.03);
    expect(Math.abs(position.latitude - -3.229126)).toBeLessThan(0.02);
    expect(Math.abs(position.distanceKm - 368409.7)).toBeLessThan(60);
    expect(Math.abs(position.parallaxDeg - 0.99199)).toBeLessThan(0.001);
    const { ra, dec } = moonEquatorial(position, jd);
    expect(Math.abs(ra - 134.688470)).toBeLessThan(0.03);
    expect(Math.abs(dec - 13.768368)).toBeLessThan(0.03);
  });

  it("paralaks ufukta en büyük, tepe noktasında sıfırdır", () => {
    expect(lunarParallaxInAltitude(0, 1)).toBeCloseTo(1, 3);
    expect(lunarParallaxInAltitude(90, 1)).toBeCloseTo(0, 6);
    expect(lunarParallaxInAltitude(45, 1)).toBeLessThan(lunarParallaxInAltitude(10, 1));
  });
});

describe("Ay evresi", () => {
  it("Meeus 48.a aydınlanma ≈ 0.68", () => {
    expect(Math.abs(moonPhase(2448724.5).illumination - 0.6786)).toBeLessThan(0.002);
  });

  it.each(["2000-01-21T04:40:00Z", "2018-07-27T20:21:00Z"])("dolunay %s", (iso) => {
    const phase = moonPhase(jdOf(iso));
    expect(phase.illumination).toBeGreaterThanOrEqual(0.98);
    expect(phase.phaseName).toBe("full");
  });

  it.each(["2000-01-06T18:14:00Z", "2017-08-21T18:30:00Z"])("yeni ay %s", (iso) => {
    const phase = moonPhase(jdOf(iso));
    expect(phase.illumination).toBeLessThanOrEqual(0.02);
    expect(phase.phaseName).toBe("new");
  });

  it("yeni ay çevresinde waxing yönü", () => {
    expect(moonPhase(jdOf("2017-08-19T18:30:00Z")).waxing).toBe(false);
    expect(moonPhase(jdOf("2017-08-23T18:30:00Z")).waxing).toBe(true);
    expect(moonPhase(jdOf("2017-08-19T18:30:00Z")).phaseName).toBe("waningCrescent");
    expect(moonPhase(jdOf("2017-08-23T18:30:00Z")).phaseName).toBe("waxingCrescent");
  });

  it("dolunay çevresinde waxing yönü", () => {
    expect(moonPhase(jdOf("2018-07-25T20:21:00Z")).waxing).toBe(true);
    expect(moonPhase(jdOf("2018-07-29T20:21:00Z")).waxing).toBe(false);
  });

  it.each([
    [0, "new"],
    [5.99, "new"],
    [6, "waxingCrescent"],
    [83.99, "waxingCrescent"],
    [84, "firstQuarter"],
    [90, "firstQuarter"],
    [95.99, "firstQuarter"],
    [96, "waxingGibbous"],
    [173.99, "waxingGibbous"],
    [174, "full"],
    [180, "full"],
    [185.99, "full"],
    [186, "waningGibbous"],
    [263.99, "waningGibbous"],
    [264, "lastQuarter"],
    [270, "lastQuarter"],
    [275.99, "lastQuarter"],
    [276, "waningCrescent"],
    [353.99, "waningCrescent"],
    [354, "new"],
    [359.99, "new"],
  ])("uzanım %d° → %s", (elongation, name) => {
    expect(moonPhaseName(elongation)).toBe(name);
  });
});
