/// <reference types="jest" />
import tzlookup from "tz-lookup";

import { computeSky } from "../computeSky";
import { wallTimeToUtc, type OffsetAt } from "../timezone";

jest.mock("tz-lookup", () => jest.fn(jest.requireActual("tz-lookup")));
const lookupMock = tzlookup as unknown as jest.Mock;

const HOUR = 3600000;
const PLACES = {
  istanbul: { latitude: 41.0082, longitude: 28.9784 },
  berlin: { latitude: 52.52, longitude: 13.405 },
  sydney: { latitude: -33.8688, longitude: 151.2093 },
  tokyo: { latitude: 35.6762, longitude: 139.6503 },
  newYork: { latitude: 40.7128, longitude: -74.006 },
};

function sky(place: keyof typeof PLACES, date: string, time: string, timeZone?: string) {
  return computeSky({ ...PLACES[place], date, time, timeZone });
}

describe("konumdan saat dilimi, gerçek Intl ile tarihî fark", () => {
  it.each([
    ["istanbul", "2025-02-14", "22:00", "Europe/Istanbul", 180, "2025-02-14T19:00:00.000Z"],
    ["istanbul", "2012-07-01", "12:00", "Europe/Istanbul", 180, "2012-07-01T09:00:00.000Z"],
    ["istanbul", "2012-01-15", "12:00", "Europe/Istanbul", 120, "2012-01-15T10:00:00.000Z"],
    ["berlin", "2025-07-01", "12:00", "Europe/Berlin", 120, "2025-07-01T10:00:00.000Z"],
    ["berlin", "2025-01-15", "12:00", "Europe/Berlin", 60, "2025-01-15T11:00:00.000Z"],
    ["sydney", "2025-01-15", "12:00", "Australia/Sydney", 660, "2025-01-15T01:00:00.000Z"],
    ["sydney", "2025-07-15", "12:00", "Australia/Sydney", 600, "2025-07-15T02:00:00.000Z"],
    ["tokyo", "2025-07-15", "12:00", "Asia/Tokyo", 540, "2025-07-15T03:00:00.000Z"],
  ] as const)("%s %s %s", (place, date, time, zone, offset, utc) => {
    const result = sky(place, date, time);
    expect(result.timeZone).toBe(zone);
    expect(result.timeZoneSource).toBe("lookup");
    expect(result.utcOffsetMinutes).toBe(offset);
    expect(result.utcIso).toBe(utc);
    expect(result.timeAmbiguity).toBeNull();
  });
});

describe("yaz saati geçişleri", () => {
  it("New York 2020-03-08 02:30 yoktur: atlama kadar ileri kayar", () => {
    const result = sky("newYork", "2020-03-08", "02:30");
    expect(result.timeAmbiguity).toBe("gap");
    expect(result.utcIso).toBe("2020-03-08T07:30:00.000Z"); // 03:30 EDT
    expect(result.utcOffsetMinutes).toBe(-240);
  });

  it("New York 2020-11-01 01:30 iki kez yaşanır: ilk oluşum alınır", () => {
    const result = sky("newYork", "2020-11-01", "01:30");
    expect(result.timeAmbiguity).toBe("overlap");
    expect(result.utcIso).toBe("2020-11-01T05:30:00.000Z"); // 01:30 EDT
    expect(result.utcOffsetMinutes).toBe(-240);
  });

  it("geçişin hemen yanındaki saatler belirsiz değildir", () => {
    expect(sky("newYork", "2020-03-08", "01:59").timeAmbiguity).toBeNull();
    expect(sky("newYork", "2020-03-08", "03:00").timeAmbiguity).toBeNull();
    expect(sky("newYork", "2020-11-01", "00:59").timeAmbiguity).toBeNull();
    expect(sky("newYork", "2020-11-01", "02:00").timeAmbiguity).toBeNull();
    expect(sky("newYork", "2020-11-01", "02:00").utcIso).toBe("2020-11-01T07:00:00.000Z");
  });

  it("Samoa'nın atladığı gün (2011-12-30) boşluk sayılır", () => {
    const result = computeSky({ latitude: -13.83, longitude: -171.76, date: "2011-12-30", time: "12:00", timeZone: "Pacific/Apia" });
    expect(result.timeAmbiguity).toBe("gap");
    expect(result.utcIso).toBe("2011-12-30T22:00:00.000Z");
  });
});

describe("bölge seçimi ve geri düşüş", () => {
  beforeEach(() => lookupMock.mockClear());

  it("timeZone verilirse konum araması yapılmaz", () => {
    const result = sky("istanbul", "2025-02-14", "22:00", "Asia/Tokyo");
    expect(lookupMock).not.toHaveBeenCalled();
    expect(result.timeZone).toBe("Asia/Tokyo");
    expect(result.timeZoneSource).toBe("request");
    expect(result.utcOffsetMinutes).toBe(540);
  });

  it("timeZone yoksa konum aranır", () => {
    sky("berlin", "2025-02-14", "22:00");
    expect(lookupMock).toHaveBeenCalledTimes(1);
    expect(lookupMock).toHaveBeenCalledWith(PLACES.berlin.latitude, PLACES.berlin.longitude);
  });

  it("Intl'in tanımadığı bölge cihaz saat dilimine düşer", () => {
    const device = new Intl.DateTimeFormat().resolvedOptions().timeZone;
    const result = sky("istanbul", "2025-02-14", "22:00", "Mars/Olympus_Mons");
    expect(result.timeZoneSource).toBe("device");
    expect(result.timeZone).toBe(device);
  });

  it("konum araması patlarsa cihaz saat dilimine düşer", () => {
    lookupMock.mockImplementationOnce(() => {
      throw new RangeError("bad");
    });
    expect(sky("istanbul", "2025-02-14", "22:00").timeZoneSource).toBe("device");
  });

  it("açık denizde Etc/GMT bölgesi kullanılır", () => {
    const result = computeSky({ latitude: -45, longitude: -130, date: "2025-02-14", time: "12:00" });
    expect(result.timeZone).toBe("Etc/GMT+9"); // POSIX işareti ters: UTC−9
    expect(result.timeZoneSource).toBe("lookup");
    expect(result.utcOffsetMinutes).toBe(-540);
  });

  it("kutuplarda ve tarih çizgisinde çalışır", () => {
    for (const [latitude, longitude] of [[90, 0], [-90, 0], [0, 180], [0, -180]]) {
      expect(computeSky({ latitude, longitude, date: "2025-02-14", time: "12:00" }).timeZoneSource).toBe("lookup");
    }
  });
});

describe("wallTimeToUtc (sahte fark fonksiyonuyla)", () => {
  const WALL = Date.UTC(2020, 5, 1, 12);

  function stepAt(transitionUtc: number, before: number, after: number): OffsetAt {
    return (utcMs) => (utcMs < transitionUtc ? before : after);
  }

  it("geçiş yoksa sabit farkı uygular", () => {
    expect(wallTimeToUtc(WALL, () => 3 * HOUR)).toEqual({ utcMs: WALL - 3 * HOUR, offsetMs: 3 * HOUR, ambiguity: null });
  });

  it("geçişe uzak saatlerde doğru tarafı seçer", () => {
    const offsetAt = stepAt(WALL + 12 * HOUR, 2 * HOUR, 3 * HOUR);
    expect(wallTimeToUtc(WALL, offsetAt)).toEqual({ utcMs: WALL - 2 * HOUR, offsetMs: 2 * HOUR, ambiguity: null });
    const earlier = stepAt(WALL - 12 * HOUR, 2 * HOUR, 3 * HOUR);
    expect(wallTimeToUtc(WALL, earlier)).toEqual({ utcMs: WALL - 3 * HOUR, offsetMs: 3 * HOUR, ambiguity: null });
  });

  it("boşlukta geçiş sonrası farkı döner", () => {
    // Geçiş duvar saatiyle 11:30 → 12:30 (UTC 09:30)
    const offsetAt = stepAt(WALL - 2.5 * HOUR, 2 * HOUR, 3 * HOUR);
    expect(wallTimeToUtc(WALL, offsetAt)).toEqual({ utcMs: WALL - 2 * HOUR, offsetMs: 3 * HOUR, ambiguity: "gap" });
  });

  it("çakışmada ilk oluşumu döner", () => {
    // Geçiş duvar saatiyle 12:30 → 11:30 (UTC 09:30)
    const offsetAt = stepAt(WALL - 2.5 * HOUR, 3 * HOUR, 2 * HOUR);
    expect(wallTimeToUtc(WALL, offsetAt)).toEqual({ utcMs: WALL - 3 * HOUR, offsetMs: 3 * HOUR, ambiguity: "overlap" });
  });
});
