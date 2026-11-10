# Ortak Liste: "Birlikte Yapacaklarımız" (uygulama planı)

Dal: `ortak-liste` · Hazırlanma: 2026-11-09 · Durum: **Faz 1A, 1B, 1C ve gözden geçirme düzeltmeleri bitti ve `eff0781`'de commitlendi (2026-11-10); ayrıntılı ekleme ve yerleşim yenilemesi çalışma ağacında, commitlenmedi; `main`'e birleştirilmedi, sunucu canlıya uygulanmadı, üretimde kapalı** (bkz. bölüm 0)
Yayın öncesi işler (cihaz testi, Apple anahtarı, mektup kilidi) bitmeden bu dal `main`'e girmez; migration ve `send-push` değişikliği yeni build ister.

Bu belge başka oturumların (Faz 1A/1B/1C, Faz 2, Faz 3) bağımsız çalışabilmesi için yazıldı. Önce `docs/OZELLIKLER.md` §2, §4.10, §6'yı oku.

---

## 0. Durum notu (2026-11-10)

**Bitti (hepsi `ortak-liste` dalında; 1A/1B/1C ve gözden geçirme düzeltmeleri `eff0781`'de commitlendi; ayrıntılı ekleme ve yerleşim yenilemesi çalışma ağacında, henüz commitlenmedi; `main`'e birleştirilmedi):**
- **1A sunucu:** migration `20261109000000` (tablolar, RLS, RPC, sınır tetikleyicisi), `20261109000001` (hesap silme ve yeni eşleşmede taşıma), test `supabase/tests/couple_wishlist_test.sql`. Geçici Postgres'te doğrulandı. **Canlıya uygulanmadı ve yayın öncesi işler bitmeden uygulanmayacak.**
- **1B ekran:** `wishlist.tsx` + `src/components/wishlist/*`, `useWishlist.ts`, `wishlistData.ts`. Veri, `wishlistData.ts` içinde `SERVER_READY = false` olduğu için `wishlistMock.ts`'ten gelir (bellek içi; uygulama kapanınca sıfırlanır).
- **1C yan işler:** TR/EN çeviri cilası (yetim ve eksik anahtar yok, çoğul anahtarlar), 10 hazır fikir yeniden dengelendi (6 kategori; en çok 2), demo verisi gözden geçirildi, testler (`wishlist.test.ts`, `wishlistLocales.test.ts`, rota izin testi), menü satırı (`menu.wishlist.*`), `<Tabs.Screen name="wishlist" />`, `TabBarCustomizer`/`TabBarContext` seçeneği (**varsayılan kapalı**), sayfa rehberi `guides.pages.wishlist` (tur düğmesi artık görünür; menüdeki rehber listesi `FEATURE_GUIDE_PAGE_KEYS`'ten otomatik alır), `notificationRoutes.ts` izin listesine `/(tabs)/wishlist` (yalnızca `route` ile; `TYPE_ROUTES`'a tür eklenmedi, push tipi Faz 2'de), paywall metni (`paywall.copy.wishlist`), `docs/OZELLIKLER.md`.

**1B'nin verdiği kararlar (değiştirme):**
- **Kısa başlık:** TR "Yapacaklarımız", EN "Our Bucket List"; alt başlık "Birlikte yapmak istediklerimiz". Geri uzatma. Sekme etiketi TR "Yapacaklar", EN "Bucket List".
- **🎲 ve filtre:** 🎲 küçük bir düğmedir: "Açık fikirler (n)" başlığının sağında, o bölüm yoksa (bütün açıklar "ikimiz de") "İkimiz de" başlığında; ikisi de filtrenin altında kalır (yerleşim yenilemesi); filtre seçiliyken seçim o kategorideki maddelerden yapılır (önce ikisinin de istedikleri, yoksa açıklar). Filtrede seçilecek madde yoksa düğme gizlenir. "Başka bir tane" aynı maddeyi yeniden vermez; havuzda tek madde varsa onu verir.
- **Solo kuralı:** tek kalan kullanıcı yazma eylemlerinde `soloGate.blockPartnerFeature()` ile durdurulur, hızlı ekleme çubuğu kilitli görünür; **kendi maddesini silebilir** (veri onun, sunucu silmeyi engellemez). Solo'da hiçbir madde "ikimiz de" sayılmaz.
- **"Yaptık"ı geri almak da 15 sınırına bağlı** (sunucu `P0022`; istemci sınır doluysa sunucuya gitmeden paywall/mesaj gösterir).
- **sanitize:** başlık/not `sanitize` ile temizlenir. (`sanitizeStrict` artık yok, 2026-11-11: `&`, `'`, `"`, `<`, `>` karakterlerini HTML varlığına çevirip öyle kaydediyordu. Aşağıdaki "Çıkan açık işler" maddesine bakın.)

**Doğrulananlar (son durum, yerleşim yenilemesinden sonra):** `npx tsc --noEmit` temiz; `npm test`: 61 paket, 978 test geçiyor (1C sonunda 52/826, gözden geçirme düzeltmelerinden sonra 59/927, ayrıntılı eklemeden sonra 60/952); TR/EN anahtar eşitliği testle sabit (wishlist, menu, tabs, rehber, paywall, serverErrors); `WISHLIST_FREE_LIMIT` (15), `WISHLIST_PREMIUM_LIMIT` (300), başlık/not uzunluğu ve kategori listesi migration dosyasıyla testle eşleşiyor.

**Doğrulanamayanlar:**
- **Cihaz/emülatör:** hiçbir ekran gerçek cihazda ya da emülatörde denenmedi; 6 tema × TR/EN × büyük yazı ekran görüntüsü kontrolü (bölüm 3, zorunlu) yapılmadı. Kod/ekran okumayla ve tsc ile yetinildi.
- **Web:** bu dalda web derlemesi `react-native-google-mobile-ads` yüzünden kırık (`codegenNativeComponent`). Reklam modülü geçici taklitle atlanınca uygulama bu kez `expo-notifications`'ta (`getLastNotificationResponse` web'de yok) hata sınırına düşüyor; yani menüden listeye gidiş web'de gösterilemedi. Geçici iskele (metro.config.js değişikliği ve taklit dosya) silindi, `metro.config.js` değişmedi.
- **Sunucu:** RLS ve sınır davranışı yalnızca geçici Postgres'te sınandı; canlıda ve iki gerçek hesapla denenmedi. İstemci sunucuya hiç bağlanmadı (`SERVER_READY = false`): gerçek sütun/RPC adlarıyla uyum bu yüzden canlıda ilk kez sınanacak.
- Demo modunda ekranın gerçek açılışı, tur penceresinin görünümü, TabBarCustomizer'da yeni satırın görünümü (6 sekme sınırı, ön izleme) gözle görülmedi.

**Gözden geçirme düzeltmeleri (15 bulgu, 2026-11-10):**
- **Açılış kapısı:** tek bayrak `WISHLIST_SERVER_READY` artık `src/lib/wishlistAvailability.ts`'te. Kapalıyken üretimde menü satırı, sekme seçeneği (kayıtlı tercihte kalmışsa ayıklanır), menüdeki rehber kaydı ve bildirim rotası kapalı; ekran derin bağlantıda ana sayfaya yönlendirir. Demo modunda ve geliştirme yapısında açılır, ekranda "örnek liste / önizleme" uyarısı çıkar. Bayrak açılınca hepsi birlikte açılır (`wishlistAvailability.test.ts` bayrağın kapalı olduğunu da sabitler: açan kişi testi de günceller).
- **Sunucu:** `20261109000002` (sınır tetikleyicisi en başta `couple_id = get_my_couple_id()` ve `created_by = auth.uid()` doğrular, değilse RLS ile birebir aynı 42501; başka çiftin doluluğu/Premium'u sızmaz), `20261109000003` (`set_wishlist_done` yalnızca `status = 'open'` iken yazar; zaten yapılmışsa dokunmaz, hata vermez).
- **Okuma:** açık maddeler ayrı (≤300), yapılanlar ayrı, kategoriye göre sunucuda süzülmüş, 30'ar sayfalı ve toplam sayılı (`fetchWishlistOpen`, `fetchWishlistDonePage`). Eski "300 satır yapılanları da sayıyor" sorunu kapandı.
- **Ekran:** bölüm hesabı tek ve saf (`buildWishlistView`); kategori filtresi her şeye uygulanır (karar a); sayaç `min(açık, sınır)` (karar b). İyimser güncelleme hatada yalnızca o maddeyi geri alır, liste süren yazım kalmayınca yenilenir. Hatalar türüne göre (`wishlistErrors.ts`). Hızlı ekleme ve fikir çiplerinde ref tabanlı çift gönderim kilidi (`useSubmitLock`). Konum: ad ve nokta yalnızca haritadan seçimde birlikte gelir; ad elle değişirse (tek harf bile) koordinat silinir, değişmeden kalırsa korunur. "Aynı yer" tahmini yapılmaz ("Kapadokya" → "Kapalıçarşı" başka yerdir) (`wishlistLocation.ts`). Açık madde varken ekranın hazır/hata/çevrimdışı durumu yalnızca açık maddeler sorgusuna bağlıdır; açık madde yokken yapılanlardan veri gelmeden boş durum gösterilmez, iskelet/çevrimdışı/hata gösterilir (`wishlistBodyState`); yapılanlar sorgusu kategori değişiminde önceki sayfaları gösterir (`keepPreviousData`) ve yükleniyor/hata durumunu yalnızca "Yaptıklarımız" bölümünde gösterir. Sunucu P0020/P0021 dönerse profil yenilenir. Sınır dolunca sayacın kişi başına olduğunu anlatan kısa metin (`wishlist.quick.limitPerPerson`). **Ayrıntılı ekleme** (cihaz geri bildirimi: not ve konum yalnızca eklendikten sonra "Düzenle" ile girilebiliyordu): çubuktaki "Ayrıntı ekle" aynı pencereyi ekleme modunda açar; not ve konum tek INSERT'le gider (`addWishlistItem` artık bütün alanları alır). Kapılar (demo, tek kalan, çevrimdışı, sınır) çubukla aynı (`canAdd`); pencerede kayıt `useSubmitLock` ile tek gönderimdir, kayıt sürerken pencere kapatılamaz (düzenlemede de: eski düzenleme penceresi kaydet'e aynı karede iki dokunuşta iki güncelleme gönderiyordu). Testler `addFlow.test.tsx` (gerçek ekran + çubuk + pencere); o turdaki doğrulama: `tsc` temiz, `npm test` 60 paket, 952 test. Cihazda bakılmadı.
- **Yerleşim yenilemesi (2026-11-10, cihaz geri bildirimi: "düzen duygusuz bir yapılacaklar listesi gibi"):** veri katmanı, kurallar, kapılar, kilitler ve pencere değişmedi; yalnızca yerleşim.
  - **Ekleme çubuğu** dinlenirken tek satır (kutu + sayaç + gönder, tek kart). Kategori çipleri ve "Ayrıntı ekle" yalnızca kutu odaktayken ya da içinde yazı varken açılır, ikisi de yokken kapanır (`Collapse.tsx`: ölçülen yükseklikle 220 ms, alttaki içerik kayarak yer açar, kapanınca içerik ağaçtan kalkar; "hareketi azalt"ta anında; yalnızca kullanıcı eylemiyle oynar, `Reveal`'e dokunmaz). Seçili kategori kapanınca korunur. Tek kalanda çubuk açılmaz (dokunmak nedenini anlatır), sınır doluyken uyarı metni çubuk kapalıyken de görünür.
  - **Filtre** ekranın tek kalıcı çip sırası (`CategoryFilter`): ikonsuz, küçük, vurgu rengi yok; seçili olan kart yüzeyinde (bölümlü düğme gibi). Ekleme çubuğunun seçim çipleri (`CategoryChips`) ikonlu ve vurgu tonlu kaldı. Sıra ekran kenarına kadar kayar. **Sıra değişti:** filtre artık çubuğun hemen altında, "İkimiz de"nin üstünde (eskiden altındaydı). Sebep: filtre "İkimiz de"yi de süzer (karar a); altta dururken kategori seçince üstteki bölüm kaybolup çip sırası parmağın altından yukarı kayıyordu ve neyi süzdüğü belirsizdi.
  - **🎲** büyük `ActionCard` değil, "Açık fikirler (n)" başlığının sağında küçük düğme (`PickButton`, görünen metin `wishlist.pick.button`; erişilebilirlik etiketi "Bana bir tane seç, İkinizin de istediklerinden / Açık fikirlerinizden"). Görünürlük `view.canPick`. Açık fikirler bölümü yokken (bütün açıklar "ikimiz de") düğme "İkimiz de" başlığına geçer: yoksa seçilebilir madde varken düğme kaybolurdu.
  - **Madde kartı** tek sıralı: solda "yaptık" dairesi, ortada başlık (en çok 2 satır) ve tek satır ikincil bilgi (ekleyenin 16 px avatarı, kategori ikonu, not, konum; not ve konum yoksa kategori adı, boş kalmasın), sağda 💗. Partner istediyse avatarı kalbin köşesinde (eskiden kalbin solunda ayrı öğeydi); etiket "Ben de istiyorum, Sevgilin de istiyor". Üç nokta yok: ekleyenin kartında ortadaki alana dokunmak düzenle/sil menüsünü açar; partnerin kartı dokunulabilir değil (yetki aynen). Ekran okuyucu: orta alan tek parça okunur (başlık, not, konum, ekleyen), "Düzenle" ve "Sil" `accessibilityActions` ile menüsüz de çalışır; "yaptık" dairesinin etiketine madde başlığı eklendi. Notsuz kart 60 px civarı (eskiden ~100). Yapılanlar aynı kartı kullanır (daire dolu, kalp yok, başlık ikincil renkte, "Yaptık ✓ · tarih" ikincil satırda).
  - **"İkimiz de istiyoruz"** tek vurgulu alan olarak kaldı (açık temada dolu vurgu + parlama, koyu temada vurgu zemini; iki avatar + atan kalp); diğer kartlar sade (kart yüzeyi + `cardBorder`).
  - Yeni anahtarlar: `wishlist.pick.button`; `wishlist.sections.open` artık `{{total}}` alır. O turda kaldırılan anahtar yoktu (`card.moreA11y` sonradan `card.detailsA11y` ile değişti, aşağıda).
  - Testler: `layout.test.tsx` (19: çubuğun açılıp kapanması, tek kalan ve sınır durumları, karta dokunma ve ekran okuyucu eylemleri, partner kartının yetkisi, 🎲 görünürlüğü). `addFlow.test.tsx` çubuğa önce odaklanır (çipler ve "Ayrıntı ekle" artık odakta görünür); `submitLock.test.tsx` çizilenleri her testten sonra kaldırır. Reanimated jest'te yerel modül istediği için üç dosyada küçük bir reanimated taklidi var. Doğrulama: `tsc` temiz, `npm test` 61 paket, 971 test. **Cihazda bakılmadı** (bkz. Doğrulanamayanlar).
  - **Ekleme/düzenleme penceresinin kapanışı** (cihaz geri bildirimi: çarpıya basınca pencere aşağı kaymadan bir anda kayboluyordu): kapanırken form içeriği kaldırılıyordu, Modal boş kayıyordu. `WishlistItemSheet` artık kapanış boyunca son formu çizer; her yeni açılış yeni kimlikle form baştan kurulur (eski taslak geri gelmez). Test `addFlow.test.tsx`; sonrası `npm test` 61 paket, 972 test. Cihazda bakılmadı.
  - **Karta dokununca ayrıntı** (cihaz geri bildirimi: dokununca yalnızca "Düzenle / Sil / Vazgeç" çıkıyor, maddenin kendisi görünmüyordu): menü kalktı, yerine `WishlistDetailSheet` açılır: kategori, tam başlık, tam not, konum, kim ekledi ve ne zaman, kim istiyor ("İkiniz de / Sen / Sevgilin istiyor / henüz kimse") ya da yapıldıysa tarihi. Ekleyen için altta "Düzenle" ve "Sil"; partnerin maddesinde yalnızca ayrıntı (yetki aynen). Partnerin kartı da artık dokunulabilir. Okumanın kapısı yok (demo, tek kalan, çevrimdışında da açılır); düzenle/sil önce pencereyi kapatır, 450 ms sonra bugünkü kapılarla düzenleme penceresini ya da silme onayını açar (iOS iki Modal'ı aynı anda sunamaz). Pencere madde kimliğini tutar, maddeyi listeden güncel okur; madde listeden kalkarsa kendiliğinden kapanır. Kapanırken son madde çizilir (aşağı kayarak kapanır). Kart eylemi `onMore` → `onOpen`; anahtarlar: `wishlist.detail.*` eklendi, `card.moreA11y` yerine `card.detailsA11y` ("Ayrıntıları gör"). Testler `layout.test.tsx` (+8), `addFlow.test.tsx` düzenlemeye ayrıntı üzerinden gider; sonrası `npm test` 61 paket, 978 test. Cihazda bakılmadı.
- **SQL testi** artık gerçek akışla kurulur (`join_couple_by_code_uuid`, `purge_account_data`, gerçek `paired_at`); kurulum commit edilir, senaryolar ROLLBACK, sonda temizlik. Yalnızca yerel/geçici veritabanında.
- **Doğrulama (o turda):** `npx tsc --noEmit` temiz; `npm test` 59 paket, 927 test (hook testinin filtre/hata/çevrimdışı senaryoları düzeltme öncesi hook'ta kırılıyor). Tam pakette görülen "Cannot log after tests are done … ExpoModulesCoreJSLogger" uyarısı Expo'nun `fetch` modülünden gelir, ortak listeyle ilgisi yok. SQL testi geçici PG 12.14 kümesinde 124 kontrolle geçti; temizlik yalnızca testin kaydettiği çiftleri siler (`wishlist_test_registry`, `WLT…` kodlu test dışı bir çift sağ kalıyor); `20261109000002` ya da `...03` çıkarılınca ilgili senaryo kırılıyor (düzeltmelerin kanıtı). **Sınır:** küme tam Supabase şeması değil; temel tablolar (couples, users, meetings…) taklit edildi, ortak listenin dokunduğu fonksiyonların (join, purge, dissolve, move, solo kapısı, RLS yardımcıları) gövdeleri migration dosyalarından aynen alındı. Cihazda/emülatörde ve canlıda denenmedi.

### Canlıya uygulamadan önce (kontrol listesi)
1. **Canlıdaki fonksiyon gövdelerini repodakiyle karşılaştır** (salt okuma):
   ```sql
   SELECT pg_get_functiondef('public.dissolve_couple_for_leaving_member'::regproc);
   SELECT pg_get_functiondef('public.move_member_content'::regproc);
   ```
   **Son tanımlar:** iki fonksiyonun da repodaki son tanımı `20261109000001`'dedir. `20261107000003` (`dissolve_…`) ve `20261107000002` (`move_member_content`) içindeki gövdeler eskidir; o dosyalar canlıya uygulandığı için bilerek değiştirilmedi (not da eklenmedi). Bu iki fonksiyonu ileride değiştiren bir migration gövdeyi **`20261109000001`'den** kopyalamalı; eski dosyadan kopyalarsa ortak liste satırları (silmede maddeler ve `done_by`, eşleşmede taşıma) sessizce kaybolur.
   Beklenen: `dissolve_couple_for_leaving_member` = `20261107000003`'teki gövde, `move_member_content` = `20261107000002`'deki gövde. `20261109000001` bu ikisini "Ortak liste" satırları eklenmiş hâlleriyle **tamamen yeniden tanımlar**. Canlıdaki gövde repodakinden farklıysa (elle ya da başka bir yoldan değişmişse) `20261109000001` o değişikliği sessizce ezer: uygulamadan önce `20261109000001`'i canlıdaki gövdenin üzerine yalnızca ortak liste satırlarını ekleyerek yeniden yaz.
2. **Önce yerel/geçici veritabanında** dört migration'ı sırayla (`20261109000000` → `...01` → `...02` → `...03`) uygula ve `supabase/tests/couple_wishlist_test.sql`'i çalıştır ("tüm kontroller geçti" görülmeli). Testi canlıda asla çalıştırma (kurulumu commit eder).
3. Canlıya uyguladıktan sonra: `pg_get_functiondef('public.trg_wishlist_enforce_limit'::regproc)` gövdesinde `get_my_couple_id` kontrolü, `set_wishlist_done` gövdesinde `IF v_item.status = 'open'` olmalı.
4. Ancak bundan sonra `src/lib/wishlistAvailability.ts` içinde `WISHLIST_SERVER_READY = true` (tek değişiklik), `wishlistAvailability.test.ts`'teki "bayrak kapalı" beklentisini güncelle, `wishlistMock.ts`'i sil. Yeni build gerekir.
5. İki gerçek hesapla dene: ekleme, 💗, yaptık, sınır (15), başka hesapla görünmezlik.

**Çıkan açık işler / rapor:**
- ~~`sanitizeStrict` kaynaklı HTML varlığı sorunu~~ **istemcide düzeltildi (2026-11-11, yeni build ister):** `sanitizeStrict` kaldırıldı; buluşma başlığı/yeri, anı, fotoğraf ve mektup başlığı, ilaç adı ve görünen isim artık `sanitize` ile (kaçışsız) yazılıyor. Eski kayıtlar ve eski sürümün yazmaya devam ettiği kayıtlar okunurken çözülüyor: `src/lib/legacyEntityFetch.ts` (Supabase istemcisinin fetch'i, bütün PostgREST/RPC yanıtları), yardımcı `decodeLegacyEntities` (`src/utils/sanitize.ts`; yalnızca `&amp; &lt; &gt; &quot; &#x27;`, çift kodlama sonuna kadar), ayrıca bildirim metni (`cleanNotificationText`), ön plandaki push kartı (`NotificationContext`) ve önbellekteki profil adı (`AuthContext`). Testler: `src/utils/__tests__/sanitize.test.ts`, `src/lib/__tests__/legacyEntity*.test.ts(x)`. **Kalan:** telefonun bildirim çubuğundaki sunucu push'ları (send-push DB'deki kodlanmış adı/başlığı olduğu gibi gönderiyor) ve canlı veri temizliği; ikisi de `docs/BILINEN_SINIRLAR_VE_YAYIN_SONRASI_ISLER.md` bölüm 0'da. 🔎 Cihazda doğrulanmadı.
- Ortak liste sunucusu canlıda değil; `SERVER_READY` bayrağı açılınca `wishlistMock.ts` silinecek.
- Konum alanı sunucuda ≤500, ekranda 100 karakterle sınırlı (tutarlı, sorun değil).

---

## 1. Ürün kararları (kullanıcı onayladı)

| Karar | Değer |
|---|---|
| Ücretsiz sınır | **15 açık madde**. Yapılanlar (`done`) sayıya girmez. Premium: sınırsız (teknik üst sınır 300 açık madde) |
| Premium biterse | Hiçbir şey silinmez; yalnızca yeni ekleme kilitlenir (mevcut kış uykusu ruhu) |
| 🎲 "Bana bir tane seç" | **Faz 1'de** |
| Puan | **Yok.** `activity_point_rules`'a dokunma. Puan zaten buluşma (4) ve anı (1) üzerinden gelir |
| Hediye kategorisi | **Yok** (liste ortak; sürpriz fikri partnere görünür). İleride "sadece benim" gizli liste ayrı iş |
| Eşleşme | Şart (solo kullanıcı yazamaz; `trg_solo_write_guard('partner')`) |
| Şifreleme | Düz metin (takvim notu / harita notu / buluşma ile aynı). 🔎 Anıların şifreli olup olmadığına bak, tutarlı ol |

## 2. Kullanıcı deneyimi

**Madde:** başlık (≤80), not (≤300, isteğe bağlı), kategori, konum (isteğe bağlı, `MapPickerModal`).
**Kategoriler (6, sabit):** Yer · Film & Dizi · Yemek · Deneyim · Seyahat · Diğer.

**Ekran akışı (yukarıdan aşağıya):**
1. `ScreenHeader` (başlık + tur butonu) ve `SoloFeatureBanner`.
2. **Hızlı ekleme çubuğu:** dinlenirken tek satır: metin kutusu + sayaç (ücretsizde "7/15") + gönder; 15'te gönderme paywall'a gider ve sınır uyarısı hep görünür. Kutu odaktayken ya da içinde yazı varken altında kategori çipleri ve **"Ayrıntı ekle · not, konum"** satırı açılır: çubuktaki başlık ve kategoriyle ekleme penceresini açar (ekleme ve düzenleme aynı pencere: `WishlistItemSheet`, `mode: "create" | "edit"`). Kaydedince madde eklenir, pencere kapanır, çubuk sıfırlanır; iptalde çubuk olduğu gibi kalır. Sınır doluysa pencere açılmaz, paywall açılır; pencere açıkken liste dolarsa (ya da sunucu P0022 dönerse) pencere kapanır, paywall kapanıştan sonra açılır (iOS iki Modal'ı aynı anda sunamaz).
3. **Kategori filtre çipleri** (Tümü + 6 kategori), yatay kayan; ekranın tek kalıcı çip sırası, seçim çiplerinden küçük ve sade. Altındaki her şeyi süzer.
4. **"İkimiz de istiyoruz"** bölümü (ikisinin de 💗 verdiği açık maddeler): ekranın tek vurgulu alanı, iki avatar + kalp rozeti.
5. **"Açık fikirler (n)"** başlığı ve sağında küçük **🎲 "Bir tane seç"** düğmesi: ikisinin de istediklerinden rastgele seçer; hiç yoksa tüm açık maddelerden. Açık fikirler bölümü yoksa düğme "İkimiz de" başlığında durur. Sonuç bir alt sayfada çıkar: madde + "Buluşma planla" (Faz 2'ye kadar gizli ya da pasif) + "Başka bir tane".
6. **Açık maddeler** listesi.
7. **Yaptıklarımız** (katlanır, varsayılan kapalı): üstü çizili değil, "Yaptık ✓ · 14 Şubat" olarak sakin görünür.
8. **Boş durum:** `EmptyState` + **hazır fikir çipleri** (TR/EN statik liste; dokununca eklenir; `defaultMemories.ts` kalıbında `src/lib/wishlistIdeas.ts`).

**Madde satırı (tek sıra):** solda "yaptık" onay dairesi; ortada başlık ve tek satır ikincil bilgi (ekleyenin küçük avatarı `useCoupleAvatars`, kategori ikonu, not, konum; ikisi de yoksa kategori adı); sağda 💗 (benim), partnerin isteği kalbin köşesinde küçük avatarıyla. "⋯" yok: karta dokunmak ayrıntı penceresini açar (tam not, konum, ekleyen, istekler; ekleyene düzenle / sil; ekran okuyucuda ekleyenin kartında ayrı eylemler).
**Yetki:** ekleyen düzenler ve siler. İki kişi de 💗 verir ve "yaptık" işaretler.

## 3. Tasarım kuralları (UYUM: bu bölüm pazarlık konusu değil)

Uygulamada 6 tema var: **kadın** Gül & Bordo (pembe) / Gece / Açık Pudra, **erkek** Gece Mavisi / Obsidyen / Beyaz (`src/lib/theme.ts`, `AppTheme`). Liste ekranı hepsinde, hem TR hem EN, hem büyük yazı boyutunda doğru görünmeli.

1. **Hiç sabit renk yok.** Her renk `useTheme()` → `AppTheme`'den gelir: `cardBg`, `cardBorder`, `...cardShadow` (açık temada gölge), `unitBg`, `accent`, `accentLight`, `pillAccentBg`, `pillAccentBorder`, `inputBg`, `inputBorder`, `text`, `textSecondary`, `textMuted`. İstisna: silme kırmızısı `isLight ? "#DC2626" : "#ef4444"` ([meetings.tsx:391](../src/app/(tabs)/meetings.tsx)).
2. **Zayıf vurgu dolguları** meetings.tsx'teki gibi: `isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.05)"`.
3. **Kategoriler renkle değil ikonla ayrılır.** 6 renk 6 temayla çatışır; tek vurgu rengi + lucide ikonu (`pillAccentBg` karo içinde). Önerilen ikonlar: MapPin, Clapperboard, UtensilsCrossed, Sparkles, Plane, Star.
4. **Biçim dili:** yatay boşluk 16, bölümler arası 18, hero/kart köşesi 24-26, liste kartı 20, bölüm etiketi 11px büyük harf `textMuted`. Yazı tipi `Inter_700Bold` / `Inter_400Regular` (başlık `letterSpacing -0.3`).
5. **Hazır bileşenleri kullan, yeniden icat etme:** `ScreenBackground`, `ScreenHeader`, `ActionCard`, `EmptyState` (+ `EmptyStateIllustrations`), `Skeleton`, `Reveal`, `Pulse`, `UserAvatar`, `SoloFeatureBanner`, `toast`, `appAlert`, `LazyPremiumPaywall`, `usePageTour`, `usePullToRefresh`. Alt boşluk `insets.bottom + 140` (yüzen sekme çubuğu).
6. **"İkimiz de istiyoruz" bölümü** ekranın imza parçası: `pillAccentBg` zemin + `pillAccentBorder` kenarlık, açık temada `ActionCard`'daki gibi dolu `accent` ve üst parlama gradyanı; koyu temada dolgu yok (neon gibi parlamasın, ActionCard'ın yorumuna bak).
7. **Hareket:** giriş animasyonu yalnızca `Reveal scope="wishlist"` ile, **ekran başına tek seferlik** (kart sallanması yok; kullanıcı tercihi). 💗'e basınca kısa dolma + `hapticSelection`. 🎲'te yumuşak dönme; `useReducedMotion` açıksa dönmez, sonuç doğrudan çıkar. Sürekli dönen/atan şey yalnızca bir yerde olsun (`Pulse`, "İkimiz de" rozeti).
8. **Ses/titreşim:** mevcut yardımcılar (`soundEffects.ts`): 💗 `hapticSelection`, ekleme `playBubblePop`, "yaptık" `playSuccessChime` + `hapticSuccess`. Yeni ses ekleme.
9. **Erişilebilirlik:** her ikon düğmesi `accessibilityLabel` ister (bilinen açık iş: ~22 etiketsiz düğme var, yenisini ekleme). Dokunma alanı ≥ 44, `hitSlop`. Yazı boyutu `fontScaleCap.ts` ile uyumlu; uzun başlık `numberOfLines` + taşma testi. Açık temada metin kontrastı AA.
10. **Boş/yükleme/hata/çevrimdışı** dört durumu da tasarla (`Skeleton`, `EmptyState`, `OfflineBanner` var).
11. **Demo modu:** yazma eylemleri `executeOrIntercept` ile kayıt ister ([meetings.tsx:135](../src/app/(tabs)/meetings.tsx)); `DEMO_WISHLIST` TR/EN.

**Doğrulama (zorunlu):** 6 tema × (TR, EN) × (normal, en büyük yazı) ekran görüntüsü; boş, dolu, 15/15 limit, yapılanlar açık, demo, solo. Gözle kontrol edilmeden "bitti" denmez.

## 4. Teknik sözleşme (1A ile 1B arasındaki arayüz)

Migration dosyası: `supabase/migrations/20261109000000_couple_wishlist.sql` (önek çakışması yok; son dosya `20261108000000`).

**Tablolar**
- `couple_wishlist_items`: `id bigserial PK`, `couple_id int FK couples ON DELETE CASCADE`, `created_by uuid FK auth.users ON DELETE CASCADE`, `title text CHECK (char_length 1..80)`, `note text CHECK (≤300)`, `category text CHECK IN ('place','film','food','experience','travel','other')`, `location_name text`, `latitude numeric`, `longitude numeric`, `status text CHECK IN ('open','done') DEFAULT 'open'`, `done_at timestamptz`, `done_by uuid`, `meeting_id` ve `memory_id` (Faz 2; şimdiden nullable sütun, FK `ON DELETE SET NULL`), `created_at`, `updated_at`.
- `couple_wishlist_wants`: `(item_id FK CASCADE, user_id)` PK; ekleyen için satır tetikleyiciyle otomatik.

**RLS (buluşma kalıbı, [20261107000004:211-235](../supabase/migrations/20261107000004_solo_guards_and_paired_visibility.sql))**
- SELECT: `created_by = auth.uid() OR (couple_id = get_my_couple_id() AND created_at >= my_couple_paired_at())`. `(SELECT ...)` sarmalı kullan.
- INSERT: `created_by = auth.uid() AND couple_id = get_my_couple_id()`.
- UPDATE/DELETE (başlık, not, kategori, konum): yalnızca `created_by = auth.uid()`.
- `wants` SELECT: bağlı madde görünürse; INSERT/DELETE yalnızca kendi satırı. Partner işlemleri RPC ile:
  - `set_wishlist_want(p_item_id bigint, p_want boolean)` — SECURITY DEFINER, `SET search_path = ''`, çift ve `paired_at` kontrolü.
  - `set_wishlist_done(p_item_id bigint, p_done boolean)` — her iki kişi; `done_at/done_by` sunucuda yazılır.
  - Faz 2: `link_wishlist_meeting(p_item_id, p_meeting_id)`, `link_wishlist_memory(p_item_id, p_memory_id)`.
- Fonksiyonlarda `REVOKE ALL ... FROM PUBLIC, anon` + `GRANT EXECUTE ... TO authenticated`.

**Sınır tetikleyicisi (BEFORE INSERT):** açık madde sayısı ücretsizde ≥15 ve `NOT has_active_premium(couple)` ise `RAISE EXCEPTION 'WISHLIST_LIMIT' USING ERRCODE = 'P0022'` (P0020/P0021 solo için ayrılı; P0022 boş). Premium'da üst sınır 300. İstemci sabiti `WISHLIST_FREE_LIMIT = 15` ile sunucudaki `wishlist_free_limit()` aynı olmalı (testle eşleştir).
**Solo kapısı:** `trg_solo_write_guard('partner')` listesine `couple_wishlist_items` ekle ([20261107000004:75](../supabase/migrations/20261107000004_solo_guards_and_paired_visibility.sql)).
**Hesap silme:** silenin maddeleri silinir, partnerinkiler kalır → [20261107000003:191](../supabase/migrations/20261107000003_account_deletion_partner_stays.sql) listesine `couple_wishlist_items.created_by`.
**Okuma (gözden geçirmeden sonra):** iki sorgu. Açıklar: `.eq('couple_id', coupleId).eq('status','open').order('created_at',{ascending:false}).order('id',{ascending:false}).limit(300)`, anahtar `["wishlist", coupleId, isDemoMode, "open"]`. Yapılanlar: `.select(..., {count:'exact'}).eq('status','done')[.eq('category', c)].order('done_at',{ascending:false}).order('id',{ascending:false}).range(offset, offset+29)`, anahtar `["wishlist", coupleId, isDemoMode, "done", category]`. Yazımdan sonra önek `["wishlist", coupleId]` süren yazım kalmayınca bir kez yenilenir.
**Hata eşlemesi:** `src/lib/serverErrors.ts` içine `WISHLIST_LIMIT` → paywall (`featureSource: "wishlist"`; `PremiumPaywall.types.ts` + `featureCopy` metni ekle).

**1A'da netleşenler (1B bunlara göre yazar)**
- Dosyalar: `20261109000000_couple_wishlist.sql`, `20261109000001_couple_wishlist_account_lifecycle.sql`, test `supabase/tests/couple_wishlist_test.sql`.
- İstemci yalnızca şu sütunları yazabilir: INSERT `couple_id, created_by, title, note, category, location_name, latitude, longitude`; UPDATE aynıları (`couple_id`, `created_by` hariç). `upsert` kullanma; `status`, `done_*`, `created_at`, `meeting_id`, `memory_id` sunucunundur. İstemcideki karşılığı `WISHLIST_INSERT_COLUMNS` / `WISHLIST_UPDATE_COLUMNS` (`wishlistData.ts`); `wishlistColumns.test.ts` migration'daki GRANT listeleriyle karşılaştırır.
- `set_wishlist_want` / `set_wishlist_done` `void` döner. Hatalar: `P0020` tek kalan, `P0022` sınır, `42501` görünmeyen madde. `set_wishlist_done(true)` zaten yapılmış maddeye dokunmaz (`20261109000003`).
- Sınır sayımı, ekleyenin listede gördüğü açık maddelerdir: istemcideki sayaç görünen açık maddeleri saymalı. Yeni eşleşmede taşınan eski maddeler yeni partnerin hakkından yemez.
- "Yaptık"ı geri almak da sınıra tabidir (`P0022`). Aksi halde yapıldı işaretleyip yeni ekleyerek ve geri açarak sınır aşılırdı. Premium'u bitmiş ve sınırın üstünde olan çift yanlışlıkla işaretlediği maddeyi sınırın altına inene kadar geri açamaz.
- `isWishlistLimitError(error)` (`serverErrors.ts`) sınırı tanır. Premium'daki 300 üst sınırı da aynı hatadır: Premium çiftte paywall açma, metni göster.
- `link_wishlist_*` (Faz 2) eşleşmeyi kendisi denetlemeli: solo kapısı bilerek `meeting_id` / `memory_id` sütunlarında çalışmaz.

## 5. Dosya haritası (Faz 1)

| Yeni | Değişen |
|---|---|
| `supabase/migrations/20261109000000_couple_wishlist.sql` | `src/app/(tabs)/_layout.tsx` (`<Tabs.Screen name="wishlist" />`, [satır 326-336](../src/app/(tabs)/_layout.tsx)) |
| `src/app/(tabs)/wishlist.tsx` | `src/app/menu.tsx` (Buluşmalar'ın yanına satır, [satır 377](../src/app/menu.tsx)) |
| `src/components/wishlist/*` (QuickAddBar, Collapse, WishlistItemCard, BothWantSection, CategoryChips + CategoryFilter, PickButton, PickerSheet, WishlistItemSheet, WishlistDetailSheet, ideas) | `src/lib/screenQueries.ts` (`fetchWishlist`, anahtar) |
| `src/lib/wishlist.ts` (+ `__tests__/wishlist.test.ts`) | `src/lib/serverErrors.ts`, `PremiumPaywall.types.ts` |
| `src/lib/wishlistIdeas.ts` | `src/constants/demoData.ts`, `src/locales/tr.json` + `en.json` (`wishlist` alanı) |
| | `src/lib/notificationRoutes.ts` (Faz 2'de push için), `TabBarCustomizer.tsx` (isteğe bağlı sekme) |
| | `docs/OZELLIKLER.md` (§4, §5, §6) |

`src/lib/wishlist.ts` saf mantık (jest, `src/lib/__tests__` kalıbı): limit hesabı, "ikisi de istiyor" ayrımı, sıralama, rastgele seçim (tohumlanabilir), kategori doğrulama.

## 6. Aşamalar, model ve efor

Efor tahminleri yaklaşıktır (tek oturum, doğrulama dahil). Model önerisi: güvenlik gerektiren SQL ve görsel kalitesi belirleyici ekran en güçlü modelle; mekanik işler daha hafifiyle.

| Aşama | İçerik | Model | Efor | Not |
|---|---|---|---|---|
| **1A Sunucu** | Migration, RLS, RPC, limit tetikleyicisi, solo ve silme entegrasyonu; canlıya uygulamadan önce kuru çalıştırma ve politika testi (başka kullanıcı okuyamıyor, partner başkasının maddesini düzenleyemiyor, limit çalışıyor) | Opus 5.5 | orta (≈ yarım gün) | Güvenlik kritik; RLS hatası veri sızıntısı. Sonunda ayrı `code-review` geçişi |
| **1B Ekran ve tasarım** | `wishlist.tsx` + bileşenler, tüm durumlar, 6 tema doğrulaması, 🎲, hızlı ekleme, hazır fikir çipleri | Opus 5.5 | büyük (≈ 1 gün) | Görsel kalite ve tema uyumu burada; ekran görüntüsüyle doğrula. 1A'nın sözleşmesine (bölüm 4) göre mock veriyle başlayabilir |
| **1C Yan işler** | TR/EN çeviri (~60 anahtar), demo verisi, `wishlist.ts` testleri, menü/`_layout`/tur kaydı, `OZELLIKLER.md`, paywall metni | Sonnet 5.5 | küçük-orta (≈ 2-3 saat) | 1B ile aynı çeviri anahtarlarını kullanmalı: 1B bitince ya da anahtar listesi 1B'den alınarak |
| **2 Bağlantılar** | Buluşmaya çevir ([meetings.tsx:71-82](../src/app/(tabs)/meetings.tsx) route parametresi + kayıttan sonra `link_wishlist_meeting`), anıya çevir ([add-memory.tsx:51-53](../src/app/(tabs)/add-memory.tsx) parametreleri hazır), partner push'u (`send-push` + `push_dedupe`, 30 dk'da 1), "Yaptık mı?" önerisi | Opus 5.5 | orta-büyük (≈ 1 gün) | `send-push` canlı Edge Function: dağıtım ve geri alma planı yaz |
| **3 Cila** | Harita "Gidilecekler" katmanı (Aşk Rotası'na girmez), Wrapped satırı, tur içeriği | Sonnet 5.5 | orta (≈ yarım gün) | Harita dosyaları büyük; önce `useMapData.ts` ve `MapFilterChips.tsx` oku |

**Sıra:** 1A → (1B ∥ 1C başlangıcı) → 1B → 1C → birleşik gözden geçirme → 2 → 3.
Her aşamanın sonunda: `npx tsc --noEmit`, `npm test`, ve bu belgeye durum notu.

## 7. Riskler ve dikkat

- **RLS** en kolay yanlış yapılacak yer: `paired_at` kuralı atlanırsa eski partner/yeni partner verisi sızar. Politikaları iki test hesabıyla dene.
- **Bildirim spamı:** madde başına push yok; çift başına 30 dakikada en fazla 1, metin genel ("listene yeni bir fikir ekledi"), başlık kilit ekranında görünmez.
- **Premium sınırı:** yalnızca sunucuda zorlanır; istemci önceden kontrol eder ama güvenmez.
- **Eşzamanlılık:** iki kişi aynı anda "yaptık" derse sonuncu kazanır; sorun yok, `updated_at` tut.
- **Yeni build şart:** eski sürümlerde ekran yok, sunucu uyumlu kalır (yeni tablo, eski istemciyi bozmaz).
- **Doküman:** özellik girince `docs/OZELLIKLER.md` §4 (yeni alt başlık), §5 (buluşma/anı bağları), §6 (limit satırı) güncellenir.
