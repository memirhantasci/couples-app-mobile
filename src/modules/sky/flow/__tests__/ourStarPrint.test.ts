/// <reference types="jest" />
import { computeSky, findStarPosition, type SkyRequest } from "../../astronomy";
import { SKY_STARS } from "../../data/skyStars.data";
import { angularSeparationDeg, cleanStarLabel, describeOurStar, MAX_ANGULAR_SEPARATION_DEG, MAX_MAGNITUDE_DIFFERENCE, MAX_STAR_LABEL, magnitudesAgree, parseHipCode, positionsAgree } from "../ourStar";
import {
  beginAttempt,
  captureWithFallback,
  EMPTY_PRINT_TRAIL,
  IOS_MAX_PRINT_WIDTH,
  isPlausibleCapture,
  markFailed,
  markSuccess,
  MIN_PRINT_BYTES_PER_PIXEL,
  parsePrintTrail,
  PRINT_RETRY_AFTER_MS,
  PRINT_SIZES,
  printSizesFor,
  PrintLayoutTimeoutError,
  runPrintExport,
  serializePrintTrail,
  settleCrash,
  startingSizes,
  waitForLayout,
} from "../printExport";

const REQUEST: SkyRequest = { latitude: 41.0082, longitude: 28.9784, date: "2025-02-14", time: "22:00" };
/** Sirius'un uygulamadaki konumu (demo yıldızıyla aynı) */
const SIRIUS_POSITION = { ra: 101.2875, dec: -16.7161 };

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
  const star = { catalog_code: "HIP-32349", custom_name: "Bizim", magnitude: -1.44, ...SIRIUS_POSITION };
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

  it.each(["day", "civil", "nautical"] as const)("gökyüzü kararmamış (%s): ayrı cümle", (twilight) => {
    expect(describeOurStar(star, REQUEST, twilight, at(30))?.sentence.key).toBe("aboveDaylight");
    expect(describeOurStar(star, REQUEST, twilight, at(-30))?.sentence.key).toBe("belowDaylight");
  });

  it.each(["astronomical", "night"] as const)("karanlık (%s): gündüz varyantı kullanılmaz", (twilight) => {
    expect(describeOurStar(star, REQUEST, twilight, at(30))?.sentence.key).toBe("above");
    expect(describeOurStar(star, REQUEST, twilight, at(-30))?.sentence.key).toBe("below");
  });

  it("ufkun hemen üstü 0° yazılmaz", () => {
    expect(describeOurStar(star, REQUEST, "night", at(0.2))?.sentence.degrees).toBe(1);
  });

  it("özel ad yoksa katalog adı", () => {
    expect(describeOurStar({ ...star, custom_name: "  " }, REQUEST, "night", at(30))?.highlight?.label).toBe("Sirius");
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
    expect(describeOurStar({ catalog_code: "HIP-1", magnitude: 9.1 }, REQUEST, "night")).toBeNull();
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

describe("kadir kimlik denetimi", () => {
  const at = () => ({ altitude: 30, azimuth: 180, aboveHorizon: true });
  const sirius = (magnitude: unknown) => describeOurStar({ catalog_code: "HIP-32349", custom_name: "Bizim", magnitude, ...SIRIUS_POSITION }, REQUEST, "night", at);

  it("eşik 0,15'tir", () => {
    expect(MAX_MAGNITUDE_DIFFERENCE).toBe(0.15);
  });

  it.each([
    ["fark 0 (HYG genişlemesi)", 3.21, 3.21, true],
    ["sınır +0,15", 3.36, 3.21, true],
    ["sınır −0,15", 3.06, 3.21, true],
    ["negatif kadirde sınır", -1.29, -1.44, true],
    ["0,16", 3.37, 3.21, false],
    ["HIP-25930: 4,09 ile 2,25", 4.09, 2.25, false],
    ["NaN", NaN, 3.21, false],
    ["sonsuz", Infinity, 3.21, false],
    ["eksik", undefined, 3.21, false],
    ["null (0 sayılmaz)", null, 0, false],
    ["boş metin (0 sayılmaz)", "", 0, false],
    ["geçersiz metin", "abc", 3.21, false],
    ["sayısal metin", "3.21", 3.21, true],
    ["katalogda yok", 3.21, undefined, false],
  ])("%s", (_name, app, real, expected) => {
    expect(magnitudesAgree(app, real as number | undefined)).toBe(expected);
  });

  it("gerçek katalogla Sirius: -1,44 çıkar, 0,5 çıkmaz", () => {
    expect(sirius(-1.44)?.highlight?.hip).toBe(32349);
    expect(sirius(0.5)).toBeNull();
  });

  it("kadir eksik ya da NaN ise cümle ve halka yok, konum aranmaz", () => {
    const find = jest.fn(at);
    expect(describeOurStar({ catalog_code: "HIP-32349", ...SIRIUS_POSITION }, REQUEST, "night", find)).toBeNull();
    expect(describeOurStar({ catalog_code: "HIP-32349", magnitude: NaN, ...SIRIUS_POSITION }, REQUEST, "night", find)).toBeNull();
    expect(find).not.toHaveBeenCalled();
  });

  it("demo yıldızının kadiri (-1,46) eşik içindedir", () => {
    expect(sirius(-1.46)).not.toBeNull();
  });

  it("uyuşmazlık aydınlık saatte de cümleyi kaldırır", () => {
    expect(describeOurStar({ catalog_code: "HIP-32349", magnitude: 0.5, ...SIRIUS_POSITION }, REQUEST, "day", at)).toBeNull();
  });
});

describe("konum kimlik denetimi", () => {
  const at = () => ({ altitude: 30, azimuth: 180, aboveHorizon: true });
  const real = { ra: 101.287, dec: -16.716 };

  it("açısal mesafe: bilinen değerler, RA sarması ve kutup", () => {
    expect(angularSeparationDeg(10, 20, 10, 20)).toBe(0);
    expect(angularSeparationDeg(10, 0, 11, 0)).toBeCloseTo(1, 9);
    expect(angularSeparationDeg(359.5, 0, 0.5, 0)).toBeCloseTo(1, 9);
    expect(angularSeparationDeg(0, 60, 180, 60)).toBeCloseTo(60, 6);
    expect(angularSeparationDeg(10, 90, 200, 90)).toBeCloseTo(0, 6);
  });

  it.each([
    ["aynı konum", 101.287, -16.716, true],
    ["kaydırılmış (0,96°, Wezen örneği)", 102.287, -16.716, true],
    ["sınırın hemen içi", 101.287, -15.72, true],
    ["sınırın hemen dışı", 101.287, -15.71, false],
    ["uzak", 101.287, 40, false],
    ["sayısal metin", "101.287", "-16.716", true],
    ["NaN ra", NaN, -16.716, false],
    ["NaN dec", 101.287, NaN, false],
    ["eksik ra", undefined, -16.716, false],
    ["null dec (0 sayılmaz)", 101.287, null, false],
    ["boş metin", "", "", false],
  ])("%s", (_name, ra, dec, expected) => {
    expect(positionsAgree(ra, dec, real)).toBe(expected);
  });

  it("katalogda yoksa false", () => {
    expect(positionsAgree(101.287, -16.716, undefined)).toBe(false);
  });

  it("kadir uyuşsa da konum uyuşmazsa ya da yoksa cümle ve halka yok, konum aranmaz", () => {
    const find = jest.fn(at);
    const base = { catalog_code: "HIP-32349", custom_name: "Bizim", magnitude: -1.44 };
    expect(describeOurStar({ ...base, ra: 101.2875, dec: 10 }, REQUEST, "night", find)).toBeNull();
    expect(describeOurStar(base, REQUEST, "night", find)).toBeNull();
    expect(describeOurStar({ ...base, ra: NaN, dec: NaN }, REQUEST, "night", find)).toBeNull();
    expect(find).not.toHaveBeenCalled();
  });

  describe("uygulamadaki gerçek yıldızlarla (migration verisi)", () => {
    const { readFileSync } = jest.requireActual<{ readFileSync: (path: string, encoding: string) => string }>("fs");
    const ROW = /\(\s*'HIP-(\d+)'\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,/g;
    const HYG_FILE = "supabase/migrations/20261105000002_catalog_expansion_hyg_1500.sql";
    const FILES = ["supabase/migrations/20260906_create_star_system.sql", "supabase/migrations/20260907_seed_hipparcos_stars.sql", HYG_FILE];
    const stars = FILES.flatMap((file) =>
      Array.from(readFileSync(file, "utf8").matchAll(ROW), (m) => ({ file, hip: Number(m[1]), ra: Number(m[2]), dec: Number(m[3]), magnitude: Number(m[4]) }))
    );
    const catalog = new Map(SKY_STARS.map((row) => [row[0], row]));
    const inCatalog = stars.filter((star) => catalog.has(star.hip));
    const magnitudePassed = inCatalog.filter((star) => magnitudesAgree(star.magnitude, catalog.get(star.hip)![3]));
    const accepted = (star: (typeof stars)[number]) => describeOurStar({ catalog_code: `HIP-${star.hip}`, ...star }, REQUEST, "night", at) !== null;
    const separation = (star: (typeof stars)[number]) => angularSeparationDeg(star.ra, star.dec, catalog.get(star.hip)![1], catalog.get(star.hip)![2]);

    // Kadiri uyan ama konumu gerçek yıldızdan >1° uzak olan kayıtlar (inceleme bulgusu: 35'i 3°'den uzak)
    const WRONG_STARS = [
      8102, 10670, 12387, 12770, 17358, 17797, 18532, 19587, 20889, 24305, 28103, 30122, 42911, 43409, 45556, 49583, 49593, 51839, 57399, 70327, 71284, 71860, 74824,
      77622, 80582, 82080, 82729, 83207, 85822, 88794, 90496, 92689, 93825, 95501, 97496, 113881, 113963,
    ];

    it("eşik 1°'dir", () => {
      expect(MAX_ANGULAR_SEPARATION_DEG).toBe(1);
    });

    it("kadir kapısının geçirdiği yanlış yıldızlar yeniden üretilir ve konum kapısında elenir", () => {
      expect(stars).toHaveLength(2024);
      expect(magnitudePassed).toHaveLength(1694);
      const rejected = magnitudePassed.filter((star) => !accepted(star)).map((star) => star.hip).sort((a, b) => a - b);
      expect(rejected).toEqual(WRONG_STARS);
      expect(magnitudePassed.filter((star) => separation(star) > 3)).toHaveLength(35);
      if (process.env.SKY_REPORT) console.log(`Elenen ${rejected.length}, kalan ${magnitudePassed.length - rejected.length}`);
    });

    it("HYG genişlemesinin tamamı geçer; kaydırılmış gerçek yıldızlar geçer", () => {
      expect(stars.filter((star) => star.file === HYG_FILE && accepted(star))).toHaveLength(1500);
      const wezen = stars.find((star) => star.hip === 34444)!;
      expect(separation(wezen)).toBeCloseTo(0.96, 1);
      expect(accepted(wezen)).toBe(true);
    });

    it("kadir kapısından geçemeyen hiçbir yıldız geçmez", () => {
      const failedMagnitude = inCatalog.filter((star) => !magnitudePassed.includes(star));
      expect(failedMagnitude.filter(accepted)).toHaveLength(0);
    });
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

  it("hata nedeni bildirilir; doğrulamadan geçemeyen dosya başarısızdır ve alt boyuta düşülür", async () => {
    const failures: unknown[] = [];
    const boom = new Error("oom");
    const capture = jest.fn().mockRejectedValueOnce(boom).mockResolvedValueOnce("file://blank.png").mockResolvedValueOnce("file://ok.png");
    const validate = jest.fn((uri: string) => uri === "file://ok.png");
    const result = await captureWithFallback(PRINT_SIZES, capture, (_size, error) => failures.push(error), validate);
    expect(result).toEqual({ uri: "file://ok.png", size: PRINT_SIZES[2] });
    expect(failures).toEqual([boom, null]);
  });
});

describe("baskı çökme izi (sahte depolama, sahte saat)", () => {
  const widths = (sizes: readonly { width: number }[]) => sizes.map((size) => size.width);
  const DAY = 24 * 60 * 60 * 1000;
  const T0 = 1_800_000_000_000;

  /** Diskteki metin ve saat: her oturum diskten okur, gerçek akışla aynı sırada çalışır */
  function device(start = T0, version = "1.0.0") {
    let disk: string | null = null;
    const state = { now: start, version };
    const open = () => {
      const context = { now: state.now, version: state.version };
      let trail = settleCrash(parsePrintTrail(disk));
      const sizes = startingSizes(trail, context);
      return {
        sizes,
        crashAt(width: number) {
          trail = beginAttempt(trail, width, context);
          disk = serializePrintTrail(trail);
        },
        succeedAt(width: number) {
          trail = markSuccess(beginAttempt(trail, width, context), width);
          disk = serializePrintTrail(trail);
        },
        failAt(width: number) {
          trail = markFailed(beginAttempt(trail, width, context), width, context);
          disk = serializePrintTrail(trail);
        },
      };
    };
    return { open, state };
  }

  it("iz yoksa en büyükten başlar", () => {
    expect(widths(device().open().sizes)).toEqual([2400, 1800, 1200]);
  });

  it("çökme → sonraki oturum bir alt boyuttan başlar", () => {
    const phone = device();
    phone.open().crashAt(2400);
    expect(widths(phone.open().sizes)).toEqual([1800, 1200]);
  });

  it("küçük başarı büyük izi silmez: her iki denemede bir çökme biter", () => {
    const phone = device();
    phone.open().crashAt(2400);
    for (let session = 0; session < 5; session++) {
      const run = phone.open();
      expect(widths(run.sizes)[0]).toBe(1800);
      run.succeedAt(1800);
    }
  });

  it("başarı kendi boyutunun izini siler", () => {
    const failed = markFailed(markFailed(EMPTY_PRINT_TRAIL, 2400, { now: T0, version: "1" }), 1800, { now: T0, version: "1" });
    expect(Object.keys(markSuccess(failed, 1800).failed)).toEqual(["2400"]);
    expect(Object.keys(markSuccess(failed, 2400).failed)).toEqual(["1800"]);
  });

  it("süre dolunca büyük boyut yeniden denenir, dolmadan denenmez", () => {
    const phone = device();
    phone.open().crashAt(2400);
    phone.state.now = T0 + PRINT_RETRY_AFTER_MS - 1;
    expect(widths(phone.open().sizes)[0]).toBe(1800);
    phone.state.now = T0 + PRINT_RETRY_AFTER_MS;
    expect(widths(phone.open().sizes)[0]).toBe(2400);
    expect(PRINT_RETRY_AFTER_MS).toBe(14 * DAY);
  });

  it("uygulama sürümü değişince büyük boyut hemen yeniden denenir", () => {
    const phone = device();
    phone.open().crashAt(2400);
    phone.state.version = "1.1.0";
    expect(widths(phone.open().sizes)[0]).toBe(2400);
  });

  it("yeniden deneme başarılıysa iz tamamen kalkar", () => {
    const phone = device();
    phone.open().crashAt(2400);
    phone.state.now = T0 + PRINT_RETRY_AFTER_MS;
    phone.open().succeedAt(2400);
    expect(widths(phone.open().sizes)[0]).toBe(2400);
  });

  it("yeniden denemede tekrar çökerse süre baştan başlar", () => {
    const phone = device();
    phone.open().crashAt(2400);
    phone.state.now = T0 + PRINT_RETRY_AFTER_MS;
    phone.open().crashAt(2400);
    phone.state.now = T0 + PRINT_RETRY_AFTER_MS + DAY;
    expect(widths(phone.open().sizes)[0]).toBe(1800);
  });

  it("orta boy da başarısızsa en küçükten başlar; hepsi başarısızsa yine en küçük", () => {
    const phone = device();
    phone.open().crashAt(2400);
    phone.open().crashAt(1800);
    expect(widths(phone.open().sizes)).toEqual([1200]);
    phone.open().crashAt(1200);
    expect(widths(phone.open().sizes)).toEqual([1200]);
  });

  it("küçük boy başarısızsa büyüğü de denenmez (büyüğün izi dolmuş olsa bile)", () => {
    const trail = markFailed(EMPTY_PRINT_TRAIL, 1800, { now: T0, version: "1" });
    expect(widths(startingSizes(trail, { now: T0 + DAY, version: "1" }))).toEqual([1200]);
  });

  it("JS'te yakalanan başarısızlık da hatırlanır", () => {
    const phone = device();
    phone.open().failAt(2400);
    expect(widths(phone.open().sizes)[0]).toBe(1800);
  });

  it.each(["{bozuk", "2400", "null", "[1]", '{"failed":{"abc":{"at":1,"version":"x"}}}', '{"failed":{"2400":{"at":"dün"}}}', '{"attempt":{"at":1,"version":"x"}}'])("bozuk iz yok sayılır: %s", (raw) => {
    expect(startingSizes(settleCrash(parsePrintTrail(raw)), { now: T0, version: "1" })).toEqual(PRINT_SIZES);
  });

  it("serileştirme gidiş-dönüş", () => {
    const trail = beginAttempt(markFailed(EMPTY_PRINT_TRAIL, 2400, { now: T0, version: "1" }), 1800, { now: T0 + 5, version: "1" });
    expect(parsePrintTrail(serializePrintTrail(trail))).toEqual(trail);
  });
});

describe("baskı dışa aktarma: kalıcı iz yalnızca süreç ölümü için", () => {
  const T0 = 1_800_000_000_000;
  const context = { now: T0, version: "1.0.0" };

  /** Tek paylaşımlık disk; her "oturum" yeni bir `sessionFailed` kümesiyle başlar. */
  function phone() {
    const store = { disk: null as string | null, writes: [] as string[] };
    const run = (capture: (size: { width: number; height: number }) => Promise<string | null | undefined>, sessionFailed = new Set<number>(), validate?: (uri: string) => boolean) =>
      runPrintExport({
        readTrail: async () => store.disk,
        writeTrail: async (raw) => {
          store.disk = raw;
          store.writes.push(raw);
        },
        context,
        sizes: PRINT_SIZES,
        sessionFailed,
        capture,
        validate,
      });
    return { store, run };
  }
  const ok = (uri: string) => async () => uri;
  const startedWidths = (capture: jest.Mock) => capture.mock.calls.map((call) => call[0].width);

  it("tek seferlik düzen zaman aşımı: o oturumda geri düşer, diske yazılmaz, yeni oturum yine 2400'den başlar", async () => {
    const { store, run } = phone();
    const capture = jest.fn().mockRejectedValueOnce(new PrintLayoutTimeoutError()).mockResolvedValueOnce("file://b.png");
    const first = await run(capture);
    expect(first.result?.size.width).toBe(1800);
    expect(first.timedOut).toBe(true);
    expect(startedWidths(capture)).toEqual([2400, 1800]);
    // Diskte başarısızlık ve bekleyen deneme izi yok
    expect(parsePrintTrail(store.disk)).toEqual({ failed: {}, attempt: null });

    const next = jest.fn(ok("file://c.png"));
    await run(next); // yeni oturum: boş küme
    expect(startedWidths(next)).toEqual([2400]);
  });

  it("üç boyutta da zaman aşımı: hiçbiri diske yazılmaz, yeni oturum tam sırayla başlar", async () => {
    const { store, run } = phone();
    const failing = jest.fn().mockRejectedValue(new PrintLayoutTimeoutError());
    expect((await run(failing)).result).toBeNull();
    expect(startedWidths(failing)).toEqual([2400, 1800, 1200]);
    expect(parsePrintTrail(store.disk).failed).toEqual({});
    const next = jest.fn(ok("file://a.png"));
    await run(next);
    expect(startedWidths(next)).toEqual([2400]);
  });

  it("boş çıktı da yalnızca o oturumda geri düşürür", async () => {
    const { store, run } = phone();
    const capture = jest.fn().mockResolvedValueOnce("file://blank.png").mockResolvedValueOnce("file://ok.png");
    const first = await run(capture, new Set(), (uri) => uri === "file://ok.png");
    expect(first.result?.size.width).toBe(1800);
    expect(first.timedOut).toBe(false);
    expect(parsePrintTrail(store.disk)).toEqual({ failed: {}, attempt: null });
    const next = jest.fn(ok("file://a.png"));
    await run(next);
    expect(startedWidths(next)).toEqual([2400]);
  });

  it("aynı oturumda 'tekrar dene': oturumda başarısız sayılan boyut atlanır", async () => {
    const { run } = phone();
    const session = new Set<number>();
    await run(jest.fn().mockRejectedValueOnce(new PrintLayoutTimeoutError()).mockResolvedValueOnce("file://b.png"), session);
    expect([...session]).toEqual([2400]);
    const retry = jest.fn(ok("file://c.png"));
    const second = await run(retry, session);
    expect(startedWidths(retry)).toEqual([1800]);
    expect(second.result?.size.width).toBe(1800);
  });

  it("oturumda hepsi başarısızsa en küçük yine denenir; başarırsa kümeden çıkar, büyükler atlanmayı sürdürür", async () => {
    const { run } = phone();
    const session = new Set<number>([2400, 1800, 1200]);
    const retry = jest.fn(ok("file://c.png"));
    expect((await run(retry, session)).result?.size.width).toBe(1200); // hepsi başarısızsa en küçük denenir
    expect([...session].sort()).toEqual([1800, 2400]);
  });

  it("gerçek süreç ölümü: deneme izi yakalamadan ÖNCE diske yazılır, sonraki oturum bir alt boyuttan başlar", async () => {
    const { store, run } = phone();
    void run(() => new Promise<string>(() => {})); // yakalamada süreç ölür: sonuç hiç gelmez
    await new Promise<void>((resolve) => setImmediate(() => resolve()));
    expect(parsePrintTrail(store.disk).attempt?.width).toBe(2400);
    const next = jest.fn(ok("file://b.png"));
    await run(next);
    expect(startedWidths(next)).toEqual([1800]);
    // 1800 başarılı: kendi izi yok, 2400'ün çökme izi kalır
    expect(Object.keys(parsePrintTrail(store.disk).failed)).toEqual(["2400"]);
    expect(parsePrintTrail(store.disk).attempt).toBeNull();
  });

  it("çökme izi kalıcıdır: sonraki oturumda zaman aşımı yaşanması iz eklemez", async () => {
    const { store, run } = phone();
    void run(() => new Promise<string>(() => {}));
    await new Promise<void>((resolve) => setImmediate(() => resolve()));
    await run(jest.fn().mockRejectedValueOnce(new PrintLayoutTimeoutError()).mockResolvedValueOnce("file://c.png"));
    expect(Object.keys(parsePrintTrail(store.disk).failed)).toEqual(["2400"]); // yalnızca çökme; 1800'ün zaman aşımı yok
  });

  it("deneme sırasında hata yakalanırsa bekleyen deneme izi silinir (çökme sanılmaz)", async () => {
    const { store, run } = phone();
    await run(jest.fn().mockRejectedValue(new Error("oom")));
    expect(parsePrintTrail(store.disk).attempt).toBeNull();
    const next = jest.fn(ok("file://a.png"));
    await run(next);
    expect(startedWidths(next)).toEqual([2400]);
  });

  it("depolama okunamaz ya da yazılamazsa dışa aktarma sürer", async () => {
    const capture = jest.fn(ok("file://a.png"));
    const result = await runPrintExport({
      readTrail: async () => Promise.reject(new Error("disk")),
      writeTrail: async () => Promise.reject(new Error("disk")),
      context,
      sizes: PRINT_SIZES,
      sessionFailed: new Set(),
      capture,
    });
    expect(result.result?.size.width).toBe(2400);
  });
});

describe("boş görsel denetimi", () => {
  const big = PRINT_SIZES[0];
  const small = PRINT_SIZES[2];

  it("eşik sabittir", () => {
    expect(MIN_PRINT_BYTES_PER_PIXEL).toBe(0.015);
  });

  it("tek renkli büyüklükteki dosya reddedilir, poster büyüklüğündeki kabul edilir", () => {
    expect(isPlausibleCapture(36 * 1024, big)).toBe(false);
    expect(isPlausibleCapture(435 * 1024, big)).toBe(true);
  });

  it("eşik piksele orantılıdır", () => {
    const threshold = small.width * small.height * MIN_PRINT_BYTES_PER_PIXEL;
    expect(isPlausibleCapture(threshold, small)).toBe(true);
    expect(isPlausibleCapture(threshold - 1, small)).toBe(false);
    expect(isPlausibleCapture(threshold, big)).toBe(false);
  });

  it.each([0, NaN, Infinity, -5])("geçersiz boyut (%p): reddedilir", (bytes) => {
    expect(isPlausibleCapture(bytes, big)).toBe(false);
  });
});

describe("iOS başlangıç boyutu", () => {
  const widths = (sizes: readonly { width: number }[]) => sizes.map((size) => size.width);

  it("varsayılan sınırsızdır (cihaz doğrulamasına kadar)", () => {
    expect(IOS_MAX_PRINT_WIDTH).toBeNull();
    expect(widths(printSizesFor("ios"))).toEqual([2400, 1800, 1200]);
    expect(widths(printSizesFor("android"))).toEqual([2400, 1800, 1200]);
  });

  it("sabit açıldığında yalnızca iOS etkilenir", () => {
    expect(widths(printSizesFor("ios", 1800))).toEqual([1800, 1200]);
    expect(widths(printSizesFor("android", 1800))).toEqual([2400, 1800, 1200]);
  });
});

describe("düzen zaman aşımı", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("onLayout gelirse true, zamanlayıcı temizlenir", async () => {
    let done = () => {};
    const promise = waitForLayout((onLaidOut) => {
      done = onLaidOut;
    }, 1500);
    done();
    await expect(promise).resolves.toBe(true);
    expect(jest.getTimerCount()).toBe(0);
  });

  it("süre dolarsa false", async () => {
    const promise = waitForLayout(() => {}, 1500);
    jest.advanceTimersByTime(1499);
    let settled = false;
    void promise.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    jest.advanceTimersByTime(1);
    await expect(promise).resolves.toBe(false);
  });

  it("zaman aşımı istisnası deneme başarısızlığı sayılır, alt boyuta düşülür ve neden bildirilir", async () => {
    const { PrintLayoutTimeoutError } = jest.requireActual<typeof import("../printExport")>("../printExport");
    jest.useRealTimers();
    const timeout = new PrintLayoutTimeoutError();
    const failures: unknown[] = [];
    const capture = jest.fn().mockRejectedValueOnce(timeout).mockResolvedValueOnce("file://b.png");
    const result = await captureWithFallback(PRINT_SIZES, capture, (_size, error) => failures.push(error));
    expect(result?.size.width).toBe(1800);
    expect(failures[0]).toBeInstanceOf(PrintLayoutTimeoutError);
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
