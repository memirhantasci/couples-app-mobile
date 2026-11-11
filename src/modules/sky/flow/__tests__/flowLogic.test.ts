/// <reference types="jest" />
import { computeSky, SkyInputError, type SkyResult } from "../../astronomy";
import {
  buildDateOptions,
  buildSkyRequest,
  clampTimeIfToday,
  cleanPlaceName,
  dateFromTime,
  dateRejection,
  defaultDateChoice,
  DEFAULT_SKY_TIME,
  effectiveTitle,
  formatDateLine,
  formatYmd,
  gateFor,
  GENERIC_SKY_ERROR_KEY,
  isValidPlace,
  isValidTime,
  MAX_TITLE_LENGTH,
  parseYmd,
  placeFromLocation,
  resolveChosenDate,
  selectWarnings,
  shortenPlaceName,
  skyErrorKey,
  timeFromDate,
  todayString,
} from "../flowLogic";

const TODAY = "2026-11-09";

describe("tarih doğrulama", () => {
  it("gerçek takvim günlerini kabul eder, uydurmayı reddeder", () => {
    expect(parseYmd("2025-02-14")).not.toBeNull();
    expect(parseYmd("2024-02-29")).not.toBeNull();
    for (const bad of ["2025-02-29", "2025-13-01", "2025-00-10", "2025-2-1", "14.02.2025", "", "2025-02-14T10:00"]) expect(parseYmd(bad)).toBeNull();
  });

  it("formatYmd yerel günü sıfır dolgulu verir", () => {
    expect(formatYmd(new Date(2025, 0, 5))).toBe("2025-01-05");
    expect(todayString(new Date(2026, 10, 9, 23, 59))).toBe("2026-11-09");
  });

  it("gelecek ve 1900 öncesi reddedilir, bugün ve 1900-01-01 kabul", () => {
    expect(dateRejection("2026-11-10", TODAY)).toBe("future");
    expect(dateRejection(TODAY, TODAY)).toBeNull();
    expect(dateRejection("1900-01-01", TODAY)).toBeNull();
    expect(dateRejection("1899-12-31", TODAY)).toBe("outOfRange");
    expect(dateRejection(null, TODAY)).toBe("missing");
    expect(dateRejection("bozuk", TODAY)).toBe("missing");
  });
});

describe("tarih seçenekleri", () => {
  const both = { meetDate: "2023-05-20", relationshipStartDate: "2023-06-01" };

  it("ikisi de varsa üç seçenek de kullanılabilir, varsayılan tanışma günü", () => {
    const options = buildDateOptions(both, null, TODAY);
    expect(options.map((o) => [o.id, o.available])).toEqual([["meet", true], ["relationship", true], ["custom", true]]);
    expect(defaultDateChoice(options)).toBe("meet");
  });

  it("tarihi olmayan seçenek pasif ve nedeni belli; varsayılan diğerine kayar", () => {
    const options = buildDateOptions({ meetDate: null, relationshipStartDate: "2023-06-01" }, null, TODAY);
    expect(options[0]).toMatchObject({ id: "meet", available: false, reason: "missing", date: null });
    expect(defaultDateChoice(options)).toBe("relationship");
  });

  it("ikisi de yoksa doğrudan başka bir tarih", () => {
    const options = buildDateOptions({}, null, TODAY);
    expect(defaultDateChoice(options)).toBe("custom");
    expect(resolveChosenDate(options, "custom")).toBeNull(); // henüz seçilmedi: ileri düğmesi pasif
  });

  it("gelecekteki kayıtlı tarih pasiftir", () => {
    const options = buildDateOptions({ meetDate: "2027-01-01", relationshipStartDate: "2023-06-01" }, null, TODAY);
    expect(options[0]).toMatchObject({ available: false, reason: "future" });
  });

  it("sunucudan gelen zaman damgalı değerin yalnızca günü alınır", () => {
    const options = buildDateOptions({ meetDate: "2023-05-20T00:00:00+00:00" }, null, TODAY);
    expect(options[0]).toMatchObject({ available: true, date: "2023-05-20" });
  });

  it("istenen seçenek kullanılabilirse öne gelir, değilse varsayılana düşer", () => {
    expect(defaultDateChoice(buildDateOptions(both, null, TODAY), "relationship")).toBe("relationship");
    expect(defaultDateChoice(buildDateOptions({ meetDate: "2023-05-20" }, null, TODAY), "relationship")).toBe("meet");
  });

  it("seçilen tarih çözümlenir; geçersiz özel tarih yok sayılır", () => {
    expect(resolveChosenDate(buildDateOptions(both, "2020-02-02", TODAY), "custom")).toBe("2020-02-02");
    expect(resolveChosenDate(buildDateOptions(both, "2030-02-02", TODAY), "custom")).toBeNull();
    expect(resolveChosenDate(buildDateOptions(both, null, TODAY), "relationship")).toBe("2023-06-01");
  });
});

describe("yer ve saat", () => {
  it("koordinat doğrulama", () => {
    expect(isValidPlace({ latitude: 41, longitude: 29 })).toBe(true);
    expect(isValidPlace({ latitude: 90, longitude: -180 })).toBe(true);
    for (const bad of [[91, 0], [0, 181], [NaN, 0], [0, Infinity]]) expect(isValidPlace({ latitude: bad[0], longitude: bad[1] })).toBe(false);
    expect(isValidPlace({ latitude: "41", longitude: 29 })).toBe(false);
  });

  it("yer adı boşsa null (poster yer satırını gizler), uzun ad kırpılır", () => {
    expect(placeFromLocation({ latitude: 41, longitude: 29, locationName: "  " })?.name).toBeNull();
    expect(placeFromLocation({ latitude: 41, longitude: 29 })?.name).toBeNull();
    expect(placeFromLocation({ latitude: 41, longitude: 29, locationName: " Kadıköy " })?.name).toBe("Kadıköy");
    expect(cleanPlaceName("x".repeat(200))).toHaveLength(80);
    expect(placeFromLocation({ latitude: 999, longitude: 0 })).toBeNull();
  });

  it("adres çözülemeyince gelen yer tutucu postere yer adı olarak gitmez", () => {
    const placeholders = ["Seçilen Konum", "Harita Üzerinde İşaretlenen Nokta", "Özel Konum"];
    for (const locationName of placeholders) expect(placeFromLocation({ latitude: 41, longitude: 29, locationName }, placeholders)?.name).toBeNull();
    expect(placeFromLocation({ latitude: 41, longitude: 29, locationName: " Seçilen Konum " }, placeholders)?.name).toBeNull();
    expect(placeFromLocation({ latitude: 41, longitude: 29, locationName: "Kadıköy, İstanbul" }, placeholders)?.name).toBe("Kadıköy, İstanbul");
  });

  it("tam adres ilçe/şehir düzeyine iner", () => {
    expect(placeFromLocation({ latitude: 41, longitude: 29, locationName: "Moda Caddesi No:12, Caferağa Mah., Kadıköy, İstanbul" })?.name).toBe("Kadıköy, İstanbul");
  });

  it("seçiciye verdiğimiz ad (kullanıcının düzenlediği) aynen geri gelirse kısaltılmaz; yeni adres kısaltılır", () => {
    const at = (locationName: string, known: string | null) => placeFromLocation({ latitude: 41, longitude: 29, locationName }, [], known)?.name;
    expect(at("İlk Buluşma 2019", "İlk Buluşma 2019")).toBe("İlk Buluşma 2019");
    expect(at("  İlk Buluşma 2019 ", "İlk Buluşma 2019")).toBe("İlk Buluşma 2019");
    expect(at("x".repeat(90), "x".repeat(90))).toHaveLength(80);
    // pin taşındı: gelen metin bilinen addan farklı, coğrafi kodlayıcı çıktısıdır
    expect(at("Moda Caddesi No:12, Kadıköy, İstanbul", "İlk Buluşma 2019")).toBe("Kadıköy, İstanbul");
    // bilinen ad yoksa her zaman kısaltılır (ilk seçim)
    expect(at("İlk Buluşma 2019", null)).toBe("İlk Buluşma");
    // yer tutucu bilinen adla aynı olsa da posterde görünmez
    expect(placeFromLocation({ latitude: 41, longitude: 29, locationName: "Seçilen Konum" }, ["Seçilen Konum"], "Seçilen Konum")?.name).toBeNull();
  });

  it("saat biçimi ve gidiş-dönüş", () => {
    expect(isValidTime("22:00")).toBe(true);
    for (const bad of ["24:00", "9:00", "22:60", "", null, 2200]) expect(isValidTime(bad)).toBe(false);
    expect(timeFromDate(dateFromTime("07:05"))).toBe("07:05");
    expect(timeFromDate(dateFromTime("bozuk"))).toBe(DEFAULT_SKY_TIME);
  });

  it("bugün seçiliyse gelecekteki saati şu anki saate çeker, geçmiş günde dokunmaz", () => {
    const fakeNow = new Date(2026, 10, 9, 14, 30); // 2026-11-09 14:30
    expect(clampTimeIfToday("2026-11-09", "22:00", fakeNow)).toBe("14:30");
    expect(clampTimeIfToday("2026-11-09", "12:15", fakeNow)).toBe("12:15");
    expect(clampTimeIfToday("2026-11-08", "22:00", fakeNow)).toBe("22:00");
    expect(clampTimeIfToday(null, "22:00", fakeNow)).toBe("22:00");
  });
});

describe("adres kısaltma", () => {
  it.each([
    // formatGeocodedAddress'in Türkçe çıktıları
    ["Moda Caddesi No:12, Caferağa Mah., Kadıköy, İstanbul", "Kadıköy, İstanbul"],
    ["Bağdat Cd. No:150/3, Kadıköy, İstanbul", "Kadıköy, İstanbul"],
    ["Atatürk Blv. 45/7, Çankaya/Ankara", "Çankaya, Ankara"],
    ["Galata Kulesi, Bereketzade Mah., Beyoğlu, İstanbul", "Beyoğlu, İstanbul"],
    ["İSTİKLAL CADDESİ, BEYOĞLU", "BEYOĞLU"],
    ["1234. Sk. No:5, Bornova, İzmir", "Bornova, İzmir"],
    // Posta kodlu, ülkeli biçim
    ["Caferağa, Moda Cd. No:12, 34710 Kadıköy/İstanbul, Türkiye", "Kadıköy, İstanbul"],
    ["İstanbul, Türkiye", "İstanbul"],
    // Yedek arama servisi "sokak, şehir" verebilir
    ["Moda Caddesi, İstanbul", "İstanbul"],
    ["Kadıköy, İstanbul", "Kadıköy, İstanbul"],
    ["İstanbul", "İstanbul"],
    // Yabancı biçimler
    ["1600 Amphitheatre Pkwy, Amphitheatre Parkway No:1600, Santa Clara County, Mountain View, United States", "Mountain View, United States"],
    ["221B Baker St, London NW1 6XE, UK", "London, UK"],
    ["Hauptstraße 5, 10115 Berlin, Germany", "Berlin, Germany"],
    ["350 5th Ave, New York, NY 10118, USA", "New York, USA"],
    ["10 Rue de Rivoli, Rue de Rivoli No:10, 4e Arrondissement Mah., Paris, France", "Paris, France"],
    ["Rua Augusta, São Paulo, SP, Brazil", "São Paulo, Brazil"],
    ["Keizersgracht 1, 1015 CJ Amsterdam, Netherlands", "Amsterdam, Netherlands"],
    // ASCII dışı rakamlı kapı numarası (Arapça-Hint, Devanagari) ve "yol" türü sokaklar
    ["Kennedy Yolu No:٥, İstanbul", "İstanbul"],
    ["شارع التحرير No:٥, مصر", "مصر"],
    ["Kennedy Yolu, İstanbul", "İstanbul"],
    ["Piyale Paşa Yolu, İstanbul", "İstanbul"],
    ["KENNEDY YOLU, KADIKÖY, İSTANBUL", "KADIKÖY, İSTANBUL"],
    ["Gül Çıkmazı No:3, Moda, Kadıköy", "Moda, Kadıköy"],
    ["Güllü Çıkmaz Sk., Kadıköy, İstanbul", "Kadıköy, İstanbul"],
    ["Karayolu Mah., Beşiktaş, İstanbul", "Beşiktaş, İstanbul"],
    ["Sector ५, Delhi, India", "Delhi, India"],
    ["Moda No:5, Kadıköy, İstanbul", "Kadıköy, İstanbul"], // ASCII rakam
    // "St." şehir adının başındaysa sokak değildir
    ["St. Louis, MO 63101, USA", "St. Louis, USA"],
  ])("%s", (raw, expected) => {
    expect(shortenPlaceName(raw)).toBe(expected);
  });

  it.each(["Moda Cd. No:12", "Hauptstraße 5", "Moda Cd. No:12 Kadıköy İstanbul", "", "   ", null, undefined, 42])("yalnızca sokak düzeyi ya da geçersiz: %p → null", (raw) => {
    expect(shortenPlaceName(raw)).toBeNull();
  });

  it("kapı numarası, posta kodu hiçbir biçimde kalmaz", () => {
    for (const raw of ["Moda Caddesi No:12, Kadıköy, İstanbul", "34710 Kadıköy, İstanbul", "Hauptstraße 5, 10115 Berlin", "221B Baker St, London NW1 6XE", "Kennedy Yolu No:٥, İstanbul", "شارع التحرير No:٥, مصر"]) {
      expect(shortenPlaceName(raw)).not.toMatch(/\p{Nd}/u);
    }
  });

  it("tekrar eden parça bir kez yazılır, uzun sonuç sınırlanır", () => {
    expect(shortenPlaceName("Kadıköy, kadıköy, İstanbul")).toBe("Kadıköy, İstanbul");
    expect(shortenPlaceName(`${"a".repeat(60)}, ${"b".repeat(60)}`)).toHaveLength(80);
  });
});

describe("SkyRequest kurma", () => {
  const place = { latitude: 41.0082, longitude: 28.9784, name: "İstanbul" };

  it("motorun beklediği biçimi üretir; yer adı isteğe girmez", () => {
    expect(buildSkyRequest({ date: "2025-02-14", time: "22:00", place })).toEqual({ date: "2025-02-14", time: "22:00", latitude: 41.0082, longitude: 28.9784 });
  });

  it("geçersiz girdi SkyInputError ve doğru kodla düşer", () => {
    const code = (fn: () => unknown) => {
      try {
        fn();
      } catch (error) {
        return error instanceof SkyInputError ? error.code : "OTHER";
      }
      return "NONE";
    };
    expect(code(() => buildSkyRequest({ date: "2025-02-30", time: "22:00", place }))).toBe("INVALID_DATE");
    expect(code(() => buildSkyRequest({ date: "2025-02-14", time: "25:00", place }))).toBe("INVALID_TIME");
    expect(code(() => buildSkyRequest({ date: "2025-02-14", time: "22:00", place: { ...place, latitude: 100 } }))).toBe("INVALID_LOCATION");
  });

  it("motor isteği gerçekten kabul eder", () => {
    expect(computeSky(buildSkyRequest({ date: "2025-02-14", time: "22:00", place })).stars.length).toBeGreaterThan(1000);
  });
});

describe("tarih satırı", () => {
  const format = (date: Date) => `${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()}`;
  it("saat biliniyorsa 'gün · saat'", () => {
    expect(formatDateLine("2025-02-14", "22:00", true, format)).toBe("14.2.2025 · 22:00");
  });
  it("saat hatırlanmıyorsa posterde saat yazmaz", () => {
    expect(formatDateLine("2025-02-14", "22:00", false, format)).toBe("14.2.2025");
  });
  it("dayjs ile TR/EN biçim", () => {
    const dayjs = jest.requireActual<typeof import("dayjs")>("dayjs");
    jest.requireActual("dayjs/locale/tr");
    jest.requireActual("dayjs/locale/en");
    const make = (lang: string) => formatDateLine("2025-02-14", "22:00", true, (d) => dayjs(d).locale(lang).format("D MMMM YYYY"));
    expect(make("tr")).toBe("14 Şubat 2025 · 22:00");
    expect(make("en")).toBe("14 February 2025 · 22:00");
  });
});

describe("uyarı seçimi", () => {
  const base = computeSky({ latitude: 41.0082, longitude: 28.9784, date: "2025-02-14", time: "22:00" });
  const withPatch = (patch: Partial<SkyResult> & { twilight?: SkyResult["sun"]["twilight"] }): SkyResult => ({
    ...base,
    ...patch,
    sun: { ...base.sun, twilight: patch.twilight ?? base.sun.twilight },
  });

  it("gerçek bir gece uyarısızdır", () => {
    expect(base.sun.twilight).toBe("night");
    expect(selectWarnings(base)).toEqual([]);
  });

  it("kademeler: gündüz/sivil güçlü, deniz yumuşak, astronomik/gece uyarısız", () => {
    expect(selectWarnings(withPatch({ twilight: "day" }))).toEqual(["daylight"]);
    expect(selectWarnings(withPatch({ twilight: "civil" }))).toEqual(["daylight"]);
    expect(selectWarnings(withPatch({ twilight: "nautical" }))).toEqual(["twilight"]);
    expect(selectWarnings(withPatch({ twilight: "astronomical" }))).toEqual([]);
    expect(selectWarnings(withPatch({ twilight: "night" }))).toEqual([]);
  });

  it("gerçek motor: İstanbul'da yaz akşamı 22:00 astronomik alacakaranlıktır ve uyarı çıkmaz", () => {
    const summer = computeSky({ latitude: 41.0082, longitude: 28.9784, date: "2025-06-21", time: "22:00" });
    expect(summer.sun.twilight).toBe("astronomical");
    expect(selectWarnings(summer)).toEqual([]);
  });

  it("gerçek motor: İstanbul'da 2025 boyunca 22:00'de hiç gündüz uyarısı çıkmaz, yanlış uyarı kalkar", () => {
    const counts: Record<string, number> = { day: 0, civil: 0, nautical: 0, astronomical: 0, night: 0 };
    let warned = 0;
    for (let day = 0; day < 365; day++) {
      const date = formatYmd(new Date(2025, 0, 1 + day));
      const sky = computeSky({ latitude: 41.0082, longitude: 28.9784, date, time: "22:00" });
      counts[sky.sun.twilight]++;
      if (selectWarnings(sky).length > 0) warned++;
    }
    if (process.env.SKY_REPORT) console.log(`İstanbul 22:00, 2025: ${JSON.stringify(counts)}; yeni uyarı ${warned} gün`);
    expect(counts.day + counts.civil).toBe(0);
    expect(counts.astronomical).toBeGreaterThan(80); // eski kuralın yanlış uyarı verdiği günler
    expect(warned).toBe(counts.nautical);
  });

  it("gerçek öğle saati", () => {
    const noon = computeSky({ latitude: 41.0082, longitude: 28.9784, date: "2025-06-21", time: "13:00" });
    expect(selectWarnings(noon)).toEqual(["daylight"]);
  });

  it("geçiş ve cihaz saat dilimi uyarıları, sabit sırayla", () => {
    expect(selectWarnings(withPatch({ timeAmbiguity: "gap" }))).toEqual(["gap"]);
    expect(selectWarnings(withPatch({ timeAmbiguity: "overlap" }))).toEqual(["overlap"]);
    expect(selectWarnings(withPatch({ timeZoneSource: "device", timeAmbiguity: "gap", twilight: "day" }))).toEqual(["deviceTimeZone", "gap", "daylight"]);
  });

  it("gerçek yaz saati geçişi motordan 'gap' olarak gelir", () => {
    const gap = computeSky({ latitude: 40.7128, longitude: -74.006, date: "2020-03-08", time: "02:30" });
    expect(selectWarnings(gap)).toContain("gap");
  });
});

describe("hata → çeviri anahtarı", () => {
  it.each([
    ["INVALID_DATE", "sky.flow.errors.invalidDate"],
    ["INVALID_TIME", "sky.flow.errors.invalidTime"],
    ["INVALID_LOCATION", "sky.flow.errors.invalidLocation"],
    ["OUT_OF_RANGE", "sky.flow.errors.outOfRange"],
  ] as const)("%s", (code, key) => {
    expect(skyErrorKey(new SkyInputError(code, "x"))).toBe(key);
  });

  it("beklenmedik hata genel mesaja düşer", () => {
    expect(skyErrorKey(new Error("boom"))).toBe(GENERIC_SKY_ERROR_KEY);
    expect(skyErrorKey("metin")).toBe(GENERIC_SKY_ERROR_KEY);
    expect(skyErrorKey(null)).toBe(GENERIC_SKY_ERROR_KEY);
  });
});

describe("Premium kapısı", () => {
  const free = { isPremium: false, isDemoMode: false };
  const premium = { isPremium: true, isDemoMode: false };
  const demo = { isPremium: false, isDemoMode: true };

  it("önizleme ve hikâye paylaşımı herkese açık", () => {
    for (const user of [free, premium, demo]) {
      expect(gateFor("preview", user)).toBe("allow");
      expect(gateFor("storyShare", user)).toBe("allow");
    }
  });

  it("özel başlık: ücretsize paywall, Premium'a serbest, demoya kayıt isteği", () => {
    expect(gateFor("customTitle", free)).toBe("paywall");
    expect(gateFor("customTitle", premium)).toBe("allow");
    expect(gateFor("customTitle", demo)).toBe("signup");
  });

  it("baskı dosyası: ücretsize paywall, Premium'a açık, demoya kayıt isteği", () => {
    expect(gateFor("printExport", free)).toBe("paywall");
    expect(gateFor("printExport", premium)).toBe("allow");
    expect(gateFor("printExport", demo)).toBe("signup");
  });

  it("demo profili Premium görünse de kayıt isteğine gider, önizleme ve hikâye açık kalır", () => {
    const demoPremium = { isPremium: true, isDemoMode: true };
    expect(gateFor("printExport", demoPremium)).toBe("signup");
    expect(gateFor("customTitle", demoPremium)).toBe("signup");
    expect(gateFor("preview", demoPremium)).toBe("allow");
    expect(gateFor("storyShare", demoPremium)).toBe("allow");
  });

  it("özel başlık: Premium değilse hiç uygulanmaz, kırpılır, boşsa varsayılan", () => {
    expect(effectiveTitle("Bizim Gece", false)).toBeNull();
    expect(effectiveTitle("  Bizim Gece  ", true)).toBe("Bizim Gece");
    expect(effectiveTitle("   ", true)).toBeNull();
    expect(effectiveTitle(null, true)).toBeNull();
    expect(effectiveTitle("x".repeat(100), true)).toHaveLength(MAX_TITLE_LENGTH);
  });
});
