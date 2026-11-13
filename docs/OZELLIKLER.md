# CoupleSky: Özellik Envanteri

Son güncelleme: 2026-11-11 · Taslak v1 (kod, yerelleştirme dosyaları, migration'lar ve bilgi grafından çıkarıldı)

İşaretler: ✅ kodda okunup doğrulandı · 🔎 kontrol edilmeli (dosya adı verilmiştir) · ⚠️ bilinen sorun/sınır

## 0. Bu belge nasıl kullanılır (Claude, Antigravity ve geliştirici için)

Yeni özellik, iyileştirme ya da "ne ekleyelim?" sorusunda **önce bu belgeyi oku**, sonra gerekirse bilgi grafına (`CLAUDE.md`), en son dosyaya bak.
Amaç: olan özelliği yeni diye önermemek, olanı yanlış bilmemek, önerilere gerçek bağlam katmak.

**İyi bir öneri şunları içerir:**
1. **Zaten olan ne?** (bu belgeden, dosya yoluyla) Önerdiğin şey bunun yerine geçiyor mu, tamamlıyor mu?
2. **Hangi mevcut parçayla gerçekten bağlanır?** Bağ yalnızca ortak bir veri, an ya da duygu varsa kurulur. Kullanıcının göreceği somut bir değer yoksa bağlama.
3. **Kullanıcıya değeri** (çift için ne değişir) ve **maliyet/risk** (migration, premium kapısı, bildirim, gizlilik).
4. **Kanıt:** dayandığın dosya/RPC/tablo adı. "Muhtemelen yok" deme, `grep` ile doğrula; doğrulayamadıysan 🔎 olarak belirt.

**Yapma:** bağ kurmak için bağ kurma, kalıp öneri (sadece "bildirim ekleyelim", "rozet ekleyelim") verme, mevcut özelliğin adını değiştirip yeni diye sunma, bu belgenin §8'deki tohum fikirleri kopyalayıp geç (onlar örnek; kendi akıl yürütmeni yap).
**Yap:** çiftin gerçek hayatından (buluşma, uzaklık, yıldönümü, tartışma sonrası barışma, hastalık, sürpriz) düşün ve elimizdeki veriyle bunu destekleyen en küçük değişikliği bul.

---

## 1. Uygulama bir bakışta

CoupleSky: çiftler için anı defteri, zaman kilitli mektuplar, takvim, harita ve ortak yıldız gökyüzü. Türkçe ve İngilizce.
Teknik: Expo SDK 57 · React Native 0.86 · Supabase (Postgres, RLS, RPC, Edge Function) · RevenueCat · AdMob · Skia (gökyüzü).
Ölçek: ~516 kod dosyası, 36 tablo, 200+ RPC, 8 Edge Function, Android/iOS widget.

## 2. Temel kavramlar (her özellik bunlara dayanır)

| Kavram | Anlamı | Dosya/kanıt |
|---|---|---|
| **Çift (couple)** | Tüm veri çifte aittir; çifti eşleşme kodu kurar | `generate_pairing_code`, `join_couple_by_code_uuid` ✅ |
| **Premium çift bazındadır** | Biri abone olunca iki kişi de faydalanır | `couples.is_premium`, `gentleCare.ts` ✅ |
| **Solo kullanıcı** | Partneri hesabını silmiş kalan kişi; kayıtları durur, kısıtlı yazar | `soloGate.ts`, `trg_solo_write_guard` ✅ |
| **Demo modu** | Kayıt olmadan gezinti, sahte veri; yazma işlemlerinde kayıt olmaya yönlendirir | `constants/demoData.ts`, `DemoActionModal` ✅ |
| **Token** | Ücretsiz kullanıcının mektup yazma parası (reklamla kazanılır, referansla verilir) | `earn_tokens`, `spend_tokens`, `letters.tsx` ✅ |
| **Aktivite puanı** | Uygulamadaki her eylem puan kazandırır; puan yıldızın ışığını besler | `activity_point_rules` ✅ (bkz. §4.14) |
| **Yıldız (star)** | Çiftin gökyüzündeki tescilli yıldızı; konumu değişmez | `couple_stars`, `claim_*` ✅ |
| **Anı gezegeni (exoplanet)** | Yıldızın etrafında dönen, fotoğraf/mektup/anı taşıyan gezegen | `star_exoplanets`, `create_exoplanet` ✅ |

## 3. Navigasyon

- **Alt sekmeler** (kullanıcı sırasını/gizlemeyi `TabBarCustomizer` ile değiştirebiliyor ✅): Ana Sayfa, Takvim, Mektuplar, Galeri, Harita, İlaçlar, Günlük, Buluşma, Özel Gün, Döngü ve **Yapacaklar** (ortak liste; varsayılan kapalı, `TabBarContext.tsx`). 🔎 Hangi sekmelerin varsayılan açık olduğu: `src/app/(tabs)/_layout.tsx`.
- **Menü** (`menu.tsx`, üç bölüm ✅): *Aşk & Ortak Anılar* (Bizim Yıldızımız, Ana Sayfa özeti, Galeri, Fotoğraf Yükle, Günlüğüm, Mektuplar, Özel Günler & Yıldönümleri, Aşk Takvimi, Harita, Buluşmalar, Yapacaklarımız), *Sağlık & Takip* (İlaç, Regl), *Hesap & Ayarlar*.
- Diğer ekranlar: `(auth)` 8 ekran, `(setup)` (tarihler, eşleşme), `our-star`, `premium`, `paywall`, `profile`, `memories`, `period-tracker`, `add-memory/add-photo/add-daily-note`.

---

## 4. Özellik envanteri

### 4.1 Giriş, hesap ve eşleşme
- E-posta girişi, OTP doğrulama, şifre sıfırlama (OTP ile), kullanıcı adıyla e-posta bulma, profil tamamlama ✅ (`(auth)/*`, `otp_codes`, `request_password_reset_otp`).
- Apple ile giriş + token iptali (anahtar bekliyor ⚠️) ✅ `apple-link`.
- Cihaz doğrulama ekranı (`verify-device`); yalnızca istemci kapısı, sunucuda zorlanmıyor ⚠️.
- Giriş hız sınırı/kilit (`auth-gateway`, `auth_rate_limits`, `login_attempts`) ✅.
- Eşleşme: kod üret/gir, eşleşme kutlaması (`PairingCelebrationModal`), ilişki tarihlerini girme ve değiştirme (cooldown'lı: `change_relationship_dates`, `check_couples_dates_cooldown_integrity`) ✅.
- Davet bağlantısı / Play Install Referrer ile kod önceden dolar ✅ (`referral.ts`).

### 4.2 Ana sayfa (`home.tsx`)
Bileşenler ✅: aşk sayacı + yıldönümü altın ışıltısı (`AnniversaryGlow`), çift avatar halkası, Aşk Ölçer (`LoveMeter`, skor 15–100), ruh hali seçici, günlük not kartı, buluşma geri sayımı/kutlaması, bekleyen mektup kartı, yıldız kış uykusu uyarı kartı, dinamik selamlama (`specialDays.ts`: 14 Şubat, yıldönümü), günün sözü (`quotes.ts`), ilk kurulum spotlight turu.
Kurallar: kart giriş animasyonu ekran başına tek seferlik (`revealGate.ts`); mektup kuşu uçacaksa ana sayfa animasyon oynatmaz ✅.

### 4.3 Ruh hali
10 durum ✅: Çok Mutlu, Mutlu, Normal, Üzgün, Kızgın, Yorgun, Aşık, Sevgi Dolu, Huzurlu, Heyecanlı. Gün içi değişiklik puana sayılmaz (günde 1 puan). Partnerin ruh hali widget'ta görünür (`widget.moodTitle`) ✅. Wrapped ruh hali istatistiği üretir ✅.

### 4.4 Mektuplar (`letters.tsx`)
- Zaman kilitli: açılış günü 00:00 **Türkiye saati**; sunucu ve istemci aynı kuralı kullanır (`letter_unlock_at`, `app_today`) ✅.
- Mum mührü ilk açılışta kırılır, kırık mühür hafızası cihazda (`letterSeals.ts`); origami kuş animasyonu mektup gelince (`IncomingLetterBird`, `LetterArrivalHost`); kilitli mektup kum saati rozeti ✅.
- Yazma maliyeti: **Premium değilse 100 token** (atomik düşer), Premium'da sınırsız ✅. Reklam izleyerek token kazanma kartı (`LetterAdCard`, `WatchAdModal`); günde 25 sınırı ve istemci beyanı ⚠️.
- Gizleme: gönderilen mektup açılışa kadar silinemez, iki taraf kendi listesinden gizleyebilir; açılıştan 72 saat sonra gönderen silme isteyebilir, alıcı onaylamadan silinmez; reddedilirse 72 saat sonra yeniden istenebilir ✅ (`letterPolicy.ts`, `request_letter_deletion`, `respond_letter_deletion`).
- Mektup içerik şifreli (AES-256) ✅. Alıcı, açılmamış mektubu API ile doğrudan okuyabilir ⚠️ (öncelikli açık iş, bkz. §7).
- Mektup, anı gezegenine eklenebilir (`append_letter_to_exoplanet`) ✅. Mektup göndermek 2 puan ✅.

### 4.5 Galeri ve fotoğraf (`photos.tsx`, `add-photo.tsx`)
Izgara düzenleri (tekli/2'li/3'lü hücre), lightbox, fotoğraf kilit kartı, `photo_archive` (tam boy + küçük resim) ✅. **Yükleme tamamen Premium'dur**: ücretsiz kullanıcı yüklemeye çalışınca doğrudan paywall açılır (`add-photo.tsx:172,258`) ✅. Galeri sekmesi ücretsizde yalnızca hâlihazırda var olan fotoğraflar varsa tam görünür (`photos.tsx:206`). Silme yalnızca yükleyene, Premium gerekmez ✅. Silinen fotoğraf depodan silme kuyruğuyla temizlenir (`storage_purge_queue`) ✅. Fotoğraf başına 1 puan (günde) ✅.

### 4.6 Anılar (`memories.tsx`, `add-memory.tsx`)
Anı ipliği (`MemoryThread`), washi bant dekoru, yıldönümü dönüm noktası modalı (`AnniversaryMilestoneModal`), varsayılan anılar (`defaultMemories.ts`) ✅. Anı düzenleme Premium'a bağlı (`enforce_memory_premium_edits`) ✅. Anı kaydı 1 puan.

### 4.7 Günlük (`daily-notes.tsx`)
Menü metnine göre "sana özel şifreli not defterin"; kilit kapanış animasyonu (`JournalLockSuccessOverlay`); ana sayfada günlük not kartı ✅. 🔎 Gizliliğin partnere karşı nasıl sağlandığı: şifreleme anahtarı çifte özgü (`couple_encryption_key`), erişim RLS ile mi kısıtlanıyor kontrol et. Günlük sayfası 1 puan.

### 4.8 Takvim (`calendar.tsx`)
Ay görünümü, gün kartları, notlar (`CalendarNoteModal`), fotoğraflar. **Geçmiş günlerin fotoğrafları Premium**; regl günleri kadınlarda her zaman, erkeklerde Premium ile görünür (`canSeePeriod = isFemale || isPremium`) ✅. Takvim notu 1 puan.

### 4.9 Harita (`map.tsx`, `map.web.tsx`)
Fotoğraflı anı pinleri (fotoğraf pini Premium; premium değilse yalnızca hâlihazırda varsa gösterilir ✅), mühürlü aşk notları (haritaya not, 1 puan), "Aşk Yolculuğu" durak çizgisi (`LoveJourney`); duraklar **fotoğraf, not ve buluşma** pinlerinden zaman sırasıyla kurulur (`journeyStops.ts`) ✅, tema seçici, filtre çipleri, hikâye modalı, yol tarifi (`openDirections.ts`) ✅. Nominatim konum arama, kullanıcı artınca ücretli geocoding gerekebilir ⚠️.

### 4.10 Buluşmalar (`meetings.tsx`)
Plan (başlık, zaman, konum), geri sayım, gerçekleşince 24 saat kutlama kartı (`activeMeeting.ts`, cihazda görüldü hafızası), güncellenince partnere push, **yalnızca planlayan düzenleyebilir**, geçmişe plan yapılamaz ✅. Gerçekleşen buluşma çifte **4 puan** (en yüksek) ✅ (`award_completed_meetings`).

### 4.10b Yapacaklarımız: ortak liste (`wishlist.tsx`, `src/components/wishlist`, `wishlist.ts`)
Çiftin birlikte yapmak istediklerini biriktirdiği ortak liste. Madde: başlık (≤80), not (≤300), kategori (Yer, Film & Dizi, Yemek, Deneyim, Seyahat, Diğer; renk değil ikonla ayrılır), isteğe bağlı konum. Hızlı ekleme çubuğu dinlenirken tek satırdır (yazı kutusu + sayaç + gönder); kategori çipleri ve **"Ayrıntı ekle"** yalnızca kutu odaktayken ya da içinde yazı varken yumuşakça açılır (`Collapse`), sınır uyarısı kapalıyken de görünür ✅. "Ayrıntı ekle" çubuktaki başlık ve kategoriyle ekleme penceresini açar, not ve konum (elle ya da haritadan) eklerken girilir; iptalde çubuk korunur, eklenince sıfırlanır. Ekleme ve düzenleme aynı penceredir (`WishlistItemSheet`, `mode: create | edit`) ✅. Boş listede 10 hazır fikir çipi (`wishlistIdeas.ts`, TR/EN), kategori filtresi (ekranın tek kalıcı çip sırası; ikonsuz, küçük, vurgu rengi yok; çubuğun hemen altında, etkilediği her şeyin üstünde: `CategoryFilter`), yaptıklarımız katlanır bölümü ("Yaptık ✓ · tarih", 30'ar sayfalı) ✅. Kategori filtresi her şeye uygulanır: "İkimiz de", 🎲, açıklar ve "Yaptıklarımız (n)" (`buildWishlistView`) ✅. Açık maddeler ve yapılanlar ayrı okunur (açıklar ≤300, yapılanlar kategoriye göre sayfalı ve toplam sayılı; `wishlistData.ts`) ✅.
- **Madde kartı** tek sıralıdır: solda "yaptık" dairesi, ortada başlık ve tek satır ikincil bilgi (ekleyenin avatarı, kategori ikonu, not ya da yoksa kategori adı, konum), sağda 💗 (partner istediyse kalbin köşesinde küçük avatarı). Üç nokta yok: karta dokunmak **ayrıntı penceresini** açar (`WishlistDetailSheet`: kategori, tam başlık ve not, konum, kim ekledi ve ne zaman, kim istiyor ya da yapılma tarihi); ekleyen için "Düzenle" ve "Sil" bu pencerede (partnerin maddesinde yalnızca ayrıntı). Ekran okuyucuda ekleyenin kartında "Düzenle" ve "Sil" ayrı eylemdir. Yapılanlar da aynı kartı kullanır ✅ (`WishlistItemCard`).
- **"İkimiz de istiyoruz":** her madde 💗 alır; ikisi de verdiyse madde ayrı, vurgulu bölümde toplanır ve açık listede tekrar etmez. Ekranın tek vurgulu alanı budur (vurgu rengi, iki avatar). Tek kalan kullanıcıda hiçbir madde "ikimiz de" sayılmaz (`isBothWant`) ✅.
- **🎲 "Bana bir tane seç":** "Açık fikirler (n)" başlığının sağında küçük düğme (`PickButton`; o bölüm yoksa "İkimiz de" başlığında); seçilecek madde yoksa gizli. Önce ikisinin de istediklerinden, hiç yoksa tüm açık maddelerden rastgele seçer; kategori filtresi seçiliyken seçim de o kategoriden yapılır; "Başka bir tane" aynı maddeyi yeniden vermez (`pickWishlistItem`, tohumlanabilir) ✅.
- **Yetki:** ekleyen düzenler ve siler; iki kişi de 💗 verir ve "yaptık" işaretler. Eşleşme şart (tek kalan yazamaz, kendi maddesini silebilir) ✅.
- **Sınır:** ücretsizde **15 açık madde** (yapılanlar sayılmaz); Premium'da 300 teknik üst sınır. "Yaptık"ı geri almak da sınıra bağlıdır. Sınırda ücretsiz çift paywall'a (`featureSource: "wishlist"`), Premium çift metne gider. Sayaç sınırı aşmaz ("15/15"). Premium biterse hiçbir şey silinmez, yalnızca yeni ekleme kilitlenir ✅. Hatalar türüne göre ayrı metinle gösterilir (sınır, eşleşme, yetki, geçersiz alan, ağ, zaman aşımı; `wishlistErrors.ts`) ✅.
- **Puan yok** (`activity_point_rules`'a dokunulmaz). Sunucu: `couple_wishlist_items`, `couple_wishlist_wants`, RPC `set_wishlist_want`/`set_wishlist_done`, tetikleyici `P0022`; migration `20261109000000`, `...01` (hesap silme: silenin maddeleri silinir, partnerinkiler kalır), `...02` (sınır tetikleyicisinde kimlik kontrolü: başka çiftin doluluğu/Premium'u sızmaz), `...03` ("yaptık" zaten yapılmış maddeye dokunmaz) ✅ yazıldı ve geçici Postgres'te sınandı.
- ✅ **Sunucu canlıda, özellik açık (2026-11-13).** Migration `20261109000000`-`03` canlıya uygulandı (önce ROLLBACK'li kuru çalıştırma; iki kullanıcılı ekle/gör/iste/yaptık/yetki senaryosu canlıda ROLLBACK'li geçti). Tek bayrak `WISHLIST_SERVER_READY = true` (`src/lib/wishlistAvailability.ts`): menü satırı, sekme seçeneği, rehber kaydı, bildirim rotası ve veri katmanı buna bağlı. `wishlistMock.ts` yalnızca testlerde kullanılıyor. 🔎 İstemci gerçek sunucuya karşı cihazda denenmedi (geliştirme yapısı mock veriyle çalışıyordu).
- Henüz yok (Faz 2): buluşmaya/anıya çevirme, partnere push, "Yaptık mı?" önerisi. Haritada katman ve Wrapped satırı Faz 3. Planın tamamı: `docs/ORTAK_LISTE_PLANI.md`.

### 4.11 İlaç (`medicine.tsx`)
Hatırlatıcılar (`reminderSync.ts`), doz kaydı (`log_medicine_dose`), seri kartı, iyileşen filiz animasyonu (`HealingSprout`), geçmiş listesi, yönetim modalı, "Benim / Sevgilimin" sekmeleri (partnerinki de görülür) ✅. Alan kişiye günde 1 puan.

### 4.12 Regl takibi ve Nazik Bakım (`period-tracker.tsx`, `GentleCareMode`)
Döngü takibi (`periodCycle.ts`, `toggle_period_log`), regl hatırlatıcıları, ayda 2 puan (çift bazlı). **Nazik Bakım:** kadın, hissini tek dokunuşla partnere iletir; paylaşımlar arası bekleme süresi var; **partner Premium değilse döngüyü göremez ve bildirimde/paywall'da "regl/döngü/hassas gün" asla geçmez** (gizemli, romantik ilgi çağrısı) ✅ (`gentleCare.ts`). Erkek için regl görünümü Premium ✅.

### 4.13 Özel günler ve yıldönümleri
Yıldönümüne kala altın ışıltı, 14 Şubat selamı, "Birlikte N. gün" (100'ün katları, `milestoneDays.ts`), gün sayacı ana sayfa ve widget'ta aynı kuralla (başlangıç günü 0) ✅. Dönüm noktası paylaşım kartı (`MilestoneStoryCard`) ✅. Menüdeki "Özel Günler & Yıldönümleri" öğesi ayrı bir ekran değil, `memories` ekranına gider (`menu.tsx`) ✅. 🔎 Kullanıcının kendi özel gününü ekleyebildiği bir yer görmedim; `memories.tsx` içinde kontrol et.

### 4.13b Bizim Gecemiz: gece gökyüzü posteri (`src/modules/sky`)
Menü > Gökyüzümüz ve yıldönümü kutlamasından açılan 4 adımlı akış (tarih, yer, saat, önizleme). Seçilen gece ve yerin **gerçek** gökyüzü (HYG + Stellarium, Gökkubbe konumlarından bağımsız), Ay evresi, doğruluk uyarıları. 9:16 hikâye kartı ücretsiz; özel başlık ve 3:4 baskı dosyası Premium (`night_sky`), demo modunda bu ikisi kayıt isteğine gider. Çiftin yıldızı gerçek HIP koduysa altın halka ve "yıldızımız" cümlesi. Yer sunucumuza gitmez (harita/adres araması işletim sistemi ya da Nominatim'e gider), koordinat saklanmaz (her açılışta yeniden seçilir); saat, başlık ve ilçe/şehir düzeyindeki ya da kullanıcının yazdığı yer adı cihazda tutulur. Demo hiçbir tercihi yazmaz. Posterdeki yer adı 2. adımda düzenlenebilir, boşsa satır çıkmaz. Tema/renk seçimi yok (ertelendi).

### 4.14 Bizim Yıldızımız (`our-star.tsx`, `src/modules/stars`)
En büyük modül; Skia ile çizilir. ✅ olanlar:
- **Gökyüzü:** 24 astronomik sektör (Orion, Büyükayı, Kassiopeia... "Gökyüzü Atlası"), HYG kataloğundan on binlerce yıldız, kayan yıldız takvimi (`meteorSchedule.ts`), makro gökyüzü + mikro "gezegen sistemi" görünümü, evrende yıldız arama (`search_celestial_universe`).
- **Sahiplenme:** rastgele ya da belirli yıldız (`claim_*`), sektörden seçim, ücretsiz alan önerisi (`suggest_available_stars`); katı ≥1° aralık, konum değişmez; sahiplenmek **Premium** (`star_claim`); sertifika + paylaşım kartı (`StarCertificateStoryCard`). Son bilinen durum (proje notu): Faz 0 canlıda, ~2.035 yıldız, tavan ~25–28 bin.
- **Yeniden adlandırma:** Premium (`star_rename`), küfür/moderasyon (`enforce_star_name_moderation`), şikâyet (`star_reports`); yeniden adlandırma şikâyetleri sıfırlar.
- **Kıvılcım (spark):** yıldıza dokununca sevgiliye "titreşim" gönderir, cooldown'lı (`send_star_spark`).
- **Günlük dilek:** günde 1 hak, kaydedilmez; yıldızı biraz parlatır (`make_wish`).
- **Kozmik Bağlar:** başka çiftlerin yıldızlarıyla en fazla 3 aktif bağ, takımyıldızı çizgisi; arkadaş çift koduyla veya gökyüzünden istek; istek kabul/ret; Premium (`star_connect`).
- **Anı gezegenleri:** elle oluştur (2 puan, günlük sınır var) ya da otomatik (`exoplanet_auto`, `create_due_auto_exoplanet`); fotoğraf/mektup eklenebilir; yeni gezegende partnere push; fotoğraf limiti var. Oluşturma/görüntüleme Premium. 🔎 Otomatik gezegenin tetikleyicisi: `process_due_auto_exoplanets`.
- **Işıltı skoru:** aktivite puanlarından hesaplanır, her gece azalır (`apply_activity_decay`, `run_star_brightness_nightly`) ✅.
- **Kış uykusu ve kasa:** Premium biterse yıldız 14 gün kış uykusunda (hiçbir şey silinmez, içi ve ışık bağları kilitli); yenilenmezse koordinat serbest kalır, anı gezegenleri kasada bekler, kasa süresi de dolarsa tam boy fotoğraflar silinir (`premiumStatus.ts`, `star_lapse_releases`) ✅.

**Aktivite puan kuralları** (`activity_point_rules`) ✅: ruh hali 1/gün/kişi · ilaç 1/gün/kişi · takvim notu 1/gün · haritaya not 1/gün · mektup 2/gün (gönderen) · fotoğraf 1/gün · günlük 1/gün · anı 1/gün · ilk profil fotoğrafı 1 (tek sefer) · regl başlangıcı 2/ay/çift · anı gezegeni 2/gün/çift · **gerçekleşen buluşma 4/gün/çift**.

### 4.15 Aşk Skoru (`loveScore.ts`)
15–100 arası, günlük, çift bazlı; döküm (`breakdown`) hesaplanır ama "analiz ve denetim için"; `LoveMeter.tsx` ve `home.tsx` bu dökümü kullanmıyor, yani **arayüzde skorun nedeni gösterilmiyor** ✅.

### 4.16 Couple Wrapped (`CoupleWrappedModal`)
Ay/yıl özeti: baskın ruh hali, en çok gidilen konum, "Biz bu ay N kez birbirimizi seçtik" ifadesi ✅. **Paylaşılabilir**: modal `shareStoryImage` ve `StoryCard` ile hikâye görseli üretip paylaşır ✅ (`CoupleWrappedModal.tsx`).

### 4.17 Premium, token, reklam, davet
- **Premium içeriği** (paywall metni ✅): ortak Premium, sınırsız fotoğraf, erkek regl görünümü, geçmiş gün fotoğrafları, sınırsız mektup, "sevgilinin sana özel paylaştığı hisler", kendi yıldız (ışıltı, kıvılcım, anı gezegenleri). Profil fotoğrafı yüklemede de Premium kaynağı var (`avatar`) 🔎 kapsam: `useAvatarUpload.ts`.
- **Durumlar:** ücretsiz, deneme, aktif, sona eriyor, ödeme sorunu, kış uykusu (grace), süresi doldu, süresiz ✅. Yalnızca `revenuecat-webhook` Premium yazar.
- **Premium kutlaması** (`PremiumCelebrationHost`, konfeti) ✅.
- **Reklam:** AdMob + UMP rıza; mektup token reklamı; iOS ATT/SKAdNetwork eksik ⚠️.
- **Davet (referral):** kod girmek tek başına ödül vermez; davet edilen kişi sevgilisiyle eşleşince **iki çifte de** Premium günü/token verilir (sunucu kuralı), davetle gelen yıldızlar ilişkilendirilir (`link_referral_stars`) ✅.
- **Promosyon kodu:** uygulamadan kaldırıldı, RPC/tablolar duruyor ⚠️.

### 4.18 Bildirimler
Push (`send-push`, `push_tokens`, `push_dedupe`) ve yerel hatırlatıcılar ✅. Sunucu hatırlatıcı RPC'leri: yıldönümü, aktif regl, hareketsizlik, kasa bitişi, hesap silme, hareketsiz hesap temizliği ✅. Diğer: buluşma güncellendi, yeni anı gezegeni, yıldız bağlantı isteği, partner bildirimleri (`partner_notices`), uygulama içi banner, bildirim izni ön hazırlığı (`PermissionPrimingModal`) ✅. Mektup açılış bildirimi: yerel 09:00, mektup 00:00'da açılıyor, sunucu bildirimi kapalı ⚠️.

### 4.19 Widget'lar
Android (Kotlin `CoupleWidgetProvider`, gece yarısı/Premium bitiş/mektup açılışı alarmları) ve iOS: birlikte gün sayısı, okunmamış mektup, partnerin ruh hali ✅. **Gerçek cihazda hiç denenmedi** ⚠️.

### 4.20 Kişiselleştirme
Tema: kadın/erkek × koyu/açık/mevcut (6 palet), dil (TR/EN), ses ve titreşim (8 ses: baloncuk, kamera, kutlama, mühür...), tab çubuğu düzeni, yazı boyutu sınırı, tur ve rehberler (`TourGuidesCard`, `usePageTour`) ✅.

### 4.21 Hesap silme ve solo mod
Silme talebi 7 gün bekler, geri alınabilir; **A siler, B kalır** (B'nin içeriği durur, Premium sürekliliği `premium_owner_id` ile korunur), kademeli silme (iki ayrı talep), 30/60 gün hareketsiz hesap temizliği ✅ (`docs/HESAP_SILME_VE_PREMIUM_TASARIMI.md`). Kalan kişi yeni eşleşebilir, çift birleştirme (`couple_merges`, `merge_premium_into_couple`) ✅. İstemci build'i bekliyor.

### 4.22 Güvenlik ve altyapı
RLS + SECURITY DEFINER RPC'ler, günlük ve mektup AES-256, silme kuyruğu (`storage-purge`), hata raporlama (`client_errors`), yasal sayfalar (TR/EN) ✅.

**Zorunlu güncelleme kapısı** (`src/lib/appVersionGate.ts`, `useAppVersionGate.ts`, `AppVersionGate.tsx`, `ForceUpdateScreen.tsx`; sunucu `app_version_requirements` + RPC `get_app_version_requirement`, migration `20261111000000`): cihazdaki görünen sürüm (iOS CFBundleShortVersionString / Android versionName; isteğe bağlı aynı sürümde build numarası) sunucudaki asgari sürümün KESİN olarak altındaysa uygulamanın yerine kapatılamayan "güncelle" ekranı çizilir. Her belirsizlikte (ağ hatası, zaman aşımı, bozuk yanıt, boş değer, okunamayan sürüm) açık; son başarılı yanıt 30 gün saklanır (çevrimdışıyken kilit sürer). Demo modunda uygulanmaz. Açılışta ve öne gelince sorar (en sık 15 dk, kilitliyken 1 dk). İşletim (yükseltme / geri alma / herkesi kilitlersek): `docs/ZORUNLU_GUNCELLEME.md`. ⚠️ Migration canlıya uygulanmadı; istemci 1.1.0 ile çıkacak. 1.0.0 ikililerine ancak OTA ile ulaşabilir (aynı belgede).

---

## 5. Zaten bağlı olan özellikler (bunları "yeni bağ" diye önermeyin)

| Kaynak → Hedef | Nasıl bağlı |
|---|---|
| 12 farklı eylem → aktivite puanı → yıldız ışıltısı | `activity_point_rules`, tetikleyiciler |
| Premium bitişi → kış uykusu → kasa → fotoğraf silme | `premiumStatus.ts`, `subscription_lifecycle_events` |
| Mektup → anı gezegeni | `append_letter_to_exoplanet` |
| Fotoğraf → anı gezegeni | `append_media_to_exoplanet` |
| Buluşma → 4 puan → yıldız; buluşma → ana sayfa kartı → push | `award_completed_meetings`, `activeMeeting.ts` |
| Ruh hali → widget (partnerin ruh hali), Wrapped | `widgetBridge.ts`, wrapped hesaplayıcı |
| Regl kaydı → Nazik Bakım → partnere gizemli push (Premium'a göre) | `gentleCare.ts` |
| Yıldönümü/100. gün → ana sayfa ışıltısı → widget sayacı → paylaşım kartı | `specialDays.ts`, `milestoneDays.ts` |
| Yıldız sahiplenme → sertifika → hikâye paylaşımı | `StarCertificateStoryCard` |
| Davet → iki çifte Premium/token → davetle gelen yıldız bağı | `referral.ts`, `link_referral_stars` |
| Yıldız kıvılcımı → partnere "titreşim" | `send_star_spark` |
| Premium durumu → ana sayfa uyarıları, paywall bağlamı | `usePremiumDetails`, `PremiumPaywall featureSource` |
| Ortak liste sınırı (15 açık madde) → paywall (`wishlist`); liste → menü, sekme seçeneği, sayfa rehberi, bildirim rota izin listesi (hepsi `wishlistAvailability.ts` bayrağına bağlı, şu an kapalı) | `serverErrors.ts`, `PremiumPaywall.tsx`, `menu.tsx`, `TabBarContext.tsx`, `notificationRoutes.ts`, `featureGuides.ts` |
| Ortak liste → buluşma / anı / push | ⚠️ **bağlı değil** (Faz 2); `meeting_id`/`memory_id` sütunları hazır |

## 6. Ücretsiz / Premium sınırları (kodda okunan)

| Alan | Ücretsiz | Premium |
|---|---|---|
| Mektup yazma | 100 token/mektup (reklamla kazan) | Sınırsız |
| Fotoğraf yükleme | Yok (paywall açılır) | Sınırsız |
| Takvimde geçmiş gün fotoğrafı | Yok | Var |
| Regl görünümü (erkek) | Yok | Var |
| Harita fotoğraf pinleri | Yalnızca var olanlar | Tam |
| Yıldız sahiplenme / bağ / yeniden adlandırma / anı gezegeni | Yok | Var |
| Anı düzenleme | Kısıtlı | Var |
| Ortak liste (açık madde) | 15 (yapılanlar sayılmaz) | 300 teknik üst sınır; biterse silinmez, yalnızca yeni ekleme kilitlenir |
| Partnerin "özel hisleri" (Nazik Bakım) | Göremez | Görür |
| Silme hakkı (fotoğraf) | Var | Var |
| Solo kullanıcı yazma | Eşleşme gerekenler yasak; ruh hali/günlük/takvim/harita/ilaç/regl için Premium | |

## 7. Açık işler ve bilinen sınırlar (özet; ayrıntı: `docs/BILINEN_SINIRLAR_VE_YAYIN_SONRASI_ISLER.md`)
- 🔎 **Ortak liste canlıda ilk kez gerçek sunucuyla çalışacak** (2026-11-13'te migration'lar uygulandı, bayrak açıldı): iki gerçek hesapla cihazda ekleme, "istiyorum", "yaptık" ve 15 madde sınırı denenmeli.
- ⚠️ **Zorunlu güncelleme kapısı sunucusu canlıda değil** (migration `20261111000000` yazıldı, geçici PG 12'de sınandı; canlıya uygulanmadı). Uygulanmadan önce istemcideki kapı açık kalır (RPC yok → hata → açık).
- ⚠️ Mektup kilidi yalnızca istemcide; alıcı API ile erken okuyabilir (yayın sonrası, yeni build + sunucu politikası).
- ⚠️ "Tekrar gönder" geri sayımı arka planda duruyor (`verify-device.tsx:52-57`, `verify.tsx:213`).
- ⚠️ Widget'lar gerçek cihazda test edilmedi; silme/Premium akışı cihazda test bekliyor.
- ⚠️ Ödüllü reklam SSV yok. (2026-11-13: iOS SKAdNetwork kimlikleri eklendi, mektup açılış bildirimi açılış anına çekildi; ikisi de sonraki build ile çıkar.)
- ⚠️ Mektup zaman kilidi: okumalar `my_letters` görünümünde (kilitli mektupta başlık/içerik sunucuda boş), ama tablo politikası henüz sıkılaştırılmadı; 2. adım `docs/BILINEN_SINIRLAR_VE_YAYIN_SONRASI_ISLER.md` bölüm 1.
- ⚠️ Apple token iptali anahtarı bekliyor; cihaz doğrulama sunucuda zorlanmıyor.
- ⚠️ Promosyon kodu kalıntısı; `report-alert` repoda var ama kurulu değil; GitHub deposu gizliliği; Maps anahtarı taşıması.

## 8. Fikir tohumları (kopyalama: örnek olarak akıl yürütmeyi göstermek içindir)

Her biri mevcut veriye dayanır; **önerilmeden önce 🔎 olanlar doğrulanmalı**, çiftin gerçek hayatına karşılık gelir.

1. **"100. günde aç" kısayolu (mektup × dönüm noktası).** Elimizde: zaman kilitli mektup, `milestoneDays.ts` (sıradaki 100'ün katı hesabı), yıldönümü hesabı. Mektup yazarken tarih seçici yerine "sonraki 100. günümüzde / yıldönümümüzde aç" seçeneği. Neden: çoğu kullanıcı için en anlamlı kilit tarihleri bunlar; yeni veri gerekmez, yalnızca iki hazır parça birleşir. Kontrol: `DateTimePickerSheet` kullanımı `letters.tsx`.
2. **Skorun "neden"ini göstermek (Aşk Ölçer).** Elimizde: `breakdown` zaten hesaplanıyor ama arayüzde kullanılmıyor (doğrulandı), puan kuralları sabit. Bugün hangi eylemlerin puan verdiği ve hangisinin kaldığını küçük bir özetle göstermek, kullanıcıyı hangi sekmeye gideceğini söylemeden yönlendirir.
3. **Ortak seri ("ikimiz de bugün").** Elimizde: `couple_daily_activity`, ilaç seri kartı (bireysel seri mantığı). İki kişinin aynı gün eylem yaptığı günlerin serisi; uzak mesafe çiftleri için "bugün de aklımızdayız" değeri. Kontrol: `couple_daily_activity` kişi bazlı mı çift bazlı mı tutuluyor.
4. **Açılan mektuptan anı gezegeni önerisi.** Elimizde: `append_letter_to_exoplanet`, otomatik gezegen üretimi. Mektup açılışı doğal bir "an"; gezegene ekleme tek dokunuş olabilir. Kontrol: otomatik gezegen tetikleyicisi neye bakıyor (`process_due_auto_exoplanets`).

*Bu liste bilerek kısa ve kontrollüdür. Daha iyi fikir bulursan, §2–§6 ile gerekçelendirip ekle.*

## 9. Bu belge nasıl güncel tutulur

- Özellik eklendiğinde/değiştiğinde ilgili §4 maddesini ve §5, §6 tablolarını güncelle; yeni açık iş çıkarsa §7'ye ekle.
- 🔎 maddeleri doğrulandıkça ✅'ye çevir ve kanıt dosyasını yaz.
- Taslak ilk sürümde `src/app`, `src/lib`, `src/components`, `supabase/migrations` ve `src/locales/tr.json` üzerinden çıkarıldı; her satır kodla doğrulanmadı, 🔎 olanlar bilerek bırakıldı.
