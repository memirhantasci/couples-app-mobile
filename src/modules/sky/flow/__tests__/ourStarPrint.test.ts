/// <reference types="jest" />
import { computeSky, findStarPosition, type SkyRequest } from "../../astronomy";
import { cleanStarLabel, describeOurStar, MAX_STAR_LABEL, parseHipCode } from "../ourStar";
import { captureWithFallback, parseAttemptWidth, PRINT_SIZES, sizesAfterCrash } from "../printExport";

const REQUEST: SkyRequest = { latitude: 41.0082, longitude: 28.9784, date: "2025-02-14", time: "22:00" };

describe("yıldız kodu ayrıştırma", () => {
  it("yalnızca HIP-<pozitif tam sayı>", () => {
    expect(parseHipCode("HIP-32349")).toBe(32349);
    expect(parseHipCode("HIP-1")).toBe(1);
  });

  it.each(["SOL-SUN", "SOL-MOON", "VIRT-ORI-1730000000-AB12CD34", "HIP-0", "HIP-", "HIP-01", "HIP--5", "HIP-1.5", "hip-32349", " HIP-32349", "HIP-32349 ", "HIP-99999999", "", null, undefined, 32349])(
    "%p reddedilir",
    (code) => {
      expect(parseHipCode(code)).toBeNull();
    }
  );
});

describe("etiket kısaltma", () => {
  it("kısa ad korunur, boşluklar sadeleşir", () => {
    expect(cleanStarLabel("  Bizim   Yıldız ")).toBe("Bizim Yıldız");
    expect(cleanStarLabel("A\nB")).toBe("A B");
  });

  it("uzun ad sınırlanır, emoji bölünmez", () => {
    const label = cleanStarLabel("😀".repeat(40))!;
    expect(Array.from(label)).toHaveLength(MAX_STAR_LABEL);
    expect(label.endsWith("…")).toBe(true);
    expect(label).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
  });

  it("boş ve metin olmayan undefined", () => {
    expect(cleanStarLabel("   ")).toBeUndefined();
    expect(cleanStarLabel(5)).toBeUndefined();
  });
});

describe("cümle mantığı", () => {
  const star = { catalog_code: "HIP-32349", custom_name: "Bizim" };
  const at = (altitude: number, azimuth = 180) => () => ({ altitude, azimuth, aboveHorizon: altitude > 0 });

  it("gece, üstte: halka ve yön", () => {
    expect(describeOurStar(star, REQUEST, "night", at(34.4, 135))).toEqual({
      highlight: { hip: 32349, label: "Bizim" },
      sentence: { key: "above", degrees: 34, direction: "SE" },
    });
  });

  it("gece, altta: halka yok", () => {
    const result = describeOurStar(star, REQUEST, "night", at(-20));
    expect(result?.highlight).toBeNull();
    expect(result?.sentence.key).toBe("below");
  });

  it.each(["day", "civil", "nautical", "astronomical"] as const)("aydınlık (%s): ayrı cümle", (twilight) => {
    expect(describeOurStar(star, REQUEST, twilight, at(30))?.sentence.key).toBe("aboveDaylight");
    expect(describeOurStar(star, REQUEST, twilight, at(-30))?.sentence.key).toBe("belowDaylight");
  });

  it("ufkun hemen üstü 0° yazılmaz", () => {
    expect(describeOurStar(star, REQUEST, "night", at(0.2))?.sentence.degrees).toBe(1);
  });

  it("özel ad yoksa katalog adı", () => {
    expect(describeOurStar({ catalog_code: "HIP-32349", custom_name: "  " }, REQUEST, "night", at(30))?.highlight?.label).toBe("Sirius");
  });

  it("yıldız yok, sanal, Güneş sistemi: cümle yok ve konum aranmaz", () => {
    const find = jest.fn();
    for (const value of [null, undefined, { catalog_code: "SOL-MARS" }, { catalog_code: "VIRT-LEO-1-AB" }]) {
      expect(describeOurStar(value, REQUEST, "night", find)).toBeNull();
    }
    expect(find).not.toHaveBeenCalled();
  });

  it("katalogda olmayan HIP: cümle yok (gerçek motor)", () => {
    // HIP 1 kadir 9,1: 5,5 sınırının altında ve çizgi ucu değil
    expect(findStarPosition(1, REQUEST)).toBeNull();
    expect(describeOurStar({ catalog_code: "HIP-1" }, REQUEST, "night")).toBeNull();
  });

  it("uçtan uca: İstanbul 2025-02-14 22:00'de Sirius üstte ve güneye yakın", () => {
    const sky = computeSky(REQUEST);
    const result = describeOurStar(star, REQUEST, sky.sun.twilight)!;
    expect(result.sentence.key).toBe("above");
    expect(result.sentence.degrees).toBeGreaterThan(15);
    expect(result.sentence.degrees).toBeLessThan(35);
    expect(["SE", "S", "SW"]).toContain(result.sentence.direction);
    expect(sky.stars.some((item) => item.hip === 32349)).toBe(true);
  });
});

describe("baskı boyutu geri düşme", () => {
  it("sıra büyükten küçüğe ve hepsi 3:4", () => {
    expect(PRINT_SIZES.map((size) => size.width)).toEqual([2400, 1800, 1200]);
    for (const size of PRINT_SIZES) expect(size.height / size.width).toBeCloseTo(4 / 3, 9);
  });

  it("ilk deneme başarılıysa durur", async () => {
    const capture = jest.fn(async () => "file://a.png");
    expect(await captureWithFallback(PRINT_SIZES, capture)).toEqual({ uri: "file://a.png", size: PRINT_SIZES[0] });
    expect(capture).toHaveBeenCalledTimes(1);
  });

  it("ilk iki hata, üçüncü başarı", async () => {
    const failed: number[] = [];
    const capture = jest.fn().mockRejectedValueOnce(new Error("oom")).mockRejectedValueOnce(new Error("oom")).mockResolvedValueOnce("file://c.png");
    const result = await captureWithFallback(PRINT_SIZES, capture, (size) => failed.push(size.width));
    expect(result).toEqual({ uri: "file://c.png", size: PRINT_SIZES[2] });
    expect(failed).toEqual([2400, 1800]);
    expect(capture.mock.calls.map((call) => call[0].width)).toEqual([2400, 1800, 1200]);
  });

  it("boş adres de başarısızlıktır", async () => {
    const capture = jest.fn().mockResolvedValueOnce("").mockResolvedValueOnce("file://b.png");
    expect((await captureWithFallback(PRINT_SIZES, capture))?.size.width).toBe(1800);
  });

  it("hepsi hata: null, istisna çıkmaz", async () => {
    await expect(captureWithFallback(PRINT_SIZES, async () => Promise.reject(new Error("oom")))).resolves.toBeNull();
  });

  it("önceki deneme iz bıraktıysa o boyut atlanır", () => {
    expect(sizesAfterCrash(null).map((size) => size.width)).toEqual([2400, 1800, 1200]);
    expect(sizesAfterCrash(2400).map((size) => size.width)).toEqual([1800, 1200]);
    expect(sizesAfterCrash(1800).map((size) => size.width)).toEqual([1200]);
    expect(sizesAfterCrash(1200).map((size) => size.width)).toEqual([1200]);
  });

  it("bozuk iz yok sayılır", () => {
    expect(parseAttemptWidth(null)).toBeNull();
    expect(parseAttemptWidth("abc")).toBeNull();
    expect(parseAttemptWidth("2400")).toBe(2400);
  });
});

describe("yasal metin", () => {
  const { readFileSync } = jest.requireActual<{ readFileSync: (path: string, encoding: string) => string }>("fs");
  const source = readFileSync("src/constants/legalTexts.ts", "utf8");

  it.each(["codeberg.org/astronexus/hyg", "github.com/Stellarium/stellarium-skycultures"])("%s TR ve EN'de var", (url) => {
    expect(source.split(url)).toHaveLength(3);
  });

  it("değiştirilmiş veri ve aynı lisans belirtilir", () => {
    expect(source).toContain("süzülüp yuvarlanarak değiştirilmiş");
    expect(source).toContain("modified (filtered and rounded)");
    expect(source).toContain("sürüm belirtilmemiş");
    expect(source).toContain("version not specified");
  });
});
