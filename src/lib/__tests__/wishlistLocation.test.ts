/// <reference types="jest" />
import { locationAfterNameEdit, locationFromMap, locationPatch, type WishlistLocationDraft } from "../wishlistLocation";

const clean = (text: string) => text.trim();
const saved: WishlistLocationDraft = { name: "Galata Kulesi", latitude: 41.0256, longitude: 28.9742 };
/** Kapadokya'daki nokta: bulgu 12'nin örnekleri bu koordinatla kaydedilmemeli */
const CAPPADOCIA = { latitude: 38.64, longitude: 34.83 };

describe("haritadan seçim", () => {
  it("ad doluyken bile yeni noktanın adıyla güncellenir", () => {
    expect(locationFromMap({ latitude: 38.643, longitude: 34.83, locationName: "Göreme" })).toEqual({
      name: "Göreme",
      latitude: 38.643,
      longitude: 34.83,
    });
  });

  it("adres çözülemezse koordinat yazılır (nokta kaybolmaz)", () => {
    const draft = locationFromMap({ latitude: 38.6431234, longitude: 34.8298765 });
    expect(draft.name).toBe("38.64312, 34.82988");
    expect(locationPatch(draft, clean)).toEqual({ location_name: "38.64312, 34.82988", latitude: 38.6431234, longitude: 34.8298765 });
  });

  it("çok uzun adres ekrandaki sınıra kısaltılır", () => {
    expect(locationFromMap({ latitude: 1, longitude: 2, locationName: "x".repeat(150) }).name).toHaveLength(100);
  });

  it("haritadan yeniden seçince nokta ve ad birlikte gelir", () => {
    expect(locationFromMap({ latitude: 40.98, longitude: 29.02, locationName: "Moda" })).toEqual({
      name: "Moda",
      latitude: 40.98,
      longitude: 29.02,
    });
  });
});

describe("adı elle değiştirme: koordinat silinir (ad ve nokta yalnızca haritadan birlikte gelir)", () => {
  // Benzer görünen ama başka yer olan adlar: eski nokta yeni adla KAYDEDİLMEMELİ
  it.each([
    ["Kapadokya", "Kapalıçarşı"],
    ["İstanbul Modern", "İstanbul Havalimanı"],
    ["Ev", "Evde film gecesi"],
  ])("%s → %s: eski nokta düşer", (from, to) => {
    const picked = locationFromMap({ ...CAPPADOCIA, locationName: from });
    const edited = locationAfterNameEdit(picked, to);
    expect(edited).toEqual({ name: to, latitude: null, longitude: null });
    expect(locationPatch(edited, clean)).toEqual({ location_name: to, latitude: null, longitude: null });
  });

  it("tek harflik değişiklik de noktayı siler", () => {
    expect(locationAfterNameEdit(saved, "Galata Kules")).toEqual({ name: "Galata Kules", latitude: null, longitude: null });
  });

  it("ad değişmeden kalırsa nokta korunur", () => {
    expect(locationAfterNameEdit(saved, "Galata Kulesi")).toBe(saved);
    expect(locationPatch(locationAfterNameEdit(saved, "Galata Kulesi"), clean)).toEqual({
      location_name: "Galata Kulesi",
      latitude: 41.0256,
      longitude: 28.9742,
    });
  });

  it("düşen nokta, eski ad yeniden yazılınca geri gelmez (yalnızca haritadan seçimle gelir)", () => {
    const picked = locationFromMap({ ...CAPPADOCIA, locationName: "Kapadokya" });
    const back = locationAfterNameEdit(locationAfterNameEdit(picked, "Kapadokyaa"), "Kapadokya");
    expect(back).toEqual({ name: "Kapadokya", latitude: null, longitude: null });
  });
});

describe("kayıt", () => {
  it("ad boşsa koordinat da kaydedilmez", () => {
    expect(locationPatch({ name: "   ", latitude: 1, longitude: 2 }, clean)).toEqual({
      location_name: null,
      latitude: null,
      longitude: null,
    });
  });

  it("0 enlem/boylam geçerli bir noktadır", () => {
    expect(locationPatch({ name: "Gine Körfezi", latitude: 0, longitude: 0 }, clean)).toEqual({
      location_name: "Gine Körfezi",
      latitude: 0,
      longitude: 0,
    });
  });
});
