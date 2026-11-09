# "Bizim Gecemiz": bağımsız inceleme sonrası düzeltmeler

Branch: `gece-gokyuzu`. Tarih: 2026-11-09. Kaynak: bağımsız inceleme raporu (13 bulgu; ayrıntıları aşağıdaki üç bölüm kapsar).
Bu belgeyi okuyan oturum A, B, C'yi SIRAYLA yapar; her biri AYRI commit olur. Her bulguyu ÖNCE kodda/veride yeniden üret, sonra düzelt; yeniden üretemediğini "yeniden üretilemedi" diye raporla, uydurma düzeltme yapma.

## Ürün sahibi kararları (2026-11-09)
1. Demo modunda baskı dosyası ve özel başlık KAYIT İSTEĞİNE gider (önizleme ve hikâye paylaşımı açık kalır).
2. Ay'ın aydınlık yanı hemisfere göre ters ÇEVRİLMEZ; `southern` mantığı kaldırılır (bkz. B-2).
3. Hikâye kartında veri atfı OLMAMASI olduğu gibi kalır (hukuk sorusu avukata gidecek; kodu değiştirme).

## Genel kurallar
- `AGENTS.md`, `CLAUDE.md`, `docs/GECE_GOKYUZU_PLANI.md` oku. Yeni Expo/RN API'si kullanacaksan önce https://docs.expo.dev/versions/v57.0.0/ oku.
- Motor (`src/modules/sky/astronomy`; `sun.ts` dahil, twilight sınıflarını DEĞİŞTİRME), veri (`src/modules/sky/data`), `src/modules/stars`, veritabanı/migration, `supabase` DEĞİŞTİRME. `supabase db push` YASAK. Yeni bağımlılık ve yeni native modül ekleme (native gerekiyorsa DUR ve raporla). Konum/yer adı/koordinat loglama. Push etme. `supabase/seed_marketing_en_couple_165.sql` senin değil.
- Her bölümden önce ve sonra `npx jest`, `npx tsc --noEmit`, `npx eslint <dokunulan dosyalar>` TEMİZ olmalı; çıktıyı oku, özetlemeden "geçti" deme.
- Ekran/cihaz göremezsin: görmediğin davranışı "doğrulandı" diye sunma.

---

## A) Gizlilik ve adres (commit: `fix(sky): privacy - shorten place names, stop persisting coordinates, correct claim`)

Oku: `src/modules/sky/flow/` (`NightSkyFlowModal.tsx`, `skyPrefs.ts`, `flowLogic.ts`), `src/components/MapPickerModal.tsx` ve `.web.tsx`.

1. **Kapı numaralı açık adres posterde çıkabiliyor ve değiştirilemiyor.** `MapPickerModal`'ın ters coğrafi kodlaması tam adres dönebiliyor; poster bunu `placeName` olarak basıyor. Beklenen: paylaşılan görselde en fazla ilçe/şehir düzeyi. Düzelt: (a) adı posterde kullanmadan önce ilçe/şehir düzeyine indiren SAF fonksiyon (kapı numarası, sokak, posta kodu atılır; Türkçe ve yabancı adres biçimleriyle test et); (b) 2. adımda kullanıcının yer adını DÜZENLEYEBİLECEĞİ alan (varsayılan kısaltılmış ad; boş bırakılırsa poster yer satırını gizler).
2. **"Yer yalnızca bu telefonda kalır, paylaşılmaz" metni yanlış:** son seçilen konum `safeStorage` (AsyncStorage) ile tutuluyor ve Android'in bulut yedeğine girebilir. Düzelt: koordinatları KALICI SAKLAMA (yalnızca yer adı, saat, "saat biliniyor mu", başlık saklansın; ya da koordinat ~0,1° yuvarlanarak: hangisini seçtiysen gerekçeni yaz) ve çeviri metnini doğruya çevir ("sunucumuza gönderilmez" gibi; "yalnızca bu telefonda" iddiası KALMASIN), TR/EN. `skyPrefs` ve çeviri eksiksizliği testlerini güncelle.
3. **Adres çözülemezse posterde "Seçilen Konum" yer tutucusu yazıyor.** Beklenen: çözümlenemeyen yer adı posterde HİÇ görünmesin (satır gizlensin). Yer tutucu metni nerede üretiliyorsa bul; kullanıcıya gösterilen ekranda kalabilir ama posterin `placeName`'ine GİTMESİN.
Testler: adres kısaltma, `skyPrefs` (koordinat saklanmıyor), poster yer satırı gizleme, TR/EN anahtar eksiksizliği. Android yedek davranışı gerçek cihazda doğrulanamaz: raporla.

---

## B) Doğruluk (commit: `fix(sky): add position check to star sentence, correct moon limb, tier twilight warning`)

Oku: `flow/ourStar.ts` (+ testi), `render/moonShape.ts`, `SkyChart.tsx`, `NightSkyStoryCard.tsx`, `NightSkyPrintLayout.tsx`, `flow/flowLogic.ts` (uyarı seçimi), `astronomy/sun.ts`.

1. **Kadir kapısı 35 yanlış yıldızı "yıldızınız" diye geçiriyor.** `describeOurStar` yalnızca kadir farkı ≤ 0,15 denetliyor; plan (§2 madde 3) "gerçek yıldızda VE konum eşleşirse" diyor, konum denetimi uygulanmadı. Kadir şartına EK olarak uygulamadaki (`ra`,`dec`) ile poster kataloğundaki gerçek konum arasındaki AÇISAL MESAFE denetlensin. Eşiği tahminle değil VERİDEN seç: migration dosyalarından (`20260906*`, `20260907*`, `20261105000002*`) uygulamadaki yıldızları `SKY_STARS` ile karşılaştır, kadir-uyumlu yıldızların açısal ayrışma dağılımını çıkar (yeni HYG genişlemesi ~0°; eski tohum, sıkışmasın diye kaydırılmış), makul bir eşik seç; adlandırılmış sabit (`MAX_ANGULAR_SEPARATION_DEG`) ve gerekçeli yorum. Katalogda yoksa/konum NaN ise cümle yok. İncelemenin bulduğu 35 yanlış yıldızı YENİDEN ÜRET (hangi HIP'ler) ve düzeltmeden sonra elendiklerini testle göster; eleme sayısını raporla.
2. **Güney yarım kürede Ay'ın aydınlık yanı hep ters.** Poster SABİT bir harita (kuzey üstte, doğu solda); büyüyen ayın aydınlık yanı Güneş'e dönüktür: bu haritada batıya (sağa), azalan ayda doğuya (sola); hemisfere BAĞLI DEĞİL. `southern` bayrağı bunu yanlış çeviriyor ve mevcut test yanlış davranışı kilitliyor. Düzelt: `southern` mantığını ve prop'unu kaldır (çağrıları güncelle), aydınlık yanı `waxing`'e göre belirle, testi doğrusuyla değiştir. KANIT: bir testte `astronomy-engine` (zaten devDependency) ile Güneş ve Ay azimutundan, haritada aydınlık limbin Güneş'e dönük olduğunu birkaç tarih/yerde (iki yarım küre) doğrula.
3. **"Yıldızlar görünmezdi" uyarısı karanlık gecede de çıkıyor** (İstanbul'da varsayılan 22:00'de yılda ~91 gün): `sun.twilight !== 'night'` olunca hep uyarı; oysa astronomik alacakaranlık (−12°…−18°) yıldız görmek için yeterince karanlık. Üç kademe: `day`/`civil` → güçlü uyarı ("gökyüzü aydınlıktı"); `nautical` → yumuşak ("alacakaranlıktı, sönük yıldızlar görünmezdi"); `astronomical`/`night` → UYARI YOK. Aynı kademeler "yıldızımız" cümlesinin `…Daylight` varyantları için de geçerli (astronomical'de gündüz varyantı KULLANILMASIN). TR/EN metin ekle/güncelle, `flowLogic` ve `ourStar` testlerini güncelle; İstanbul 22:00 yaz akşamı için uyarı çıkmadığını gerçek `computeSky` ile göster.
Raporla: eşik seçimi için veri dağılımı (sayılarla), eleme sayısı, Ay bağımsız doğrulaması sonucu, uyarı kademeleri tablosu.

---

## C) Baskı güvenilirliği ve demo kapısı (commit: `fix(sky): persistent per-size crash trail, blank-output guard, layout timeout, demo gate`)

Oku: `flow/printExport.ts` (+ testi), `PrintSharePreview.tsx`, `flowLogic.ts` (`gateFor`), `NightSkyFlowModal.tsx`, `src/lib/storyShare.ts`, `src/hooks/useDemoAction.ts` ve demo modal kalıbı. expo-file-system kullanacaksan önce https://docs.expo.dev/versions/v57.0.0/sdk/filesystem/ oku (projede nasıl kullanıldığına bak).

1. **Çökme izi tek başarıda siliniyor:** düşük bellekli cihazda 2400×3200 çöküyor; sonraki açılışta iz silinmiş olduğundan yine 2400'ü deniyor → "her iki denemeden biri" çöküyor. İz BAŞARISIZ boyutu hatırlasın; başarı yalnızca O BOYUTUN başarısız izini silsin (küçük boyuttaki başarı büyük boyutun izini silmesin). Başlangıç boyutu: bilinen en büyük BAŞARILI/denenmemiş boyut. Başarısız boyuta bir süre sonra (uygulama sürümü değişince ya da makul süre geçince) yeniden denemeye izin ver; kalıcı küçük kalmasın. SAF fonksiyonlarla (sahte depolama, sahte saat) test et: çökme → sonraki oturum bir alt boyuttan başlar → küçük başarı büyük izi silmez → süre dolunca tekrar dener.
2. **iOS'ta 2400×3200 çıktının boş/eksik çıkma olasılığı** (cihazda doğrulanamaz). Yakalanan dosyanın bayt boyutunu kontrol et; çok küçükse (tek renkli PNG sıkışır; eşik sabit + gerekçe) başarısız say ve alt boyuta düş. iOS için başlangıç boyutunu düşürme seçeneğini (örn. 1800×2400) bir sabitle kodda HAZIR tut ama VARSAYILANI cihaz doğrulamasına kadar mevcut tut; raporda belirt.
3. **Düzen zaman aşımı (1,5 sn) olasılığı:** onLayout beklemesi dolarsa şu an çiziliyor mu? Zaman aşımında yakalamayı BAŞARISIZ deneme say ve anlaşılır hata ver (yarım düzeni sessizce yakalama). Mantığı test et.
4. **Demo modu baskı dosyasını ve özel başlığı bedava veriyor** (demo profili Premium sayılıyor). Karar: demo'da `printExport` ve `customTitle` KAYIT İSTEĞİNE (mevcut demo modal kalıbı) gitsin; önizleme ve hikâye paylaşımı demo'da AÇIK kalsın. `gateFor`, akış ve testleri güncelle; Premium ve ücretsiz davranışı DEĞİŞMESİN. `shareStoryImage` davranışını bozma (Wrapped/Harita/Sertifika/Milestone aynı kalmalı).
Raporla: her bulgunun yeniden üretme sonucu, iz durumları tablosu, `gateFor` yeni tablosu (ücretsiz/Premium/demo), DOĞRULANAMAYANLAR (iOS boş görsel, gerçek bellek davranışı).

---

## Bitince
Üç commit da `gece-gokyuzu` üzerinde, push YOK. Sonunda tek bir toplu rapor ver: her bölümün commit numarası, test/tsc/eslint çıktıları, doğrulanamayanlar listesi.
