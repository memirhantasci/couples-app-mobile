# Bilinen sınırlar ve yayın sonrası işler

Son güncelleme: 2026-11-11

## ⏳ UYGULANMAYI BEKLEYEN ADIMLAR (unutma)

Kodu ve provası hazır, ama bilerek canlıya uygulanmadı. Sırası geldiğinde yapılacak.

| # | Ne | Ne zaman | Nasıl |
| :-- | :-- | :-- | :-- |
| 1 | **Mektup zaman kilidi, 2. adım:** `letters_select` politikasını yalnızca gönderene indir. Bu yapılmadan alıcı kilitli mektubu tablodan doğrudan okuyabilir. | `my_letters` görünümünü kullanan sürüm (commit `534a310` ve sonrası; iOS build 20 / Android build 12 **değil**) mağazalarda yayıldıktan ve eski sürümler zorunlu güncellemeyle kapatıldıktan sonra. Erken uygulanırsa eski sürümlerde gelen mektuplar kaybolur. | SQL ve prova: bölüm 1'deki "Güncelleme 2026-11-13" kutusu. Önce `app_version_requirements.min_version` (bkz. `docs/ZORUNLU_GUNCELLEME.md`), sonra politika. |
| 2 | **Yeni build:** 2026-11-13'te build 20 / 12'den sonra yapılan düzeltmeler mağazada yok (tekrar gönder sayacı, eski şifre sıfırlama bağlantısı, gece gökyüzü saat düzeltmesi, mektup okumalarının görünüme taşınması, mektup bildirimi saati, SKAdNetwork). | Apple incelemesi bittikten sonra. SKAdNetwork yerel ayar: OTA ile gitmez, iOS build ister. | `eas build --profile production`; sürüm numarasını yükselt. |
| 3 | **Eski HTML varlıklı verinin temizliği** (`Ali&#x27;s`). | Yeni sürüm yayıldıktan sonra (eski sürümler kodlamaya devam ediyor). | Bölüm 0, "Yayından sonra" altındaki madde. |
| 4 | **Ödüllü reklam sunucu doğrulaması (SSV):** sunucu tarafı canlıda (fonksiyon deploy edildi, migration `20261113000002` uygulandı), henüz ödül yazmıyor. | Sırada: AdMob panelinde geri çağrı URL'si (elle), sonra istemci değişikliği. | Sıra: `supabase/functions/admob-ssv/README.md`. Migration ve deploy → panelde geri çağrı URL'si → istemci değişikliği → eski sürümler kapanınca `earn_tokens` yetkisini al. |

## 0. Eski denetim raporlarından kalan açık işler (2026-11-07 kontrolü)

`DENETIM_GECE_TARAMASI.md` ve `KAPSAMLI_SATIS_ONCESI_DENETIM_RAPORU.md` (30 Ekim) ile `WEB_SITESI_YASAL_METIN_GUNCELLEMELERI.md`
maddeleri güncel kod ve canlı veritabanıyla tek tek karşılaştırıldı; biten her şey için dosya silindi (git geçmişinde duruyor).
Bitmeyenler:

### Yayından önce
- **Sign in with Apple token iptali (2-5): KOD HAZIR, anahtar bekliyor.** `apple-link` Edge Function + `apple_auth_tokens` tablosu +
  `process-account-deletions` içindeki iptal adımı canlıda; istemci girişte authorizationCode'u gönderiyor (yeni build ister).
  Apple anahtarı tanımlanana kadar iptal adımı atlanır. Yapılacak: Apple Developer > Keys > "Sign in with Apple" anahtarı oluştur
  (App ID `app.couplesky.mobile`), sonra `supabase secrets set APPLE_TEAM_ID=VN8ZPYP3B7 APPLE_KEY_ID=<KeyID> APPLE_PRIVATE_KEY="$(cat AuthKey_XXXX.p8)"`.
  Test: Apple ile giriş yap, `apple_auth_tokens`'ta satır oluştuğunu gör, hesabı sil, Apple Kimliği ayarlarında uygulamanın kalktığını doğrula.
- **Depo gizliliği:** GitHub deposu `memirhantasci/couples-app-mobile` herkese açıksa private yap; geçmişte `.env` ve
  `google-services.json` var. (Google Cloud Maps ve Firebase Android anahtarları 2026-11-08'de paket adı + SHA-1 ile kısıtlandı; Play imza SHA-1'i Firebase'e eklendi.)
- **Supabase panel (kod dışı, durumu doğrulanamadı):** minimum şifre 8, Site URL ve `couplesapp://` yönlendirmeleri, özel SMTP +
  OTP şablonunda `{{ .Token }}`, günlük yedek (Pro plan), sızdırılmış şifre koruması.
- **E-posta (kod dışı):** destek@ ve support@couplesky.app kutuları; alan adına SPF, DKIM, DMARC (OTP ve destek postası spama düşmesin).
- **Android bildirim kimlik bilgisi:** yeni paket adı için Firebase uygulaması + FCM anahtarı EAS'e tanımlı mı teyit et
  (Android push'u buna bağlı).
- **Gerçek cihaz testi:** Kotlin ve iOS widget'ları hiç denenmedi; UMP rıza formu, satın alma sandbox'ı, push (ön plan/arka plan/kapalı),
  silme talebi → vazgeçme → silinme akışı, eşleşme kodu deneme sınırı, ilaç hatırlatıcıları, Android 15 16 KB sayfa uyumu.
- **Hesap silme / Premium tasarımı** (`docs/HESAP_SILME_VE_PREMIUM_TASARIMI.md`): gerçek cihazda test; "kademeli silmede Premium"
  yorumu (açık nokta 1) için ürün sahibi onayı.

### Yayından sonra (2-4 hafta)
- **Eski HTML varlıklı metinler (`Ali&#x27;s`, `Kahve &amp; Kitap`), 2026-11-11:** eski sürümlerdeki `sanitizeStrict`
  buluşma başlığı/yeri, anı/fotoğraf/mektup başlığı, ilaç adı ve görünen ismi HTML varlığıyla yazıyordu. Yeni istemci
  kaçışsız yazıyor ve okurken çözüyor (`src/lib/legacyEntityFetch.ts`), ama mağazadaki eski sürümler kodlamaya devam eder.
  Açık kalanlar: (1) ~~sunucu push'ları~~ **yapıldı (2026-11-13, send-push v26 canlıda: ad, ilaç adı, mektup ve buluşma başlığı göndermeden önce çözülüyor; gerçek bildirimle cihazda doğrulanmadı)**. Eski not: `send-push` adı/başlığı DB'den okuyup olduğu gibi gönderiyor, telefonun
  bildirim çubuğunda varlıklı görünür (uygulama içi kart çözülüyor). Çözüm: send-push'ta göndermeden önce aynı beş
  varlığı (`&amp; &lt; &gt; &quot; &#x27;`) çöz + deploy. (2) **Canlı veri temizliği**: sayım ve UPDATE taslağı hazırlandı
  (repoda değil; tek transaction, yalnızca düz metin sütunları, şifreli sütun etkilenmedi). Yeni sürüm yayıldıktan sonra bir
  kez çalıştır, birkaç hafta sonra sayımla tekrar bak. (3) Sunucu tarafı ad kullanımları (yıldız sahibi baş harfi
  `owner_initials`, `contains_blocked_word`, arama normalizasyonu) kodlanmış adla çalışıyor; temizlik bunları da düzeltir.
- ~~Tekrar gönder geri sayımı arka planda duruyor~~ **düzeltildi (2026-11-13, yeni build/OTA ister):** `verify-device.tsx` sayacı artık bitiş anına (saat) bağlı; kalan süre her saniye ve uygulama öne gelince `remainingCooldownSeconds` (`src/lib/otp.ts`, testli) ile hesaplanır. Cihazda doğrulanmadı.
- **Maps anahtarını couplesapp94 hesabına taşı:** Maps Production Key şu an emirhanekin52 hesabındaki `project-a4ab81ef…` projesinde (fatura hesabı orada). Anahtar projeler arası taşınmaz: couplesky-c50c5'e fatura hesabı bağla, yeni anahtar oluştur (aynı paket+SHA-1 kısıtı), `app.json` anahtarını değiştir, yeni Android build al, eskiyi sil.
- **Ödüllü reklam SSV (Y-3):** reklam token'ı istemci beyanına dayanıyor; günde 25 sınırı var. Sunucu kodu 2026-11-13'te yazıldı ve denendi, devrede değil (yukarıdaki bekleyen adımlar tablosu, madde 4).
- **iOS ATT / SKAdNetwork (G-19):** `skAdNetworkItems` eklendi (2026-11-13, Google'ın AdMob sayfasındaki 50 kimlik; bir sonraki iOS build'iyle Info.plist'e girer). Aracılık (mediation) ağı eklenirse o ağın kimlikleri ayrıca eklenmeli. ATT izni ayrı konu, hâlâ yok.
- **Promosyon kodu kalıntısı:** Uygulamadan kaldırıldı ve `promo_codes` boş, ama `redeem_promo_code` RPC'si ve tablolar duruyor;
  istemci yetkisini kaldır ya da sil. (`max_uses` kontrolü kilitsiz, ama aktif kod yok.)
  **2026-11-13:** yetkiyi alan migration yazıldı: `20261113000000_revoke_promo_code_rpc.sql` (**2026-11-13'te canlıya uygulandı**; istemci rolleri artık 42501 alıyor). Mağazaya çıkan build'lerin hiçbiri RPC'yi çağırmıyor.
- **Mektup açılış bildirimi (G-30, G-15):** yerel bildirim artık açılış anında (açılış günü 00:00 Türkiye saati) geliyor (2026-11-13, `reminderSync.ts`; eskiden yerel 09:00). Sunucu bildirimi kapalı,
  bildirim yalnızca cihaz senkronuna bağlı.
- **Cihaz doğrulama yalnızca istemci kapısı (G-17):** sunucuda zorlanmıyor; "güvenlik" diye sunma ya da gateway'de zorunlu kıl.
- ~~Ölü bağlantı (G-27)~~ **kapatıldı (2026-11-13, yeni build/OTA ister):** `couplesapp://reset-password` artık tanınıp yok sayılıyor (`legacy-reset-password`, `src/lib/deepLinks.ts`); sıfırlama ekranını e-postasız açmıyor.
- **Derleme ortamları (G-28):** `eas.json` development ve preview profilleri de `production` ortamını kullanıyor (canlı Supabase ve
  RevenueCat); ayrı bir test projesi gerekirse ayır.
- **Doğrulanmadı:** `auth-gateway` kova tüketme/kilitleme (G-24), `send-push` küçük sorunları (G-25), test kapsamı (G-32),
  `MaterialSymbols` fontu 973 KB (G-33).
- **Diğer:** Sentry/çökme izleme hesabı; `icon.png` sol üst silik çerçeve; erişilebilirlik: 2026-11-13 taramasında etiketsiz 2 ikon düğmesi bulundu ve etiketlendi (ana sayfa Wrapped kartı kapatma, uygulama içi bildirim kapatma); "belirsiz etiket" denen ~22 düğme ayrıca elle gözden geçirilmedi;
  taban şema dökümü (`supabase db dump`; repoda taban migration yok, `20260907_*` dosyaları önek çakışmalı); büyük dosyalar
  (`OurStarScreen.tsx` vb.); Unsplash demo görselleri çevrimiçi; Nominatim yedeği (kullanıcı artınca ücretli geocoding);
  `report-alert` Edge Function'ı repoda duruyor ama kurulmadı (vazgeçilmişti): sil ya da kur.

## 1. Zaman kilitli mektup: kilit yalnızca istemci tarafında (öncelikli)

> **Güncelleme 2026-11-13: 1. adım canlıda, 2. adım bekliyor.**
> - **Yapıldı:** `public.my_letters` görünümü (migration `20261113000001`, canlıya uygulandı). Alıcı için kilitli mektupta `title` ve `content` boş gelir, diğer sütunlar aynen; gönderen tam görür. İstemcideki 9 okumanın hepsi görünüme taşındı (`LETTERS_READ_SOURCE`, `src/lib/letterPolicy.ts`; koruma testi `letterReadSource.test.ts`). Aşağıdaki plandaki iki RPC yerine tek görünüm seçildi: istemci sorguları (filtre, sıralama, sayım) değişmeden çalışıyor.
> - **Açık hâlâ açık:** `letters_select` alıcıya tabloyu doğrudan okutmaya devam ediyor (eski sürümler buna bağlı). Kilit ancak 2. adımla sunucuda zorlanır.
> - **2. adım (yeni istemci mağazalarda yayıldıktan sonra; erken uygulanırsa eski sürümlerde gelen mektuplar kaybolur):**
>   ```sql
>   BEGIN;
>   DROP POLICY letters_select ON public.letters;
>   CREATE POLICY letters_select ON public.letters FOR SELECT USING (sender_id = (SELECT auth.uid()));
>   COMMIT;
>   ```
>   Canlıda ROLLBACK'li provası 2026-11-13'te yapıldı: alıcı tablodan 0 satır, görünümden maskeli satırları aldı. Önce görünümü kullanmayan sürümler (iOS ≤ 20, Android ≤ 12) zorunlu güncellemeyle (`docs/ZORUNLU_GUNCELLEME.md`) kapatılmalı ya da kullanım dışı kalmalı.


**Durum:** Alıcı, kilidi henüz açılmamış (`unlock_date` gelecekte) bir mektubun satırını, şifreli içerik dahil,
Supabase'ten doğrudan okuyabiliyor. Mektubu "açılmış" göstermemek ve içeriği çözmemek uygulamanın kendi kodunda;
sunucu bunu zorlamıyor. Teknik bilgisi olan bir alıcı API'yi doğrudan çağırıp erken okuyabilir.

**Neden böyle:** `letters` tablosundaki `letters_select` politikası alıcıya `receiver_id = ben` için tüm satırları açıyor.
Uygulama bunu bilerek kullanıyor: ana sayfadaki "Sana mühürlü bir mektup var" kartı, mektuplar sekmesindeki
"Kilitli · 14 Şub 2027" kartları ve yaklaşan açılış bildirimleri `unlock_date` ve `sender_id` alanlarını okuyor
(`src/lib/screenQueries.ts`, `src/app/(tabs)/home.tsx`, `src/lib/letterArrival.ts`, `src/lib/widgetUnread.ts`).
Daha sıkı olan `"View letters involved in"` politikası (alıcı yalnızca açılmış mektubu görür) bu yüzden 20261107000006
migration'ında kaldırıldı: VEYA ile birleştiği için zaten etkisizdi, uyarı veriyordu.

**Risk:** Düşük. Mektup içeriği uygulama içinde şifreli saklanıyor ve çözme anahtarı partnerler için zaten aynı;
yalnızca zamanlama sürprizi atlatılabiliyor. Başka çiftlerin verisini etkilemiyor.

**Çözüm planı (yayından sonra, yeni build gerektirir):**
1. `letters` için alıcı SELECT yolunu kapat: `letters_select` yalnızca `sender_id = ben` kalsın.
2. Alıcı için iki SECURITY DEFINER fonksiyon:
   - `get_my_received_letters(p_couple_id, p_limit)`: açılmış mektupları tam, kilitli olanları **içerik ve başlık olmadan**
     (yalnızca `id`, `sender_id`, `unlock_date`, `created_at`) döndürsün.
   - `get_my_upcoming_letter_unlocks()`: ana sayfa kartı ve bildirimler için `unlock_date > bugün` satırlarının
     `id, unlock_date, sender_id` alanları.
3. İstemcide alıcı sorgularını bu fonksiyonlara taşı: `screenQueries.ts`, `home.tsx`, `letterArrival.ts`,
   `widgetUnread.ts`, `wrappedCalculator.ts`, `loveScore.ts` (gönderen tarafı etkilenmez).
4. Realtime ya da widget alıcı satırlarını doğrudan okuyorsa onları da güncelle (`widgetBridge.ts`).
5. Test: alıcı olarak gelecek tarihli mektubun `content` alanını doğrudan `select` ile okumayı dene (boş/engelli olmalı);
   `unlock_date` günü aynı mektup tam gelmeli; gönderen kendi mektubunu her zaman görmeli.

Not: Eski uygulama sürümleri doğrudan `select` yaptığı için sunucu tarafı kapatıldığında eski sürümlerde mektup listesi
boş kalır. Bu yüzden önce yeni istemci mağazalarda yayılmalı, sonra politika sıkılaştırılmalı (ya da zorunlu güncelleme).

## 2. Diğer açık uyarılar (bilerek bırakıldı)

- `pg_trgm` eklentisi `public` şemasında: taşımak GIN indekslerini ve arama fonksiyonlarını bozabilir; trafik gelince ele alınır.
- `anon` / `authenticated` için SECURITY DEFINER RPC'ler: hepsinin gövdesinde `get_my_couple_id()` ile kimlik/çift kontrolü var.
  İsteğe bağlı olarak giriş gerektiren fonksiyonlardan `anon` EXECUTE yetkisi kaldırılabilir (keşif modu için
  `get_stars_in_viewport`, `search_celestial_universe`, `get_sectors_overview`, `is_username_available` hariç).
- Supabase Auth "sızdırılmış şifre koruması" kapalı: yalnızca ücretli planda; panelden açılır.
- Performans: kullanıcı sayısı artınca `pg_stat_statements` ile yavaş sorgulara bak.

## 3. Doğrulama komutları

```
supabase db advisors --linked --type all        # tarayıcı uyarıları (kalan: pg_trgm, anon/auth definer, leaked password)
supabase db query --linked -f <dosya.sql>       # migration uygulama (db push YASAK)
```
