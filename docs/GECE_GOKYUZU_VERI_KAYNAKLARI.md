# "Bizim Gecemiz": veri kaynakları ve lisanslar

İndirme tarihi: 2026-11-09. Üretilen dosyalar `src/modules/sky/data/` altındadır (betikle üretilir, elle düzenlenmez).
İndirilen ham dosyalar repoya konmaz (geçici klasörde tutuldu).

## Kaynaklar

| Kaynak | Adres | Lisans |
|---|---|---|
| HYG Database v4.2 | `https://www.astronexus.com/downloads/catalogs/hygdata_v42.csv.gz` (güncel depo: https://codeberg.org/astronexus/hyg) | CC BY-SA 4.0 |
| Stellarium western sky culture (çizgiler) | `https://raw.githubusercontent.com/Stellarium/stellarium-skycultures/master/western/index.json` | `western/description.md`: "Text and data: CC BY-SA" (sürüm belirtilmemiş) |

Girdi SHA-256 (tekrarlanabilirlik):
- `hyg.csv.gz` (13.636.976 bayt): `5ca9431ff364c8002a4a3efa91b2b9296746aea1543374db4cb6b4fab049d601`
- `hygdata_v42.csv` (açılmış, 33.932.800 bayt): `b2983a8d934e4f031cdb67bdd6c3437f8c5143cd6606a9573a9a9ac4b6375fd2`
- `western_index.json` (107.520 bayt): `a861accd345249a185a5ecfc2a516f34291c0aa52f4bb8d8337ffc53e9cef6b9`

(`index.json` deposundaki son değişiklik: 2024-05-17. `gzip` başlığındaki HYG dosya tarihi: 2025-06-29.)

## Lisans bulguları (Stellarium)

- `western/description.md` sonunda: **Authors:** "Stellarium's team. Illustrations by Johan Meuris." **License:** "Text and data: CC BY-SA", "Illustrations: Free Art License". Sürüm numarası yok.
- `index.json` içinde lisans/atıf alanı **yok**. Yalnızca `edges_source: http://pbarbier.com/constellations/edges_18.txt` var (takımyıldızı sınır çizgileri; biz bu sınırları kullanmıyoruz).
- Depo kökünde yalnızca `LICENSE-AGPL-3.0.txt` var; `western/` içinde LICENSE dosyası yok (klasör: `description.md`, `illustrations`, `index.json`, `po`). Depo README'si "takımyıldızı çizgisi/metin lisansı CC BY-SA ya da daha serbest olmalı" der; AGPL'nin hangi dosyaları kapsadığı belirtilmemiş. Çizgi verisi için belirleyici olan `description.md` satırıdır.
- Bizim kullandığımız yalnızca çizgiler ve İngilizce adlardır. İllüstrasyonlar (Free Art License) kullanılmaz.
- Yükümlülük: atıf + türetilmiş veri dosyalarının CC BY-SA kalması. Sürüm belirtilmediği için avukat teyidi hâlâ gerekir (plan §3).

## Sayılar

- Yıldız: **2.855** (kadir ≤ 5,5 ve HIP'li; ayrıca çizgi ucu olduğu için eklenen 5,5'ten sönük yıldız: **7**)
- Adlı yıldız: **60**
- Takımyıldızı: **88**, kenar: **674** (benzersiz çizgi ucu HIP: 691)
- Dosya boyutları: `skyStars.data.ts` 115.516 B, `skyStarNames.data.ts` 2.669 B, `skyConstellationLines.data.ts` 15.403 B; toplam **133.588 B (~130,5 KB)**, hedef ≤ ~150 KB.

## Reddedilen / çıkarılan kayıtlar

- HYG'de karşılığı olmayan çizgi ucu: **0** (çıkarılan kenar: 0).
- Geçersiz (0, negatif, sayı olmayan) HIP: **0**.
- Çizgi dizilerinde **6 adet `"thin"`** metni: bunlar HIP değil, Stellarium README'sinde belgelenmiş çizgi ağırlığı ön ekidir (`"thin"` / `"bold"`). Ön ek atlanıp dizinin geri kalanı kullanıldı; geçersiz HIP sayılmadı.
- Kendisiyle eşleşen (A=A) kenar: 0; yinelenen kenar: 0.
- Geçersiz yıldız adı: 0; HYG'de bozuk satır: 0.

## Nasıl yeniden üretilir

```
node scripts/build-sky-data.js --hyg <hygdata_v42.csv> --skyculture <western_index.json> --outdir src/modules/sky/data
```

Çıktı belirlenimcidir: iki çalıştırmada çıktı özeti (`sha256`) aynı çıktı (`67cae085…da2428`). Saf mantık `scripts/lib/skyDataBuilder.js` içindedir (testler: `scripts/lib/__tests__`).

## Veri biçimi (Bölüm 2 için)

- `SKY_STARS`: `[hip, ra°, dec°, mag, ci|null][]`, ra'ya göre sıralı, ra ∈ [0,360), dec J2000 derece. HYG konumları J2000, öz hareket uygulanmamış.
- `SKY_STAR_NAMES`: `Record<hip, ad>`.
- `SKY_CONSTELLATIONS`: `{ iau, name, segments: [hipA, hipB][] }[]`, IAU koduna göre sıralı.
