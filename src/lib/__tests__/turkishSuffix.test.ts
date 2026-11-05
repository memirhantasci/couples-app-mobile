/// <reference types="jest" />
import { withAblative, withGenitive } from "../turkishSuffix";

describe("withGenitive", () => {
  it("ünsüzle biten adlarda ünlü uyumuna göre -in/-ın/-un/-ün ekler", () => {
    expect(withGenitive("Cem")).toBe("Cem'in");
    expect(withGenitive("Burak")).toBe("Burak'ın");
    expect(withGenitive("Okan")).toBe("Okan'ın");
    expect(withGenitive("Mehmet")).toBe("Mehmet'in");
    expect(withGenitive("Umut")).toBe("Umut'un");
    expect(withGenitive("Güngör")).toBe("Güngör'ün");
    expect(withGenitive("Songül")).toBe("Songül'ün");
  });

  it("ünlüyle biten adlarda araya n girer", () => {
    expect(withGenitive("Ayşe")).toBe("Ayşe'nin");
    expect(withGenitive("Ali")).toBe("Ali'nin");
    expect(withGenitive("Ada")).toBe("Ada'nın");
    expect(withGenitive("Hulusi")).toBe("Hulusi'nin");
    expect(withGenitive("Zeynepcan")).toBe("Zeynepcan'ın");
  });

  it("büyük İ / I harflerini Türkçe kuralıyla işler", () => {
    expect(withGenitive("IŞIL")).toBe("IŞIL'ın");
    expect(withGenitive("İpek")).toBe("İpek'in");
  });

  it("harf içermeyen adı olduğu gibi bırakır", () => {
    expect(withGenitive("💕")).toBe("💕");
    expect(withGenitive("")).toBe("");
  });
});

describe("withAblative", () => {
  it("sert ünsüzden sonra -ten/-tan, diğerlerinde -den/-dan", () => {
    expect(withAblative("Burak")).toBe("Burak'tan");
    expect(withAblative("Cem")).toBe("Cem'den");
    expect(withAblative("Ayşe")).toBe("Ayşe'den");
    expect(withAblative("Ali")).toBe("Ali'den");
    expect(withAblative("Mehmet")).toBe("Mehmet'ten");
    expect(withAblative("Ada")).toBe("Ada'dan");
    expect(withAblative("Songül")).toBe("Songül'den");
    expect(withAblative("Okan")).toBe("Okan'dan");
  });
});
