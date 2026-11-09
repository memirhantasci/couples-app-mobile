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

const prefs: SkyPrefs = { place: { latitude: 41.0082, longitude: 28.9784, name: "İstanbul" }, time: "23:15", timeKnown: false, title: "Bizim Gece" };

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
    const parsed = parseSkyPrefs(JSON.stringify({ place: { latitude: 999, longitude: 0, name: "x" }, time: "25:00", timeKnown: "evet", title: 5 }));
    expect(parsed).toEqual(EMPTY_SKY_PREFS);
    const partial = parseSkyPrefs(JSON.stringify({ place: { latitude: 10, longitude: 20 }, time: "bozuk", title: "Merhaba" }));
    expect(partial.place).toEqual({ latitude: 10, longitude: 20, name: null });
    expect(partial.time).toBe("22:00");
    expect(partial.title).toBe("Merhaba");
  });

  it("uzun başlık ve yer adı sınırlanır, yabancı alanlar yok sayılır", () => {
    const parsed = parseSkyPrefs(JSON.stringify({ title: "x".repeat(500), place: { latitude: 1, longitude: 2, name: "y".repeat(500), evil: "<script>" }, extra: true }));
    expect(parsed.title).toHaveLength(40);
    expect(parsed.place?.name).toHaveLength(80);
    expect(parsed.place).not.toHaveProperty("evil");
    expect(parsed).not.toHaveProperty("extra");
  });

  it("depolama patlarsa akış bozulmaz", async () => {
    (safeStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error("disk"));
    expect(await loadSkyPrefs()).toEqual(EMPTY_SKY_PREFS);
    (safeStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error("disk"));
    await expect(saveSkyPrefs(prefs)).resolves.toBeUndefined();
  });

  it("serileştirme yalnızca bilinen alanları yazar", () => {
    expect(Object.keys(JSON.parse(serializeSkyPrefs(prefs))).sort()).toEqual(["place", "time", "timeKnown", "title"]);
  });

  it("çıkışta silinen anahtar AuthContext ile aynıdır", () => {
    const source = jest.requireActual<{ readFileSync: (path: string, encoding: string) => string }>("fs").readFileSync("src/context/AuthContext.tsx", "utf8");
    expect(source).toContain(`"${SKY_PREFS_KEY}"`);
  });
});
