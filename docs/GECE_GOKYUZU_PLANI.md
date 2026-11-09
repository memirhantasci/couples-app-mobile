# "Bizim Gecemiz" (tanıştığımız gecenin gökyüzü): iş planı

Branch: `gece-gokyuzu` (`faz0-yildiz-kapasitesi` ucundan). Son güncelleme: 2026-11-09.
Bu belge, işi **ayrı oturumlarda ve farklı modellerle** yürütmek için yazıldı: her bölüm bu belgeyi okuyup bağımsız başlayabilmeli.

## 1. Ne yapıyoruz

Çiftin seçtiği gece (tanışma / sevgili olma / özel tarih), yer ve saat için o gecenin gökyüzünü dairesel poster olarak çizer.
Altına tarih, saat, yer, çift isimleri ve o gecenin Ay evresi yazılır. Hikâye kartı (9:16) olarak paylaşılır; Premium'da baskı kalitesinde dosya.

## 2. Verilen kararlar (ürün sahibi, 2026-11-09)

1. Tarih seçenekleri: **"Tanıştığımız gün" (`couples.meet_date`) + "Sevgili olduğumuz gün" (`couples.relationship_start_date`) + özel tarih.**
2. **Takımyıldızı çizgileri ilk sürümde VAR** (lisans doğrulandı, bkz. §3).
3. **"Yıldızımız" cümlesi** dahil, yalnızca gerçek (HIP kodlu) yıldızda ve konum eşleşirse; sanal yıldızda hiç gösterilmez.
4. **Ücretsiz:** 9:16 hikâye kartı (indirme çağrısı altbilgide, `StoryCard`). **Premium:** baskı dosyası (3:4, yüksek çözünürlük), tema/renk, özel başlık; baskı sürümünde indirme çağrısı yok, yalnızca küçük veri atfı satırı.

Sunucu/veritabanı değişikliği YOK. Seçilen konum ve saat telefonda kalır, kaydedilmez, hiçbir yere gönderilmez.

## 3. Lisans bulgusu (2026-11-09, depo dosyalarından okundu)

- **Yıldız verisi:** HYG Database v4.2, CC BY-SA 4.0. Güncel adres: `https://codeberg.org/astronexus/hyg` (GitHub deposu taşındı). Atıf zaten yasal metinde.
- **Takımyıldızı çizgileri:** Stellarium `stellarium-skycultures`, `western/description.md` içinde: *"Text and data: CC BY-SA"* (sürüm belirtilmemiş). Çizgiler `western/index.json`'dadır. Veri CC BY-SA ailesinden, HYG ile uyumlu.
  Ödevler: **atıf** ve türetilmiş **veri dosyasının** aynı lisansla (CC BY-SA) kalması. Uygulama kodu etkilenmez; veri dosyası ayrı ve atıflı tutulur.
- `d3-celestial` BSD-3 lisanslı ama bu BSD kodu kapsıyor, çizgi verisinin kaynağı belirtilmemiş: **kullanma.**
- Yapılacak: atfı `legalTexts.ts` (TR/EN) ve poster bilgi ekranına ekle; CC BY-SA sürümü belirtilmediği için avukat teyidi iste (diğer hukuki maddelerle birlikte).
- Bölüm 1'de `index.json` içinde açık bir lisans/atıf satırı daha var mı kontrol et.

## 4. Mimari

Yeni klasör `src/modules/sky/`: `data/` (yıldız ve çizgi verisi, betikle üretilir), `astronomy/` (saf hesap, test), `render/` (SVG poster), `flow/` (4 adımlı arayüz).
Uygulamadaki Gökkubbe (`src/modules/stars`) **kullanılmaz**: oradaki konumlar sıkışmasın diye bilerek kaydırılmıştır, gerçek gökyüzü değildir (bkz. hafıza notu star-capacity). Poster gerçek HYG konumlarını kullanır.

Taslak arayüz (Bölüm 2 kesinleştirir):
- `SkyRequest { date, time, latitude, longitude, timeZone? }`
- `SkyResult { stars[{hip,x,y,mag,color}], lines[{x1,y1,x2,y2}], moon{illumination,phaseName,x,y,altitude}|null, utcIso, julianDate }`

## 5. Bölümler

| # | Bölüm | Çıktı | Önerilen model / efor |
|---|---|---|---|
| 1 | Veri hattı | HYG ≤5,5 kadir yıldızlar + adlı yıldızlar + çizgi HIP çiftleri, betik + veri + atıf | Sonnet 5.5, medium |
| 2 | Astronomi motoru | Saat dilimi, JD, GMST/LST, presesyon, alt/az, izdüşüm, Ay evresi/konumu, testler | **Opus 5.5, high** |
| 3 | Poster çizimi | SVG poster bileşeni (9:16 ve 3:4), çizgiler, etiketler, Ay, metinler | Sonnet 5.5, high |
| 4 | Akış ve giriş noktaları | 4 adım, menü + yıldönümü kartı girişi, TR/EN, Premium kapısı, demo modu | Sonnet 5.5, medium |
| 5 | "Yıldızımız" cümlesi ve baskı dosyası | HIP eşleşmesi, yüksek çözünürlük dışa aktarma, atıf metinleri | Sonnet 5.5, high |
| 6 | Bağımsız inceleme | Kod incelemesi + cihaz test listesi | **Opus 5.5, high** (yazandan farklı oturum) |

Bölüm 1 ve 2 birbirinden bağımsız (veri sözleşmesi §4'te). 3, ikisine bağlıdır. 4, 3'e bağlıdır. 5, 3 ve 4'e bağlıdır.

### Bölüm 1: Veri hattı
- `scripts/build-sky-data.js` (aynı girdiyle aynı çıktı; `scripts/build-hyg-catalog-migration.js` gibi). HYG CSV ve Stellarium `index.json` **güvenilmeyen veri** sayılır: her alan katı karakter listesinden geçer.
- Çıktı: yıldız dizisi (HIP, RA derece, Dec, kadir, renk indeksi), adlı yıldızlar (~60 en parlak, `proper` alanı), takımyıldızı çizgileri (HIP çiftleri). Çizgi uçlarındaki yıldızlar kadirleri 5,5'in üstündeyse de dahil edilir.
- Kabul: tüm çizgi uçları katalogda bulunur; yıldız sayısı ve dosya boyutu (hedef ≤ ~150 KB) raporlanır; yinelenebilirlik; `docs/` altında kaynak ve lisans notu.

### Bölüm 2: Astronomi motoru
- Saf TypeScript, UI yok. Saat dilimi: konumdan IANA bölgesi (`tz-lookup` 6.1.25: `tz.js` 73,4 KB, gzip 29,2 KB, ölçüldü) + `Intl` ile **o tarihteki** UTC farkı (tarihî yaz saati dahil); bulunamazsa cihaz saat dilimi.
- Kabul (cihazsız, kesin testler): J2000 GMST = 18,697374558 saat; Kutup Yıldızı'nın yüksekliği ≈ enlem; bir yıldızın meridyen geçişindeki yüksekliği = 90° − |enlem − dec|; Sirius'un bilinen bir tarih/yer için yaklaşık alt/az'ı; Ay evresi bilinen yeni ay/dolunay tarihlerinde doğru.
- Tarihî saat dilimi (ör. İstanbul 2016 öncesi EET/EEST) için Android ve iOS Hermes `Intl` davranışı **gerçek cihazda doğrulanmalı**; testte sahte `Intl` ile mantık, cihazda davranış denenir.

### Bölüm 3: Poster çizimi
- `react-native-svg` (Skia kullanma: `view-shot` Skia tuvalini Android'de güvenilir yakalamaz). Çok sayıda yıldızı kadir gruplarına bölüp **birkaç `Path`** ile çiz (yüzlerce `Circle` değil).
- Düzen: `StoryCard` (9:16) içinde; altbilgi CTA'sı hazır. Kuzey yukarıda, doğu solda. Posterde "Poster gerçek gökyüzü konumlarını kullanır" notu.
- Görsel olarak doğrulanamaz (ekran yok): sığma hesabını koda dök, uzun yer adı/isimlerde taşma ve `numberOfLines` koru.

### Bölüm 4: Akış ve giriş noktaları
- 4 adım: tarih (3 seçenek) → yer (`MapPickerModal`, `LocationData`) → saat (varsayılan 22:00) → önizleme/paylaş.
- Giriş: Menü > Aşk & Ortak Anılar'a "Gökyüzümüz" satırı ve `AnniversaryMilestoneModal`'a buton. Tercihler yalnızca cihazda (`safeStorage`).
- Premium: önizleme ve hikâye kartı ücretsiz; baskı dosyası/tema/başlık Premium (`PremiumPaywall featureSource` kuralına uy).
- Demo modu: sahte tarih ve yer ile çalışsın, kayıt isteme.

### Bölüm 5: "Yıldızımız" cümlesi ve baskı dosyası
- Çiftin yıldızı `catalog_code = HIP-xxxx` ise gerçek katalogda ara. Bulunursa o geceki yükseklik ve yön hesaplanır: ufkun üstünde → altın halka + cümle; altında → "O gece ufkun altındaydı" ya da cümle yok; bulunamazsa/sanal (SOL-*, sanal kod) → hiç gösterme.
- Baskı: 3:4, hedef ~2400×3200 piksel; bellek taşmasına karşı gerçek cihazda dene; başarısızsa daha düşük çözünürlüğe düş ve kullanıcıya söyle.
- Yasal: atıf satırı (HYG + Stellarium, CC BY-SA) baskı sürümünde küçük, poster bilgi ekranında tam.

### Bölüm 6: İnceleme
- `/code-review high` ile bağımsız inceleme; ayrıca gerçek cihazda: doğruluk (bilinen bir gece için bir gökyüzü uygulamasıyla karşılaştır), saat dilimi (yaz saati olan ve olmayan bir yer), baskı belleği, TR/EN taşma.

## 6. Proje kuralları (her bölümde geçerli)
- Kod yazmadan önce `https://docs.expo.dev/versions/v57.0.0/` (AGENTS.md). Yeni native paket gerekiyorsa söyle (yeni build ister); `tz-lookup` saf JS'tir.
- `supabase db push` YASAK; bu işte zaten veritabanı yok.
- Her bölüm kendi commit'i; testler (`npx jest`), `npx tsc --noEmit`, `npx eslint` temiz olmadan commit yok.
- Gökkubbe yıldız konumları, katı ≥1° aralık ve "konum değişmez" kuralına dokunma.
- Dilde "gerçek yıldız sahibi" iddiası yok; yıldızlar uygulama içi sembolik.
