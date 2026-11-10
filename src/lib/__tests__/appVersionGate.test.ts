/// <reference types="jest" />
/// <reference types="node" />
import { readFileSync } from "fs";
import { join } from "path";

import {
  DEFAULT_STORE_URLS,
  GATE_CACHE_MAX_AGE_MS,
  GATE_CHECK_INTERVAL_MS,
  GATE_LOCKED_CHECK_INTERVAL_MS,
  GATE_MESSAGE_MAX_LENGTH,
  cleanStoreUrl,
  compareVersions,
  decideGate,
  fetchRequirement,
  parseBuild,
  parseRequirementResponse,
  parseVersion,
  pickGateMessage,
  readGateCache,
  resolveRequirement,
  serializeGateCache,
  shouldCheck,
  type GateInput,
  type RequirementRpc,
  type VersionRequirement,
} from "../appVersionGate";

/**
 * Zorunlu güncelleme kapısının karar mantığı. Ana kural: her belirsizlikte kapı AÇIK; yalnızca geçerli bir
 * asgari sürüm bilindiğinde ve cihazın sürümü ondan kesin olarak küçük olduğunda kapanır.
 */

const req = (overrides: Partial<VersionRequirement> = {}): VersionRequirement => ({
  minVersion: "1.1.0",
  minBuild: null,
  storeUrl: null,
  messageTr: null,
  messageEn: null,
  ...overrides,
});

const input = (overrides: Partial<GateInput> = {}): GateInput => ({
  platform: "ios",
  isDemoMode: false,
  deviceVersion: "1.0.0",
  deviceBuild: "18",
  requirement: req(),
  ...overrides,
});

describe("parseVersion", () => {
  it.each([
    ["1", [1]],
    ["1.0", [1, 0]],
    ["1.0.0", [1, 0, 0]],
    ["1.10.2", [1, 10, 2]],
    ["10.0.0.7", [10, 0, 0, 7]],
    ["001.002.003", [1, 2, 3]],
    ["999999.0", [999999, 0]],
  ])("%s geçerli", (value, expected) => {
    expect(parseVersion(value)).toEqual(expected);
  });

  it.each([
    "",
    " ",
    " 1.0.0",
    "1.0.0 ",
    "v1.0.0",
    "1.0.0-beta",
    "1.0.0+5",
    "1..0",
    ".1",
    "1.",
    "1.0.0.0.0",
    "1234567.0",
    "1,0,0",
    "١.٠.٠",
    "NaN",
    "Infinity",
  ])("%j geçersiz", (value) => {
    expect(parseVersion(value)).toBeNull();
  });

  it.each([null, undefined, 1, 1.1, {}, [], true])("metin olmayan %p geçersiz", (value) => {
    expect(parseVersion(value)).toBeNull();
  });
});

describe("compareVersions", () => {
  const cmp = (a: string, b: string) => compareVersions(parseVersion(a)!, parseVersion(b)!);

  it("küçük / eşit / büyük", () => {
    expect(cmp("1.0.0", "1.1.0")).toBe(-1);
    expect(cmp("1.1.0", "1.1.0")).toBe(0);
    expect(cmp("1.2.0", "1.1.0")).toBe(1);
  });

  it("çok basamaklı parçalar sayı olarak karşılaştırılır (metin olarak değil)", () => {
    expect(cmp("1.10.0", "1.9.0")).toBe(1);
    expect(cmp("1.9.9", "1.10.0")).toBe(-1);
    expect(cmp("2.0.0", "10.0.0")).toBe(-1);
    expect(cmp("1.0.10", "1.0.2")).toBe(1);
    expect(cmp("100.0", "99.999")).toBe(1);
  });

  it("eksik parçalar 0 sayılır", () => {
    expect(cmp("1.1", "1.1.0")).toBe(0);
    expect(cmp("1", "1.0.0.0")).toBe(0);
    expect(cmp("1.1", "1.1.1")).toBe(-1);
    expect(cmp("1.1.0.1", "1.1")).toBe(1);
  });
});

describe("parseBuild", () => {
  it.each([
    ["18", 18],
    ["1", 1],
    [11, 11],
    ["0018", 18],
    ["2147483647", 2147483647],
  ])("%p → %p", (value, expected) => {
    expect(parseBuild(value)).toBe(expected);
  });

  it.each(["", "0", 0, -1, 1.5, "1.5", "18a", " 18", "2147483648", "99999999999", NaN, Infinity, null, undefined, {}])(
    "%p geçersiz",
    (value) => {
      expect(parseBuild(value)).toBeNull();
    }
  );
});

describe("cleanStoreUrl", () => {
  it("platformun mağaza alan adındaki https adresini kabul eder", () => {
    expect(cleanStoreUrl("https://apps.apple.com/app/id6829036716", "ios")).toBe("https://apps.apple.com/app/id6829036716");
    expect(cleanStoreUrl("https://itunes.apple.com/app/id1", "ios")).toBe("https://itunes.apple.com/app/id1");
    expect(cleanStoreUrl("https://play.google.com/store/apps/details?id=x", "android")).toBe(
      "https://play.google.com/store/apps/details?id=x"
    );
  });

  it.each([
    ["http://apps.apple.com/app/id1", "ios"],
    ["https://play.google.com/store/apps/details?id=x", "ios"],
    ["https://apps.apple.com/app/id1", "android"],
    ["https://apps.apple.com.evil.example/app", "ios"],
    ["https://evil.example/?u=https://apps.apple.com", "ios"],
    ["https://play.google.com@evil.example/", "android"],
    ["itms-apps://apps.apple.com/app/id1", "ios"],
    ["market://details?id=x", "android"],
    ["javascript:alert(1)", "ios"],
    ["", "ios"],
    [`https://apps.apple.com/${"a".repeat(300)}`, "ios"],
  ] as const)("%s (%s) reddedilir", (url, platform) => {
    expect(cleanStoreUrl(url, platform)).toBeNull();
  });

  it("metin olmayan değer reddedilir", () => {
    expect(cleanStoreUrl(null, "ios")).toBeNull();
    expect(cleanStoreUrl(42, "android")).toBeNull();
  });
});

describe("parseRequirementResponse", () => {
  it("null = sunucuda satır yok (geçerli yanıt, koşul yok)", () => {
    expect(parseRequirementResponse(null, "ios")).toEqual({ kind: "ok", requirement: null });
  });

  it("geçerli satırı ayrıştırır", () => {
    expect(
      parseRequirementResponse(
        {
          platform: "android",
          min_version: "1.1.0",
          min_build: 14,
          store_url: "https://play.google.com/store/apps/details?id=app.couplesky.mobile",
          message_tr: "  Yeni sürüm hazır.  ",
          message_en: "A new version is ready.",
        },
        "android"
      )
    ).toEqual({
      kind: "ok",
      requirement: {
        minVersion: "1.1.0",
        minBuild: 14,
        storeUrl: "https://play.google.com/store/apps/details?id=app.couplesky.mobile",
        messageTr: "Yeni sürüm hazır.",
        messageEn: "A new version is ready.",
      },
    });
  });

  it("başlangıç satırı (min_version null) koşulsuz geçerli yanıttır", () => {
    const outcome = parseRequirementResponse(
      { platform: "ios", min_version: null, min_build: null, store_url: DEFAULT_STORE_URLS.ios, message_tr: null, message_en: null },
      "ios"
    );
    expect(outcome).toEqual({ kind: "ok", requirement: req({ minVersion: null, storeUrl: DEFAULT_STORE_URLS.ios }) });
  });

  it("bozuk alanlar tek tek yok sayılır: bozuk min_version kapıyı kapatmaz, build de düşer", () => {
    const outcome = parseRequirementResponse(
      { min_version: "1.1.0-beta", min_build: 20, store_url: "http://x", message_tr: "", message_en: 5 },
      "ios"
    );
    expect(outcome).toEqual({
      kind: "ok",
      requirement: { minVersion: null, minBuild: null, storeUrl: null, messageTr: null, messageEn: null },
    });
  });

  it("çok uzun sunucu metni yok sayılır", () => {
    const outcome = parseRequirementResponse({ min_version: "1.1.0", message_tr: "a".repeat(GATE_MESSAGE_MAX_LENGTH + 1) }, "ios");
    expect(outcome.kind === "ok" && outcome.requirement?.messageTr).toBeNull();
  });

  it.each([undefined, "1.1.0", 1, true, [], [{ min_version: "1.1.0" }]])("nesne olmayan %p bozuk yanıttır", (data) => {
    expect(parseRequirementResponse(data, "ios")).toEqual({ kind: "error", reason: "malformed" });
  });

  it("başka platformun satırı bozuk yanıttır (platform ayrımı)", () => {
    expect(parseRequirementResponse({ platform: "android", min_version: "9.0.0" }, "ios")).toEqual({
      kind: "error",
      reason: "malformed",
    });
  });
});

describe("fetchRequirement", () => {
  const ok = (data: unknown): RequirementRpc => jest.fn(() => Promise.resolve({ data, error: null }));

  it("RPC'yi platformla çağırır ve yanıtı ayrıştırır", async () => {
    const rpc = ok({ platform: "android", min_version: "1.1.0" });
    await expect(fetchRequirement(rpc, "android")).resolves.toEqual({
      kind: "ok",
      requirement: req({ minVersion: "1.1.0" }),
    });
    expect(rpc).toHaveBeenCalledWith("get_app_version_requirement", { p_platform: "android" });
  });

  it("RPC hatası (ör. fonksiyon yok, PGRST202) → error", async () => {
    const rpc: RequirementRpc = () => Promise.resolve({ data: null, error: { code: "PGRST202", message: "not found" } });
    await expect(fetchRequirement(rpc, "ios")).resolves.toEqual({ kind: "error", reason: "rpc" });
  });

  it("ağ hatası (reddedilen söz) → error, fırlatmaz", async () => {
    const rpc: RequirementRpc = () => Promise.reject(new TypeError("Network request failed"));
    await expect(fetchRequirement(rpc, "ios")).resolves.toEqual({ kind: "error", reason: "network" });
  });

  it("eşzamanlı fırlatan çağrı → error", async () => {
    const rpc: RequirementRpc = () => {
      throw new Error("boom");
    };
    await expect(fetchRequirement(rpc, "ios")).resolves.toEqual({ kind: "error", reason: "network" });
  });

  it("bozuk yanıt → error", async () => {
    await expect(fetchRequirement(ok("1.1.0"), "ios")).resolves.toEqual({ kind: "error", reason: "malformed" });
  });

  describe("zaman aşımı", () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it("yanıt gelmezse süre dolunca error (timeout) döner", async () => {
      const rpc: RequirementRpc = () => new Promise(() => {});
      const pending = fetchRequirement(rpc, "ios", 5000);
      jest.advanceTimersByTime(4999);
      await Promise.resolve();
      let settled = false;
      void pending.then(() => (settled = true));
      await Promise.resolve();
      expect(settled).toBe(false);
      jest.advanceTimersByTime(1);
      await expect(pending).resolves.toEqual({ kind: "error", reason: "timeout" });
    });

    it("yanıt süreden önce gelirse zamanlayıcı temizlenir", async () => {
      const result = fetchRequirement(ok(null), "ios", 5000);
      await expect(result).resolves.toEqual({ kind: "ok", requirement: null });
      expect(jest.getTimerCount()).toBe(0);
    });
  });
});

describe("önbellek", () => {
  const NOW = Date.UTC(2026, 10, 11, 12);

  it("yazılan kayıt aynı platformda geri okunur", () => {
    const raw = serializeGateCache("ios", req({ minVersion: "1.1.0", minBuild: 20, messageTr: "Güncelle" }), NOW);
    expect(readGateCache(raw, "ios", NOW + 1000)).toEqual({
      requirement: req({ minVersion: "1.1.0", minBuild: 20, messageTr: "Güncelle" }),
    });
  });

  it("'koşul yok' yanıtı da saklanır (kilidi kaldırmak için)", () => {
    expect(readGateCache(serializeGateCache("android", null, NOW), "android", NOW)).toEqual({ requirement: null });
  });

  it("başka platformun kaydı kullanılmaz", () => {
    expect(readGateCache(serializeGateCache("android", req(), NOW), "ios", NOW)).toBeUndefined();
  });

  it("çok eski kayıt kullanılmaz; sınırda kullanılır", () => {
    const raw = serializeGateCache("ios", req(), NOW);
    expect(readGateCache(raw, "ios", NOW + GATE_CACHE_MAX_AGE_MS)).toBeDefined();
    expect(readGateCache(raw, "ios", NOW + GATE_CACHE_MAX_AGE_MS + 1)).toBeUndefined();
  });

  it("geleceğe yazılmış kayıt (saat oynamış) kullanılmaz", () => {
    expect(readGateCache(serializeGateCache("ios", req(), NOW + 2 * 24 * 3600 * 1000), "ios", NOW)).toBeUndefined();
  });

  it.each([
    ["yok", null],
    ["boş", ""],
    ["JSON değil", "{bozuk"],
    ["dizi", "[]"],
    ["sayı", "42"],
    ["null", "null"],
    ["eski şema", JSON.stringify({ v: 0, platform: "ios", savedAt: Date.UTC(2026, 10, 11), requirement: null })],
    ["savedAt yok", JSON.stringify({ v: 1, platform: "ios", requirement: null })],
    ["savedAt metin", JSON.stringify({ v: 1, platform: "ios", savedAt: "dün", requirement: null })],
    ["requirement metin", JSON.stringify({ v: 1, platform: "ios", savedAt: Date.UTC(2026, 10, 11), requirement: "1.1.0" })],
    [
      "elle bozulmuş sürüm",
      JSON.stringify({
        v: 1,
        platform: "ios",
        savedAt: Date.UTC(2026, 10, 11),
        requirement: { minVersion: "99.0.0-x", minBuild: null, storeUrl: null, messageTr: null, messageEn: null },
      }),
    ],
    ["çok uzun", "x".repeat(5000)],
  ])("bozuk önbellek (%s) kullanılmaz", (_label, raw) => {
    expect(readGateCache(raw, "ios", NOW)).toBeUndefined();
  });

  it("önbellekteki bozuk alanlar yeniden temizlenir (adres, metin)", () => {
    const raw = JSON.stringify({
      v: 1,
      platform: "ios",
      savedAt: NOW,
      requirement: { minVersion: "1.1.0", minBuild: "abc", storeUrl: "https://evil.example", messageTr: "", messageEn: null },
    });
    expect(readGateCache(raw, "ios", NOW)).toEqual({ requirement: req({ minVersion: "1.1.0" }) });
  });
});

describe("resolveRequirement", () => {
  const cached = { requirement: req({ minVersion: "2.0.0" }) };

  it("bu oturumdaki başarılı yanıt önbelleğe üstün gelir (null bile olsa)", () => {
    expect(resolveRequirement(req({ minVersion: "1.1.0" }), cached)).toEqual(req({ minVersion: "1.1.0" }));
    expect(resolveRequirement(null, cached)).toBeNull();
  });

  it("başarılı yanıt yoksa önbellek; o da yoksa koşul yok", () => {
    expect(resolveRequirement(undefined, cached)).toEqual(cached.requirement);
    expect(resolveRequirement(undefined, undefined)).toBeNull();
  });
});

describe("decideGate", () => {
  it("cihaz sürümü eşiğin altındaysa kapanır, varsayılan mağaza adresiyle", () => {
    expect(decideGate(input())).toEqual({
      locked: true,
      reason: "below-min-version",
      storeUrl: DEFAULT_STORE_URLS.ios,
      messageTr: null,
      messageEn: null,
    });
  });

  it("eşit ya da büyük sürüm geçer", () => {
    expect(decideGate(input({ deviceVersion: "1.1.0" }))).toEqual({ locked: false, reason: "up-to-date" });
    expect(decideGate(input({ deviceVersion: "1.1" }))).toEqual({ locked: false, reason: "up-to-date" });
    expect(decideGate(input({ deviceVersion: "1.1.1" }))).toEqual({ locked: false, reason: "up-to-date" });
    expect(decideGate(input({ deviceVersion: "2.0.0" }))).toEqual({ locked: false, reason: "up-to-date" });
  });

  it("çok basamaklı sürümler doğru sıralanır", () => {
    expect(decideGate(input({ deviceVersion: "1.9.0", requirement: req({ minVersion: "1.10.0" }) })).locked).toBe(true);
    expect(decideGate(input({ deviceVersion: "1.10.0", requirement: req({ minVersion: "1.9.0" }) })).locked).toBe(false);
    expect(decideGate(input({ deviceVersion: "10.0.0", requirement: req({ minVersion: "9.99.99" }) })).locked).toBe(false);
  });

  it("platform ayrımı: Android varsayılan adresi Play Store", () => {
    const decision = decideGate(input({ platform: "android", deviceBuild: "11" }));
    expect(decision.locked && decision.storeUrl).toBe(DEFAULT_STORE_URLS.android);
  });

  it("sunucunun geçerli mağaza adresi ve metinleri kullanılır", () => {
    const decision = decideGate(
      input({
        requirement: req({
          storeUrl: "https://apps.apple.com/tr/app/id6829036716",
          messageTr: "Yeni sürüm hazır.",
          messageEn: "New version is ready.",
        }),
      })
    );
    expect(decision).toMatchObject({
      locked: true,
      storeUrl: "https://apps.apple.com/tr/app/id6829036716",
      messageTr: "Yeni sürüm hazır.",
      messageEn: "New version is ready.",
    });
  });

  it("başka platformun mağaza adresi gelirse yerel adres kullanılır", () => {
    const decision = decideGate(
      input({ platform: "android", requirement: req({ storeUrl: "https://apps.apple.com/app/id6829036716" }) })
    );
    expect(decision.locked && decision.storeUrl).toBe(DEFAULT_STORE_URLS.android);
  });

  describe("her belirsizlikte açık", () => {
    it("koşul yok (null) ya da asgari sürüm boş", () => {
      expect(decideGate(input({ requirement: null }))).toEqual({ locked: false, reason: "no-requirement" });
      expect(decideGate(input({ requirement: req({ minVersion: null }) }))).toEqual({ locked: false, reason: "no-requirement" });
    });

    it.each(["", "1.1.0-beta", "latest", " 1.1.0"])("sunucudaki asgari sürüm ayrıştırılamıyor (%j)", (minVersion) => {
      expect(decideGate(input({ requirement: req({ minVersion }) }))).toEqual({ locked: false, reason: "no-requirement" });
    });

    it.each([null, undefined, "", "1.0.0 (18)", "1.0.0-dev", 1])("cihaz sürümü okunamıyor (%p)", (deviceVersion) => {
      expect(decideGate(input({ deviceVersion }))).toEqual({ locked: false, reason: "device-version-unknown" });
    });

    it.each(["web", "windows", "macos", ""])("desteklenmeyen platform (%j)", (platform) => {
      expect(decideGate(input({ platform }))).toEqual({ locked: false, reason: "unsupported-platform" });
    });
  });

  describe("demo modu", () => {
    it("eşiğin altında bile kapı uygulanmaz", () => {
      expect(decideGate(input({ isDemoMode: true }))).toEqual({ locked: false, reason: "demo" });
      expect(decideGate(input({ isDemoMode: true, deviceVersion: "0.0.1", requirement: req({ minVersion: "99.0.0" }) }))).toEqual({
        locked: false,
        reason: "demo",
      });
    });
  });

  describe("aynı görünen sürümde build ayrımı (min_build)", () => {
    const sameVersion = (deviceBuild: unknown, minBuild: number | null) =>
      decideGate(input({ deviceVersion: "1.1.0", deviceBuild, requirement: req({ minVersion: "1.1.0", minBuild }) }));

    it("cihaz build'i küçükse kapanır", () => {
      expect(sameVersion("19", 20)).toMatchObject({ locked: true, reason: "below-min-build" });
    });

    it("eşit ya da büyük build geçer", () => {
      expect(sameVersion("20", 20).locked).toBe(false);
      expect(sameVersion("21", 20).locked).toBe(false);
    });

    it("build şartı yoksa ya da cihaz build'i okunamıyorsa geçer", () => {
      expect(sameVersion("1", null).locked).toBe(false);
      expect(sameVersion(null, 20).locked).toBe(false);
      expect(sameVersion("abc", 20).locked).toBe(false);
    });

    it("build şartı yalnızca sürüm eşitken uygulanır", () => {
      // Daha yeni sürümün build numarası küçük olsa bile geçer (Android versionCode geçmişte sıfırlandı)
      expect(
        decideGate(input({ deviceVersion: "1.2.0", deviceBuild: "3", requirement: req({ minVersion: "1.1.0", minBuild: 20 }) })).locked
      ).toBe(false);
      // Daha eski sürüm build numarası büyük olsa bile kapanır (sürüm şartı)
      expect(
        decideGate(input({ deviceVersion: "1.0.0", deviceBuild: "26", requirement: req({ minVersion: "1.1.0", minBuild: 20 }) }))
      ).toMatchObject({ locked: true, reason: "below-min-version" });
    });
  });
});

describe("pickGateMessage", () => {
  const locked = decideGate(input({ requirement: req({ messageTr: "TR metin", messageEn: "EN text" }) }));
  if (!locked.locked) throw new Error("kilitli karar bekleniyordu");

  it("Türkçede TR, diğer dillerde EN", () => {
    expect(pickGateMessage(locked, "tr")).toBe("TR metin");
    expect(pickGateMessage(locked, "tr-TR")).toBe("TR metin");
    expect(pickGateMessage(locked, "en")).toBe("EN text");
    expect(pickGateMessage(locked, "de")).toBe("EN text");
    expect(pickGateMessage(locked, undefined)).toBe("EN text");
  });

  it("o dilde sunucu metni yoksa null (ekran yerel metni gösterir; başka dile düşmez)", () => {
    const onlyEn = decideGate(input({ requirement: req({ messageEn: "EN text" }) }));
    if (!onlyEn.locked) throw new Error("kilitli karar bekleniyordu");
    expect(pickGateMessage(onlyEn, "tr")).toBeNull();
  });
});

describe("shouldCheck", () => {
  const T = 1_000_000_000;

  it("ilk soru her zaman", () => {
    expect(shouldCheck(null, T, false)).toBe(true);
  });

  it("açıkken en sık GATE_CHECK_INTERVAL_MS", () => {
    expect(shouldCheck(T, T + GATE_CHECK_INTERVAL_MS - 1, false)).toBe(false);
    expect(shouldCheck(T, T + GATE_CHECK_INTERVAL_MS, false)).toBe(true);
  });

  it("kapalıyken daha sık (geri alma çabuk yansısın)", () => {
    expect(shouldCheck(T, T + GATE_LOCKED_CHECK_INTERVAL_MS - 1, true)).toBe(false);
    expect(shouldCheck(T, T + GATE_LOCKED_CHECK_INTERVAL_MS, true)).toBe(true);
  });

  it("saat geri alınmışsa beklemeden sorar", () => {
    expect(shouldCheck(T, T - 1, false)).toBe(true);
  });
});

describe("migration ile istemci aynı kuralları kullanıyor", () => {
  const sql = readFileSync(
    join(__dirname, "../../../supabase/migrations/20261111000000_app_version_gate.sql"),
    "utf8"
  );

  it("RPC adı ve alan adları", () => {
    expect(sql).toContain("FUNCTION public.get_app_version_requirement(p_platform TEXT)");
    for (const field of ["platform", "min_version", "min_build", "store_url", "message_tr", "message_en"]) {
      expect(sql).toContain(`'${field}'`);
    }
  });

  it("sürüm biçimi ve metin sınırı aynı", () => {
    expect(sql).toContain("min_version ~ '^[0-9]{1,6}(\\.[0-9]{1,6}){0,3}$'");
    expect(sql).toContain(`char_length(message_tr) BETWEEN 1 AND ${GATE_MESSAGE_MAX_LENGTH}`);
  });

  it("başlangıç değerleri hiçbir sürümü engellemez ve mağaza adresleri istemcininkiyle aynı", () => {
    expect(sql).toContain(`('ios',     NULL, NULL, '${DEFAULT_STORE_URLS.ios}')`);
    expect(sql).toContain(`('android', NULL, NULL, '${DEFAULT_STORE_URLS.android}')`);
  });

  it("yalnızca ekler: mevcut nesneyi değiştiren / silen ifade yok", () => {
    const statements = sql.replace(/--.*$/gm, "");
    expect(statements).not.toMatch(/\bDROP\b/i);
    expect(statements).not.toMatch(/\bTRUNCATE\b/i);
    expect(statements).not.toMatch(/\bDELETE\b/i);
    // ALTER / UPDATE / REVOKE yalnızca yeni tabloyu ve yeni fonksiyonu hedefler
    for (const match of statements.matchAll(/\b(ALTER|UPDATE|REVOKE|GRANT)\b[^;]*;/gi)) {
      expect(match[0]).toMatch(/app_version_requirements|get_app_version_requirement/);
    }
  });
});
