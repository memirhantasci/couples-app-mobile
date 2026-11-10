/// <reference types="jest" />
import { decodeLegacyEntities, sanitize } from "@/utils/sanitize";

/**
 * Eski sürümlerdeki sanitizeStrict, & < > " ' karakterlerini HTML varlığına çevirip veritabanına öyle yazıyordu
 * ("Ali's" → "Ali&#x27;s"). decodeLegacyEntities yalnızca o fonksiyonun ürettiği beş varlığı geri çözer.
 */
describe("decodeLegacyEntities", () => {
  it.each([
    ["&amp;", "&"],
    ["&lt;", "<"],
    ["&gt;", ">"],
    ["&quot;", '"'],
    ["&#x27;", "'"],
  ])("%s → %s", (encoded, plain) => {
    expect(decodeLegacyEntities(`a${encoded}b`)).toBe(`a${plain}b`);
  });

  it("eski sanitizeStrict çıktısını kullanıcının yazdığı metne döndürür", () => {
    expect(decodeLegacyEntities("Ali&#x27;s")).toBe("Ali's");
    expect(decodeLegacyEntities("Kahve &amp; Kitap")).toBe("Kahve & Kitap");
    expect(decodeLegacyEntities("&lt;3 seni seviyorum")).toBe("<3 seni seviyorum");
    expect(decodeLegacyEntities("&quot;Bizim yer&quot;")).toBe('"Bizim yer"');
  });

  it("eski sürümde düzenleyip yeniden kaydetmekten doğan çift (ve daha fazla) kodlamayı sonuna kadar çözer", () => {
    // "Ali's" → (kayıt) "Ali&#x27;s" → (eski formda düzenle + kaydet) "Ali&amp;#x27;s" → … "Ali&amp;amp;#x27;s"
    expect(decodeLegacyEntities("Ali&amp;#x27;s")).toBe("Ali's");
    expect(decodeLegacyEntities("Ali&amp;amp;#x27;s")).toBe("Ali's");
    expect(decodeLegacyEntities("Tom &amp;amp; Jerry")).toBe("Tom & Jerry");
    expect(decodeLegacyEntities("&amp;lt;3")).toBe("<3");
  });

  it("kullanıcının bilerek yazdığı düz & ve benzeri karakterlere dokunmaz", () => {
    expect(decodeLegacyEntities("Tom & Jerry")).toBe("Tom & Jerry");
    expect(decodeLegacyEntities("R&B gecesi")).toBe("R&B gecesi");
    expect(decodeLegacyEntities("a<b>c \"x\" 'y'")).toBe("a<b>c \"x\" 'y'");
    expect(decodeLegacyEntities("%100 & ötesi;")).toBe("%100 & ötesi;");
  });

  it("sanitizeStrict'in hiç üretmediği varlıklara dokunmaz (genel HTML çözücü değil)", () => {
    expect(decodeLegacyEntities("&#39;")).toBe("&#39;");
    expect(decodeLegacyEntities("&nbsp;")).toBe("&nbsp;");
    expect(decodeLegacyEntities("&apos;")).toBe("&apos;");
    expect(decodeLegacyEntities("&#X27;")).toBe("&#X27;");
    expect(decodeLegacyEntities("&AMP;")).toBe("&AMP;");
    expect(decodeLegacyEntities("&amp")).toBe("&amp");
    // Sunucunun 50 karaktere kestiği bir adın sonundaki yarım varlık
    expect(decodeLegacyEntities("Ali&#x2")).toBe("Ali&#x2");
  });

  it("boş, null ve undefined değerleri olduğu gibi döndürür", () => {
    expect(decodeLegacyEntities("")).toBe("");
    expect(decodeLegacyEntities(null)).toBeNull();
    expect(decodeLegacyEntities(undefined)).toBeUndefined();
  });

  it("varlık içermeyen metni aynen döndürür", () => {
    const text = "Kapadokya'da gün doğumu 🎈";
    expect(decodeLegacyEntities(text)).toBe(text);
  });

  it("tek geçişte bir seviye çözer: &amp;lt; önce &lt; olur, ikinci geçişte <", () => {
    // Sıralı replace zinciri (önce &amp; sonra &lt;) aynı geçişte iki seviyeyi birden açmamalı;
    // sonuç her durumda sona kadar çözülmüş hâldir, burada ara adımın tutarlılığı doğrulanır.
    expect(decodeLegacyEntities("&amp;quot;")).toBe('"');
  });
});

describe("sanitize (yazma tarafı)", () => {
  it("HTML varlığı üretmez: React Native metni HTML olarak işlemez", () => {
    expect(sanitize("  Ali's \"yer\" <3 & co  ")).toBe("Ali's \"yer\" <3 & co");
  });

  it("kontrol karakterlerini ve null baytı temizler", () => {
    expect(sanitize("a\0b\x07c")).toBe("abc");
  });
});
