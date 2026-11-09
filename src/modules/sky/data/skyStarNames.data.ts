/**
 * ELLE DÜZENLEME: bu dosya scripts/build-sky-data.js ile üretilir (aynı girdiyle aynı çıktı).
 *
 * Adlı yıldızlar: HIP numarası → ad (HYG 'proper' alanı, kadire göre en parlak 60).
 *
 * Kaynaklar:
 *  - HYG Database v4.2 (Hipparcos, Yale Bright Star, Gliese) — https://www.astronexus.com/projects/hyg
 *    (güncel adres: https://codeberg.org/astronexus/hyg). Lisans: CC BY-SA 4.0 — https://creativecommons.org/licenses/by-sa/4.0/
 *    Girdi SHA-256: b2983a8d934e4f031cdb67bdd6c3437f8c5143cd6606a9573a9a9ac4b6375fd2
 *  - Stellarium western sky culture (takımyıldızı çizgileri) — https://github.com/Stellarium/stellarium-skycultures (western/index.json)
 *    Lisans (western/description.md): "Text and data: CC BY-SA" (sürüm belirtilmemiş).
 *    Girdi SHA-256: a861accd345249a185a5ecfc2a516f34291c0aa52f4bb8d8337ffc53e9cef6b9
 *
 * Yapılan değişiklikler: sağ açıklık saatten dereceye çevrildi (x15); kadiri <= 5.5 olan HIP'li yıldızlar ve takımyıldızı
 * çizgi uçları süzüldü; ra/dec 3, kadir ve renk indeksi 2 ondalığa yuvarlandı; çizgi dizileri ardışık kenar çiftlerine bölündü.
 *
 * Bu veri dosyası türetilmiş eserdir: CC BY-SA lisansıyla, kaynak atfıyla birlikte kalır. Uygulama kodundan ayrı tutulur.
 * Bu veri uygulamadaki Gökkubbe (src/modules/stars) konumlarından bağımsızdır: gerçek gökyüzü konumlarıdır.
 */

export const SKY_STAR_NAMES: Readonly<Record<number, string>> = {
  677: "Alpheratz",
  3419: "Diphda",
  5447: "Mirach",
  7588: "Achernar",
  9884: "Hamal",
  11767: "Polaris",
  14576: "Algol",
  15863: "Mirfak",
  21421: "Aldebaran",
  24436: "Rigel",
  24608: "Capella",
  25336: "Bellatrix",
  25428: "Elnath",
  26311: "Alnilam",
  26727: "Alnitak",
  27366: "Saiph",
  27989: "Betelgeuse",
  28360: "Menkalinan",
  30324: "Mirzam",
  30438: "Canopus",
  31681: "Alhena",
  32349: "Sirius",
  33579: "Adhara",
  34444: "Wezen",
  36850: "Castor",
  37279: "Procyon",
  37826: "Pollux",
  41037: "Avior",
  42913: "Alsephina",
  45238: "Miaplacidus",
  46390: "Alphard",
  49669: "Regulus",
  50583: "Algieba",
  54061: "Dubhe",
  60718: "Acrux",
  61084: "Gacrux",
  62434: "Mimosa",
  62956: "Alioth",
  65474: "Spica",
  67301: "Alkaid",
  68702: "Hadar",
  68933: "Menkent",
  69673: "Arcturus",
  71681: "Toliman",
  71683: "Rigil Kentaurus",
  72607: "Kochab",
  80763: "Antares",
  82273: "Atria",
  85927: "Shaula",
  86032: "Rasalhague",
  86228: "Sargas",
  90185: "Kaus Australis",
  91262: "Vega",
  92855: "Nunki",
  97649: "Altair",
  100751: "Peacock",
  102098: "Deneb",
  109268: "Alnair",
  112122: "Tiaki",
  113368: "Fomalhaut",
};
