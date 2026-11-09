/// <reference types="jest" />
import { safeStorage } from "@/lib/safeStorage";
import { EMPTY_SKY_PREFS, loadSkyPrefs, parseSkyPrefs, saveSkyPrefs, serializeSkyPrefs, SKY_PREFS_KEY, type SkyPrefs } from "../skyPrefs";

jest.mock("@/lib/safeStorage", () => {
  const store = new Map<string, string>();
  return {
    safeStorage: {
      getItem: jest.fn(async (key: string) => store.get(key) ?? null),
      setItem: jest.fn(async (key: string, value: string) => void store.set(key, value)),
      removeItem: jest.fn(async (key: string) => void store.delete(key)),
    },
  };
});

const prefs: SkyPrefs = { placeName: "Kadıköy, İstanbul", time: "23:15", timeKnown: false, title: "Bizim Gece" };

describe("gökyüzü tercihleri", () => {
  it("yazılanı geri okur", async () => {
    await saveSkyPrefs(prefs);
    expect(await loadSkyPrefs()).toEqual(prefs);
    expect(safeStorage.setItem).toHaveBeenCalledWith(SKY_PREFS_KEY, expect.any(String));
  });

  it("kayıt yoksa varsayılan", async () => {
    await safeStorage.removeItem(SKY_PREFS_KEY);
    expect(await loadSkyPrefs()).toEqual(EMPTY_SKY_PREFS);
  });

  it.each([
    ["bozuk JSON", "{yok"],
    ["dizi", "[1,2]"],
    ["sayı", "42"],
    ["null", "null"],
    ["boş metin", ""],
  ])("%s varsayılana döner", (_name, raw) => {
    expect(parseSkyPrefs(raw)).toEqual(EMPTY_SKY_PREFS);
  });

  it("geçersiz alanlar tek tek atılır, geçerliler korunur", () => {
    const parsed = parseSkyPrefs(JSON.stringify({ placeName: 7, time: "25:00", timeKnown: "evet", title: 5 }));
    expect(parsed).toEqual(EMPTY_SKY_PREFS);
    const partial = parseSkyPrefs(JSON.stringify({ placeName: "  Moda  ", time: "bozuk", title: "Merhaba" }));
    expect(partial.placeName).toBe("Moda");
    expect(partial.time).toBe("22:00");
    expect(partial.title).toBe("Merhaba");
  });

  it("uzun başlık ve yer adı sınırlanır, yabancı alanlar yok sayılır", () => {
    const parsed = parseSkyPrefs(JSON.stringify({ title: "x".repeat(500), placeName: "y".repeat(500), extra: true }));
    expect(parsed.title).toHaveLength(40);
    expect(parsed.placeName).toHaveLength(80);
    expect(parsed).not.toHaveProperty("extra");
  });

  it("koordinat saklanmaz: yazılan kayıtta enlem/boylam yoktur", async () => {
    await saveSkyPrefs({ ...prefs, latitude: 41.0082, longitude: 28.9784, place: { latitude: 41.0082, longitude: 28.9784 } } as SkyPrefs);
    const written = (safeStorage.setItem as jest.Mock).mock.calls.at(-1)?.[1] as string;
    expect(written).not.toMatch(/latitude|longitude|41\.0082|28\.9784/);
    expect(Object.keys(JSON.parse(written)).sort()).toEqual(["placeName", "time", "timeKnown", "title"]);
  });

  it("koordinatlı eski kayıt okunurken koordinat atılır, yeniden yazılınca iz kalmaz", () => {
    const old = JSON.stringify({ place: { latitude: 41.0082, longitude: 28.9784, name: "Moda Cd. No:12" }, time: "21:00", timeKnown: true, title: "Eski" });
    const parsed = parseSkyPrefs(old);
    expect(parsed).toEqual({ placeName: null, time: "21:00", timeKnown: true, title: "Eski" });
    expect(serializeSkyPrefs(parsed)).not.toMatch(/latitude|longitude|Moda/);
  });

  describe("eski biçimli kayıt (koordinatlı)", () => {
    const old = JSON.stringify({ place: { latitude: 41.0082, longitude: 28.9784, name: "Moda Cd. No:12, Kadıköy, İstanbul" }, time: "21:00", timeKnown: true, title: "Eski" });
    const hybrid = JSON.stringify({ placeName: "Moda Cd. No:12, Kadıköy, İstanbul", latitude: 41.0082, longitude: 28.9784, time: "21:00", timeKnown: true, title: "" });

    it("okununca temizlenmiş döner ve HEMEN koordinatsız yeniden yazılır", async () => {
      await safeStorage.setItem(SKY_PREFS_KEY, old);
      (safeStorage.setItem as jest.Mock).mockClear();
      expect(await loadSkyPrefs()).toEqual({ placeName: null, time: "21:00", timeKnown: true, title: "Eski" });
      expect(safeStorage.setItem).toHaveBeenCalledTimes(1);
      const stored = await safeStorage.getItem(SKY_PREFS_KEY);
      expect(stored).not.toMatch(/latitude|longitude|41\.0082|28\.9784|Moda|Kadıköy/);
      expect(Object.keys(JSON.parse(stored as string)).sort()).toEqual(["placeName", "time", "timeKnown", "title"]);
    });

    it("eski biçimde adın kaynağı bilinmez: 'Son seçimin' adı da gösterilmez", async () => {
      await safeStorage.setItem(SKY_PREFS_KEY, hybrid);
      expect((await loadSkyPrefs()).placeName).toBeNull();
      expect(await safeStorage.getItem(SKY_PREFS_KEY)).not.toMatch(/latitude|longitude|Moda/);
    });

    it("yeni biçimli kayıt yeniden yazılmaz ve adı korunur", async () => {
      await safeStorage.setItem(SKY_PREFS_KEY, serializeSkyPrefs(prefs));
      (safeStorage.setItem as jest.Mock).mockClear();
      expect(await loadSkyPrefs()).toEqual(prefs);
      expect(safeStorage.setItem).not.toHaveBeenCalled();
    });

    it("yeniden yazma başarısızsa kayıt silinir; o da olmazsa akış yine sürer", async () => {
      await safeStorage.setItem(SKY_PREFS_KEY, old);
      (safeStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error("disk"));
      expect((await loadSkyPrefs()).title).toBe("Eski");
      expect(await safeStorage.getItem(SKY_PREFS_KEY)).toBeNull();

      await safeStorage.setItem(SKY_PREFS_KEY, old);
      (safeStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error("disk"));
      (safeStorage.removeItem as jest.Mock).mockRejectedValueOnce(new Error("disk"));
      expect((await loadSkyPrefs()).title).toBe("Eski");
    });
  });

  it("depolama patlarsa akış bozulmaz", async () => {
    (safeStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error("disk"));
    expect(await loadSkyPrefs()).toEqual(EMPTY_SKY_PREFS);
    (safeStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error("disk"));
    await expect(saveSkyPrefs(prefs)).resolves.toBeUndefined();
  });

  it("serileştirme yalnızca bilinen alanları yazar", () => {
    expect(Object.keys(JSON.parse(serializeSkyPrefs(prefs))).sort()).toEqual(["placeName", "time", "timeKnown", "title"]);
  });

  it("çıkışta silinen anahtar AuthContext ile aynıdır", () => {
    const source = jest.requireActual<{ readFileSync: (path: string, encoding: string) => string }>("fs").readFileSync("src/context/AuthContext.tsx", "utf8");
    expect(source).toContain(`"${SKY_PREFS_KEY}"`);
  });
});
