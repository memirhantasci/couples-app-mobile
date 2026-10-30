# CoupleSky — Gece Taraması (bağımsız denetim)

**Tarih:** 30 Ekim 2026 · **Dal:** `feat/i18n-english` @ `44d4406` · **Yöntem:** salt okuma. Kod, migration ve ayar dosyalarına dokunulmadı; yalnızca bu dosya eklendi.
**Kapsam dışı bırakılanlar:** Görev metnindeki "bunları yazma" listesi (FREEMIRHAN/set_premium_status, git geçmişi, AdMob SSV, Apple token iptali, hesap/anahtar/form işleri, taban şema dökümü, Sentry, sahipsiz dosyalar, hesap silince çift verisinin silinmesi vb.) bilerek yazılmadı. Önceki raporun (`KAPSAMLI_SATIS_ONCESI_DENETIM_RAPORU.md`) maddeleri tekrarlanmadı; bu rapordaki her madde **yeni** ya da önceki turda yazılan kodda bulunan **yeni bir hatadır**.

**AGENTS.md notu:** "Expo sürümüne özel dokümanı oku" kuralı için `docs.expo.dev/versions/v57.0.0` bu oturumda açılamadı (web aracı yok). Expo API'sine dair hiçbir bulgu dokümana değil kodun kendisine dayanır; Expo'ya özgü iddialar "varsayım" diye işaretlendi.

---

## 0. Başlangıç komutları

| Komut | Sonuç |
| :-- | :-- |
| `npx tsc --noEmit` | exit 0, hata yok |
| `npx expo lint` | 0 hata, **59 uyarı** (önceki rapor 62 diyordu) |
| `npx jest` | 7 suite, **24 test geçti** (önceki rapor 20 diyordu) |
| `npx expo-doctor` | 21/21 geçti |
| `npx expo install --check` | "Dependencies are up to date" |
| `npm audit --omit=dev` | 20 açık (6 düşük, 2 orta, 11 yüksek, 1 kritik). Hepsi derleme/CLI zincirinde: `node-forge` (←`expo-updates`→`@expo/code-signing-certificates`), `zod` (←`@expo/cli`), `shell-quote` (←`react-devtools-core`), `source-map-js` (←tailwind/postcss). `npm ls` ile doğrulandı; uygulama paketine girmez, bulgu yazılmadı |
| `CI=1 npx expo export --platform android` | exit 0, 5084 modül, Hermes paketi **13 MB**, 61 asset, uyarı yok. Çıktı silindi. Tek not: `MaterialSymbols_400Regular.ttf` (973 KB) pakete giriyor, doğrudan bağımlılık değil (G-33) |
| Migration yetki tekrarı (kendi betiğim, regex tabanlı) | 107 public fonksiyon; ayrıntı G-05 ve "Baktım" listesinde |
| TR/EN çeviri paritesi (betik) | 2410/2410 anahtar, `{{değişken}}` uyumsuzluğu 0, EN'de Türkçe karakter yalnızca iki demo metni (yer adı "Kadıköy") |

---

## 1. Önem dağılımı

| Önem | Adet | Anlamı |
| :-- | :-: | :-- |
| **P0** | 1 | Gelir / satış engeli |
| **P1** | 4 | Yayından önce kapanmalı |
| **P2** | 13 | İlk sürümden önce ya da hemen sonra |
| **P3** | 15 | Fırsat buldukça |
| **Toplam** | **33** | |

## 2. En kritik 10 bulgu

| # | Bulgu | Önem |
| :-: | :-- | :-: |
| G-01 | RevenueCat, Apple anahtarı yoksa Android'de de başlatılmıyor → satın alma imkânsız | **P0** |
| G-02 | `letters` tablosundaki doğrudan INSERT politikası duruyor: token/Premium kapısı REST ile aşılıyor, istenen kullanıcıya mektup + bildirim yağdırılabiliyor | P1 |
| G-03 | `couplesapp://invite?code=` bağlantısı onay sormadan eşleştiriyor | P1 |
| G-04 | Premium çifte bağlı: eşleşirken ya da partner silinince kaybolur; RevenueCat'te aktif hakkı sunucuya yeniden işleyen yol yok | P1 |
| G-05 | `get_*_reminders` yetki düzeltmesi imza tutmazsa **sessizce hiçbir şey yapmıyor** (push token sızıntısı açık kalabilir) | P1 |
| G-06 | `couplesapp://verify?...&type=` bağlantısı onaysız oturum değiştiriyor (login-CSRF) | P2 |
| G-07 | `earn_tokens` günlük sınırı eşzamanlı çağrıyla aşılıyor | P2 |
| G-08 | `meetings` / `calendar_notes`: UPDATE ile başka çiftin `couple_id`'sine içerik enjekte edilebiliyor | P2 |
| G-09 | `invoke_push_webhook` hata fırlatırsa kullanıcının kendi yazması (mektup, mod, anı, hatta eşleşme/Premium) geri alınıyor | P2 |
| G-11 | KVKK'nın dayandığı sağlık verisi "açık rıza"sı uygulamada hiç alınmıyor | P2 |

---

## 3. P0

### G-01 · RevenueCat başlatması yalnızca **iki** anahtar da varsa çalışıyor
- **Dosya:** `src/lib/revenuecat.ts:36`
- **Kanıt:**
  ```ts
  if (API_KEYS.apple.includes("xxxx") || API_KEYS.google.includes("xxxx")) {
    logger.warn("RevenueCat API keys are not configured. Skipping initialization.");
    return;
  }
  ```
  Hafızadaki yayın listesi: "EAS production env: … RevenueCat Google key (**Apple key yok**, iOS açılınca)". `logger.warn` üretimde `noop` (`src/utils/logger.ts`). Yani Apple anahtarı olmadan alınan bir Android derlemesinde `configure()` hiç çağrılmaz, `isInitialized=false` kalır, `getOfferings()` boş dizi döner, `purchasePackage()` `null` döner.
- **Etki:** Android'e ilk çıkışta (iOS sonraya bırakılmışken) paywall boş, hiçbir satın alma çalışmaz ve hiçbir yerde hata görünmez. Gelir sıfır.
- **Düzeltme:** Yalnızca **çalışılan platformun** anahtarını kontrol et (`Platform.OS === "ios" ? apple : google`); eksikse bunu kullanıcıya/raporlamaya yansıt (en azından `client_errors`).
- **Durum:** doğrulandı (kod). EAS ortam değişkeninin gerçek durumu doğrulanamadı.

---

## 4. P1

### G-02 · `letters` tablosunda doğrudan INSERT politikası hâlâ var
- **Dosya/migration:** `003_supabase_auth_refactor.sql:306` ve `008_fix_rls_recursion.sql:51` → `CREATE POLICY "Insert own sent letters" … FOR INSERT WITH CHECK (sender_id = auth.uid())`.
- **Kanıt:** `grep -rn "Insert own sent letters" supabase` yalnızca bu iki oluşturma satırını veriyor; hiçbir migration politikayı düşürmüyor ya da `REVOKE INSERT ON letters` yapmıyor. `20261022000002` yalnızca *Update* ve *Delete* politikalarını kaldırıyor; `20261029000002` aynı işi `couples` için yapmış (INSERT/DELETE politikaları + tablo yetkileri kaldırılmış) ama `letters` için yapılmamış. İstemci yalnızca `save_letter` RPC'sini kullanıyor (`letters.tsx:234`), yani politika kullanılmıyor ama açık. Satırda `trg_activity_points AFTER INSERT` var (`20261021000000:638`) ve `push_on_letters` tetikleyicisi de INSERT'te çalışıyor.
- **Etki:** Giriş yapmış herhangi biri PostgREST'e doğrudan `POST /rest/v1/letters` atarak (a) `save_letter` içindeki **100 token / Premium** kapısını, (b) "alıcı aynı çiftten partner olmalı" kuralını, (c) `couple_id` doğrulamasını atlar. Pratik sonuçlar: ücretsiz sınırsız mektup; UUID'sini bildiği herkese (örn. ayrılmış eski partner) "X sana mektup yazdı" **push bildirimi** yağdırma; yıldız aktivite puanı çiftçiliği.
- **Düzeltme:** `DROP POLICY "Insert own sent letters" ON public.letters; REVOKE INSERT ON public.letters FROM anon, authenticated;` (RPC SECURITY DEFINER olduğu için etkilenmez). Aynı taramayı `memories` için de yap (G-31).
- **Durum:** doğrulandı (migration'lar yeniden oynatıldı). Canlıda elle değişmiş olabilir: `select polname from pg_policy where polrelid='public.letters'::regclass;` ile teyit et.

### G-03 · Davet bağlantısı onay sormadan eşleştiriyor
- **Dosya:** `src/app/_layout.tsx:172-203` (`handleDeepLink`, `link.kind === "invite"`).
- **Kanıt:** Oturum açıksa kod hafızaya yazılıp hemen `joinCoupleByCode(code)` çağrılıyor; başarılıysa `navigateAfterAuth`. Hiçbir "X ile eşleşmek istiyor musun?" adımı yok. `couplesapp://` özel şemadır; herhangi bir uygulama/web sayfası/SMS bağlantısı tetikleyebilir.
- **Etki:** Eşleşmemiş (bekleyen) bir kullanıcıya saldırgan kendi bekleyen çiftinin kodunu içeren bağlantı gönderir; kullanıcı dokunduğunda **sessizce saldırganla eşleşir**: saldırgan ortak mod, mektup, anı, harita notu, döngü verisi gibi ortak alanları görür. Kullanıcının kendi bekleme çifti `join_couple_by_code_uuid` içinde silinir (`DELETE FROM couples`), yani orada yaptığı kurulum da gider. Kurulmuş (2 kişilik) çiftler `ALREADY_PAIRED` ile korunuyor; risk bekleyen kullanıcılar, özellikle yeni kayıtlar.
- **Düzeltme:** Davet bağlantısı yalnızca `/(setup)/pairing` ekranını kodla **önceden doldurup** açsın; katılım kullanıcının açık onayıyla (partnerin adı/avatarı gösterilerek) yapılsın.
- **Durum:** doğrulandı (kod).

### G-04 · Premium çiftin satırına bağlı; eşleşirken/partner silinince kayboluyor ve sunucuya yeniden işleyen yol yok
- **Dosya/migration:** `20261030000001_pairing_rate_limit.sql:100-104` (`DELETE FROM couples WHERE id = v_old_couple_id …`), `20260906_create_star_system.sql:80` (`couple_stars … ON DELETE CASCADE`), `supabase/functions/revenuecat-webhook/index.ts:85` (`if (!profile?.couple_id) return "no_couple"`), `src/lib/premiumSync.ts`, `src/app/paywall.tsx:108-125`.
- **Kanıt ve senaryolar:**
  1. Kullanıcı eşleşmeden önce Premium alır (ya da promosyon kullanır; `024` "solo premium"u bilerek açmıştı). Sonra partnerin koduyla katılır: eski (tek kişilik) çift silinir; `is_premium/premium_expires_at` ve cascade ile `couple_stars` gider. `celestial_catalog.is_claimed` **sıfırlanmıyor** (yalnızca `purge_account_data` sıfırlıyor: `20261030000002:221`), yani yıldız kalıcı olarak "alınmış" kalır, sahibi yok. Yeni çiftin Premium'u partnerinkiyle belirlenir.
  2. Premium'u satın alan kişi partner hesabını silerse çift silinir (`purge_account_data`), hayatta kalan `couple_id=NULL` olur, yeni çift açar; Premium yok.
  3. İki durumda da RevenueCat'te hak **aktif** kalır ama webhook yalnızca RevenueCat olayında çalışır; "Satın alımları geri yükle" olay üretmez (varsayım: RevenueCat davranışı), istemci senkronu kaldırılmış. Paywall ise `waitForServerPremium` sonucunu yok sayıp "Premium aktif" tostu gösteriyor (G-10). Kullanıcı bir sonraki yenilemeye (aylık/yıllık) kadar parası verilmiş hâlde Premium'suz kalır.
- **Etki:** Para ödeyen kullanıcıda sessiz Premium kaybı, destek talebi/iade/olumsuz yorum.
- **Düzeltme:** (a) `join_couple_by_code_uuid` içinde eski çiftin Premium bitişini/yıldızını hedef çifte taşı (ya da Premium'u kullanıcı bazında tut, çift Premium'u üyelerin en geçerlisi olsun); (b) webhook'a `users.store_premium_until` benzeri kullanıcı bazlı kayıt ekle ve `couples.is_premium`'ı üyelerden türet; (c) uygulama açılışında/eşleşme sonrası/geri yüklemede RevenueCat REST API'sinden hak okuyup uygulayan bir `sync-premium` edge function.
- **Durum:** varsayım (kod okuyarak; taban şema ve canlı veri yok).

### G-05 · `get_*_reminders` yetki düzeltmesi, imza tutmazsa sessizce atlanıyor
- **Migration:** `20261030000006_fix_reminder_rpcs.sql:27-45`.
- **Kanıt:**
  ```sql
  FOREACH v_sig IN ARRAY ARRAY['public.get_active_medicine_reminders(text)', … 'public.get_upcoming_meeting_reminders(text, text)', …]
  LOOP IF to_regprocedure(v_sig) IS NOT NULL THEN EXECUTE format('REVOKE ALL … FROM PUBLIC, anon, authenticated', v_sig);
  ```
  İmzalar, repoda tanımı olmayan canlı fonksiyonlar için **tahmin**: `send-push` parametre adlarından (`current_time_str`, `target_date_str`, `today_date_str`, `now_str`+`target_time_str`) ve tür sayısından çıkarılmış. `to_regprocedure` eşleşmezse `IF` sessizce geçer, hata vermez. Canlıda aynı adlı eski bir aşırı yükleme (overload) varsa onun da yetkisi kalır. Önceki rapor bu migration'ı "push token sızıntısını kapatır (öncelikli)" diye sunuyor.
- **Etki:** Migration çalışıp "başarılı" görünür ama anon anahtarıyla tüm kullanıcıların push token'larını döndüren RPC'ler açık kalabilir; bu token'larla sahte bildirim gönderilebilir.
- **Düzeltme:** İmza tahmini yerine katalogdan dön: `FOR v_sig IN SELECT p.oid::regprocedure FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.proname IN (…)` ve eşleşme olmazsa `RAISE WARNING`. Çalıştırdıktan sonra `select p.oid::regprocedure, has_function_privilege('anon', p.oid,'execute') from pg_proc p where proname like 'get\_%reminders' escape '\';` hepsi `false` dönmeli.
- **Durum:** varsayım (SQL çalıştırılamadı); riskin kendisi koddan açık.

---

## 5. P2

### G-06 · `verify` bağlantısı onaysız oturum değiştiriyor (login-CSRF)
- **Dosya:** `src/lib/deepLinks.ts:27-30`, `src/app/_layout.tsx:154-161`, `src/app/(auth)/verify.tsx:52-70`.
- **Kanıt:** `couplesapp://verify?token_hash=…&type=…` açıldığında `type` serbest bir metin olarak `supabase.auth.verifyOtp({ token_hash, type: type as any })`'e gidiyor; beyaz liste yok, kullanıcı onayı yok. Başarılıysa cihaz `device_authorizations`'a **yetkili** yazılıyor ve `last_user_id` ezilir.
- **Etki:** Saldırgan kendi hesabı için ürettiği geçerli bir token_hash ile (örn. magiclink/email) hazırlanmış bağlantıyı kurbana yollar; kurban farkında olmadan saldırganın hesabına girer ve oraya özel içerik (mektup, günlük, fotoğraf) yazabilir.
- **Düzeltme:** `type` için `signup | email | recovery` beyaz listesi; oturum zaten açıksa ya da hesap farklıysa onay sor; yalnızca uygulama içinden istenen doğrulamayı kabul et.
- **Durum:** varsayım (istismar denenmedi).

### G-07 · `earn_tokens` günlük sınırı eşzamanlı çağrıyla aşılıyor
- **Migration:** `023_premium_and_security_tightening.sql` (`earn_tokens`), satırlar ~64-75.
- **Kanıt:** Sınır, `SELECT COUNT(*) … FROM token_transactions` ile okunuyor, **kilit yok**; sayım ve `INSERT` arasında başka işlem araya girebilir. Kullanıcı satırı (`UPDATE users`) ancak sayımdan sonra kilitleniyor. Çağrılar paralel gelirse hepsi `< 25` görür.
- **Etki:** Günde 25 reklam sınırı ve onunla birlikte 625 token tavanı etkisiz kalır; token = ücretsiz mektup. (SSV eksikliği ayrı ve kapsam dışı; bu, mevcut tek korumanın da delinmesi.)
- **Düzeltme:** Fonksiyonun başında `SELECT … FROM users WHERE id = v_user_id FOR UPDATE` (ya da `pg_advisory_xact_lock(hashtext(v_user_id::text))`) ile serileştir. `redeem_promo_code`'da aynı kalıp `max_uses` için geçerli (G-31).
- **Durum:** doğrulandı (kod); çalıştırılmadı.

### G-08 · `meetings` ve `calendar_notes`: UPDATE ile başka çifte içerik enjekte edilebiliyor
- **Migration:** `008_fix_rls_recursion.sql:70` (`"Update own data" … FOR UPDATE USING (user_id = auth.uid())`, `WITH CHECK` yok → `USING` yeni satıra da uygulanır, `couple_id` kontrol edilmez). `20261029000003` bu hatayı yalnızca `daily_notes, moods, medicines, medicine_logs, period_logs` için kapatmış; `meetings`, `calendar_notes` (ve `photo_archive`) listede yok. `photo_archive`, `…_paths_in_couple_folder` CHECK kısıtıyla korunuyor.
- **Kanıt:** `grep` ile `meetings`/`calendar_notes` için `couple_id` içeren bir UPDATE `WITH CHECK` bulunamadı. Çift kimlikleri artan tamsayı (`INTEGER`).
- **Etki:** Kendi satırını oluşturup `couple_id`'yi başka bir çiftinkiyle değiştiren kişi, o çiftin takvimine/buluşma listesine istediği başlıkta kayıt düşürür (taciz, spam). Push gitmez (tetikleyici yalnızca INSERT).
- **Düzeltme:** `29000003` döngüsüne `meetings`, `calendar_notes`, `photo_archive` ekle.
- **Durum:** varsayım (taban şemadaki canlı politikalar bilinmiyor).

### G-09 · `invoke_push_webhook` hata fırlatıyor ve her `couples` güncellemesine bağlı
- **Migration:** `20261024000002_push_secret_from_vault.sql:49-51`, `20261030000004:61-81` (`push_on_couples AFTER UPDATE`, `push_on_letters` vb.).
- **Kanıt:** Vault'ta `PUSH_WEBHOOK_SECRET` yoksa `RAISE EXCEPTION`. Bunlar **AFTER INSERT/UPDATE satır tetikleyicisi**, yani istisna kullanıcının asıl yazmasını geri alır. Aynı dosyadaki `notify_partner_notice` (`20261030000002:87`) hatayı bilerek yutuyor; yani tutarsızlık da var. Ek: payload `row_to_json(NEW)` olduğundan `couples` güncellemelerinde `encryption_salt`, `letters`'ta şifreli içerik pg_net üzerinden Edge Function'a gidiyor.
- **Etki:** Secret silinir/yanlış rotasyon olursa mektup, mod, anı, buluşma, takvim notu, ilaç kaydı **ve** `couples` üzerindeki her yazma (eşleşme sayacı, Premium webhook'u, tarih değişikliği) hata verir; uygulama "çalışmıyor" görünür.
- **Düzeltme:** Gövdeyi `BEGIN … EXCEPTION WHEN OTHERS THEN NULL; END` ile sar (push asla yazmayı bozmasın). Payload'ı yalnızca gereken sütunlara indir (`id`, `user_id`, `sender_id`, `receiver_id`, `unlock_date`, `mood_type`, `status`…).
- **Durum:** doğrulandı (kod); çalıştırılmadı.

### G-10 · Paywall, sunucu Premium görünmeden "aktif" diyor
- **Dosya:** `src/app/paywall.tsx:108-125`.
- **Kanıt:** `await waitForServerPremium(refreshProfile); toast.success(t("paywall.activated")); handleBack();` — dönüş değeri (`false` = 12 sn'de gelmedi) yok sayılıyor. Restore için de aynı.
- **Etki:** Webhook deploy edilmemişse/geç kalırsa/hata verirse (ya da G-04'teki durumlarda) kullanıcı ödeme yapmış, "Tebrikler" görmüş ve hâlâ kilitli kalmış olur; dead-end.
- **Düzeltme:** `false` dönerse "Ödemen alındı, Premium birkaç dakika içinde etkinleşecek; olmazsa Geri Yükle'ye bas / destekle iletişime geç" mesajı göster ve profili arka planda yenilemeye devam et.
- **Durum:** doğrulandı (kod).

### G-11 · Sağlık verisi için "açık rıza" yakalanmıyor
- **Dosya:** `src/constants/legalTexts.ts:65,161-170`, `src/components/legal/LegalModal.tsx:40`, `src/components/profile/LegalDocsList.tsx:19`.
- **Kanıt:** KVKK metni, sağlık (regl/ilaç) ve konum verileri için "KVKK md. 5/1 ve 6/2 … vermiş olduğunuz **Açık Rıza**" diyor. `"consent"` belgesi kodda yalnızca profildeki yasal belgeler listesinde **okunabiliyor**; hiçbir ekranda onay kutusu/zaman damgalı kayıt yok (`grep '"consent"'` yalnızca bu iki liste). Kayıtta yalnızca "devam ederek kabul edersin" bağlantıları var.
- **Etki:** Beyan edilen hukuki dayanak fiilen yok; özel nitelikli veri için KVKK/GDPR ve Play/App Store sağlık verisi politikaları risk.
- **Düzeltme:** Döngü ve ilaç modüllerine ilk girişte ayrı, kaydı tutulan (kullanıcı, tarih, sürüm) açık rıza adımı ekle; reddedenin bu modüller olmadan uygulamayı kullanabilmesini sağla.
- **Durum:** doğrulandı (kod); hukuki değerlendirme avukata ait.

### G-12 · Yasal metin "şifreli" diyor, mod/sağlık/harita notu düz metin
- **Dosya:** `src/constants/legalTexts.ts:37,169` (TR), karşılıkları EN; kod: `encrypt(` yalnızca `add-daily-note.tsx`, `daily-notes.tsx`, `letters.tsx`, `DailyNoteCard.tsx`, `secureAuthStorage.ts`, `crypto.ts`'te geçiyor.
- **Kanıt:** Metin: "Zaman kilitli mektuplar, günlük notları ve **ruh hali (mood)** seçimleri … sunucuda şifreli saklanmaktadır" ve onay metni "ruh hali durumlarının … şifreli sunucularda saklanması". Oysa mod (`send-push` `record.mood_type` düz kullanıyor), ilaç adı, regl kayıtları, buluşma başlığı/yeri, harita notu şifrelenmiyor (`medicine.tsx`/`meetings.tsx`'te `encrypt` yok; `send-push` `enc:` ön ekini yalnızca savunma için süzüyor).
- **Etki:** Beyan, kodun gerçek davranışıyla uyuşmuyor; sağlık verisi (regl/ilaç) düz metin. Play "Data safety → data encrypted at rest" ve KVKK aydınlatma doğruluğu.
- **Düzeltme:** Metni gerçeğe çek ("mektuplar ve günlükler uygulama katmanında şifrelenir; diğer veriler yalnızca altyapı düzeyinde şifrelenir ve çifte özel erişimle korunur") **ya da** sağlık verisini de şifrele.
- **Durum:** doğrulandı (kod).

### G-13 · Yasal metinde olmayan üçüncü taraf akışları
- **Dosya:** `src/utils/exifHelper.ts:176` (Nominatim yedeği), `src/lib/errorReporting.ts` (`client_errors`).
- **Kanıt:** `grep -ril "nominatim\|openstreetmap" docs src/constants` boş. Kodda adres sorguları (yazılan yer adı) ve fotoğraf konumu `https://nominatim.openstreetmap.org/search`'e gidebiliyor (yerel geocoder boş dönünce). `client_errors` tablosuna hata metni, yığın izi, sürüm, platform ve (RLS `user_id` varsayılanıyla) kullanıcı kimliği yazılıyor, 30 gün saklanıyor; politikalarda "güvenlik logları" dışında anılmıyor.
- **Etki:** Play Data safety ve Apple App Privacy "üçüncü tarafla paylaşılan konum/arama verisi" beyanı eksik kalır; KVKK md. 10 aydınlatma eksik.
- **Düzeltme:** Politikalara OSM Nominatim (veya yerine geçecek geocoder) ve hata günlüğünü ekle; saklama süresini yaz.
- **Durum:** doğrulandı (kod + arama).

### G-14 · Herkese görünen yıldız adı için raporlama/engelleme yok, filtre çok zayıf
- **Dosya/migration:** `20260907_stage2_visibility_and_moderation.sql:13-25` (`contains_blocked_word`), `src/modules/stars`.
- **Kanıt:** Filtre, 20 sözcüklük sabit liste; `'\y'||word||'\y'` kelime sınırlı olduğundan `s1k`, `a.m.k`, aksan/leet, bitişik yazımlar geçer; Türkçe `ç/ö` gibi sözcüklerde (`oç`) `\y` davranışı yerel ayara bağlı (varsayım). Başka çiftlerin yıldız adı haritada **herkese** görünüyor (`get_stars_in_viewport … custom_name herkes için görünür`). Modül ve uygulamada "şikâyet et / engelle" akışı yok (`rapor|şikayet|report|block` taraması boş).
- **Etki:** Apple 1.2 / Google Play UGC politikaları "uygunsuz içeriği bildirme" mekanizması ister; reddedilme riski ve gerçek kötüye kullanım.
- **Düzeltme:** Yıldız detayında "Bildir" + sunucuda `star_reports` tablosu ve otomatik gizleme eşiği; filtreyi normalize ederek (aksan, boşluk/nokta, leet) güçlendir; çift kendi yıldız adını herkese göstermemeyi seçenek yap.
- **Durum:** doğrulandı (kod/arama).

### G-15 · Mektup açılış bildirimi artık yalnızca cihazın senkronuna bağlı
- **Dosya/migration:** `20261030000006_fix_reminder_rpcs.sql:50-60` (`push-letter-unlock` kapatıldı), `src/lib/reminderSync.ts:191-218`.
- **Kanıt:** Sunucu cron'u kapatıldı; yerel bildirim `get_my_pending_letter_unlocks` ile ancak uygulama açılıp `syncLocalReminders` çalıştığında kurulur (en fazla 15 gün). Bildirim saati cihazda 09:00, mektup ise Türkiye 00:00'da açılıyor.
- **Etki:** Gönderen 3 ay sonrası için mektup yazıp alıcı o sırada uygulamayı açmadıysa (veya yeni cihaz/yeniden kurulum/bildirim izni sonradan verildiyse) alıcıya "mektubun açıldı" bildirimi **hiç gitmez**; ürünün çekirdek anı. Yeni-mektup push'ı gittiği için çoğu kullanıcıda senkron olur; garanti değil.
- **Düzeltme:** `get_letter_unlock_reminders`'ı doğru türlerle (`app_today()`) yeniden yazıp yalnızca "bugün açılan ve henüz bildirim almamış" alıcılar için cron'u açık tut; yerel kopya ile çift bildirimi `collapseId`/`push_dedupe` ile engelle.
- **Durum:** doğrulandı (kod); davranış cihazda denenmedi.

### G-16 · Eksik ortam değişkeni açılışta çökertiyor
- **Dosya:** `src/lib/supabase.ts:5-8`.
- **Kanıt:** `process.env.EXPO_PUBLIC_SUPABASE_URL!` doğrudan `createClient`'a veriliyor; boşsa `supabase-js` modül içe aktarılırken "supabaseUrl is required" fırlatır (varsayım: supabase-js davranışı). Bu, `ErrorBoundary`'den önce olur: beyaz ekran/çökme. Karşılaştırma: RevenueCat/AdMob eksikse sessizce atlanıyor.
- **Etki:** EAS'te değişken unutulursa yayınlanan sürüm hiç açılmaz ve `client_errors`'a da yazamaz.
- **Düzeltme:** Açılışta değişkenleri doğrulayıp anlaşılır bir hata ekranı göster; CI/EAS build aşamasında zorunlu değişken kontrolü ekle.
- **Durum:** varsayım.

### G-17 · "Cihaz doğrulama" yalnızca istemci kapısı
- **Dosya:** `src/app/(auth)/verify-device.tsx`, `login.tsx:77-93`, `AuthContext.tsx:305-322`, `auth-gateway/index.ts:119-122`.
- **Kanıt:** `auth-gateway` şifre doğruysa doğrudan `access_token/refresh_token` döndürüyor; "bu cihaz yetkili mi" kararı yalnızca istemcideki `device_authorizations` satırına (istemcinin kendi yazabildiği) bakıyor. Şifreyi bilen biri gateway'i ya da Supabase Auth'u doğrudan çağırıp tam yetkili oturum alır. Gizlilik metni (`legalTexts.ts:109`) bu kimliği "yetkisiz cihaz girişlerini tespit etmek" için sunuyor.
- **Etki:** İkinci faktör gibi sunulan bir kontrol sunucuda uygulanmıyor.
- **Düzeltme:** Ya özelliği "güvenlik" olarak sunmayı bırak ya da yetkili cihaz kontrolünü RLS/edge tarafında zorunlu kıl (örn. yetkisiz cihaz için gateway token vermeden e-posta kodu iste).
- **Durum:** doğrulandı (kod).

### G-18 · UMP "gizlilik seçenekleri" girişi yok
- **Dosya:** `src/lib/adsConsent.ts`; `grep -rn "showPrivacyOptionsForm\|PrivacyOptions"` boş.
- **Etki:** AB/İngiltere kullanıcıları verdikleri rızayı geri çekemez; Google'ın UMP/AB kullanıcı onayı politikası bir "gizlilik seçenekleri" girişi bekler.
- **Düzeltme:** Profil → Gizlilik'e `AdsConsent.getConsentInfo().privacyOptionsRequirementStatus` zorunluysa görünen "Reklam gizlilik seçenekleri" düğmesi (`AdsConsent.showPrivacyOptionsForm()`).
- **Durum:** doğrulandı (arama); gereksinim ayrıntısı Google dokümanına dayanır, bu oturumda açılamadı.

---

## 6. P3

| # | Bulgu | Kanıt | Düzeltme | Durum |
| :-: | :-- | :-- | :-- | :-: |
| G-19 | iOS: ATT ve SKAdNetwork yapılandırması yok | `app.json` `react-native-google-mobile-ads` eklentisinde `userTrackingPermission`/`skAdNetworkItems` yok; `NSUserTrackingUsageDescription` yok | iOS açılırken ekle ya da bilerek "izlemesiz" beyan et; App Privacy ile tutarlı olsun | doğrulandı |
| G-20 | EN KVKK metni artık olmayan "banners" diyor; TR/EN "yalnızca kişiselleştirilmemiş reklam" diyor ama UMP akışı kişiselleştirilmiş reklamı engellemiyor | `legalTexts.ts:232`, `adsConsent.ts:62-66` (`requestNonPersonalizedAdsOnly` yok) | "banner"ı sil; ifadeyi gerçeğe uydur ya da `requestNonPersonalizedAdsOnly` kullan; `docs/legal` yeniden üret | doğrulandı |
| G-21 | 16 yaş sınırı beyan ediliyor ama kayıtta yaş/doğum yılı onayı yok | `legalTexts.ts:115`; `login.tsx`'te yaş alanı yok | Kayıtta "16 yaşından büyüğüm" onayı | doğrulandı |
| G-22 | Supabase CLI için çakışan sürüm öneki: `20260907_seed_hipparcos_stars`, `_stage1_fixes`, `_stage2_…`, `_stage3_…` aynı `20260907` | `ls supabase/migrations` | Ad vermeyi `20260907000001_…` biçimine çevir (yeni ortam kurulumunda `db push/reset` "duplicate key" verir) | doğrulandı |
| G-23 | `signOut()` varsayılan olarak **tüm** cihazlardaki oturumu kapatır (`scope: 'global'`) | `AuthContext.tsx:743` `supabase.auth.signOut()` | `{ scope: 'local' }` | varsayım (supabase-js varsayılanı) |
| G-24 | `auth-gateway` kovaları kurbanın kullanıcı adıyla tüketilebilir (hesap kilitleme/şifre sıfırlama DoS); `is_username_available` IP'yi `X-Forwarded-For` ilk değerinden alıyor (taklit edilebilir) | `auth-gateway/index.ts:102,129`; `20261022000004:185-186` | Kovayı IP+kullanıcı birleşimine bağla, IP için güvenilir başlık (`cf-connecting-ip`) | doğrulandı (kod) |
| G-25 | `send-push` küçük sorunlar: tekrar önleme kaydı gönderimden **önce** yazılıyor (Expo hatasında yeniden denenmez); sır karşılaştırması `===` (zamanlama); `moods` her UPDATE'te partnere push (aynı mod yeniden seçilse de) | `send-push/index.ts:48-52,242-244`; `20261030000004:62-71` | Önce gönder sonra işaretle; sabit zamanlı karşılaştırma (revenuecat-webhook'taki `safeEqual`); mod değiştiyse gönder | doğrulandı |
| G-26 | `expo-audio` ön plan hizmeti izinlerini ekliyor (`FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MEDIA_PLAYBACK`); Play bu izin için Console'da bildirim formu ister, uygulama arka planda çalmıyor | eski prebuild manifest `android/app/src/main/AndroidManifest.xml:5-6` (güncel derleme çıktısı değil) | `blockedPermissions`'a ekle ya da formu doldur | varsayım |
| G-27 | `couplesapp://reset-password?token_hash=…` ölü uç: ekran yalnızca `identifier` ve e-posta kodunu kullanıyor, `token_hash` yok sayılıyor | `_layout.tsx:163-170`, `reset-password.tsx:20-39` | Bağlantıyı kaldır ya da ekranı kodsuz akışa bağla | doğrulandı |
| G-28 | `eas.json`: `development` ve `preview` profilleri `environment: production` kullanıyor → geliştirme/önizleme derlemeleri canlı Supabase'e ve canlı RevenueCat/Maps anahtarına bağlanır | `eas.json:8-20` | Ayrı `development`/`preview` ortamı | doğrulandı |
| G-29 | Git'te izlenen `supabase/.temp/linked-project.json` (proje ref + org kimliği); yerel `android/` prebuild klasörü (git dışı) eski: `RECORD_AUDIO`, `SYSTEM_ALERT_WINDOW` içeriyor, doğrudan Gradle ile derlenirse `app.json`'daki `blockedPermissions` uygulanmaz | `git ls-files`, manifest | `.temp/` ignore'a, eski `android/`'i sil ya da `prebuild --clean` | doğrulandı |
| G-30 | Mektup açılış yerel bildirimi 09:00 (cihaz saati), mektup 00:00 TR'de açılıyor; 9 saatlik fark | `reminderSync.ts:29,207` | Saati 00:01 TR'ye eşitle ya da metni "bugün açıldı" yap | doğrulandı |
| G-31 | `redeem_promo_code` `max_uses`/`current_uses` kontrolü kilitsiz (yarışta sınır aşılır); `memories` INSERT politikası `user_id`'yi doğrulamıyor (partner adına anı yazılabilir) | `20261030000000:73-75`; `20261022000005:35-39` | `FOR UPDATE` ile promo satırını kilitle; INSERT'e `user_id = auth.uid()` ekle | doğrulandı (kod) |
| G-32 | Test boşlukları: `parseAppLink`, `crypto.ts`, `periodCycle`, `loveScore`, `relationshipDates`, `reminderSync` (zamanlama), `widgetBridge` payload'ı testsiz; CI `expo-doctor`/export çalıştırmıyor | `src/lib/__tests__` (7 dosya), `.github/workflows/ci.yml` | G-03/G-06 düzeltmeleriyle birlikte `parseAppLink` ve tarih kuralları için test | doğrulandı |
| G-33 | Dokümantasyon/paket: önceki rapor "62 uyarı / 20 test" diyor (gerçek 59/24); `MaterialSymbols_400Regular.ttf` (973 KB) pakete giriyor | komut çıktıları | Rapor sayılarını güncelle; fontun hangi bağımlılıktan geldiğine bak (`@expo/ui`/`expo-router` olası, varsayım) | doğrulandı / varsayım |

---

## 7. Baktım, sorun bulamadım

- **`tsc`, `lint` (hata), `expo-doctor`, `expo install --check`, jest, Android export:** temiz (bkz. bölüm 0).
- **TR/EN çeviri paritesi:** anahtar ve değişken uyumu tam; EN'de çevrilmemiş Türkçe yok (iki demo yer adı hariç). Koda gömülü kullanıcıya görünen Türkçe metin bulunmadı (`MapPickerModal.web.tsx` "İstanbul" yalnızca web).
- **`20261030000000..06` sözdizimi/tür/kilit sırası:** `redeem_promo_code` (rate limit + `SET search_path=''`), `join_couple_by_code_uuid` (kilit sırası, `result_error` ile geri-alma-bağışık sayaç), `partner_notices` (RLS, ack, silme akışı), `letters_istanbul_midnight` (`app_today`, `letter_unlock_at`), `get_anniversary_reminders`/`get_inactivity_reminders` (tür uyumu, `DISTINCT ON`, `search_path`) gözle satır satır okundu; çalıştırılabilir görünüyor (çalıştırılmadı). Hesap silme cron'u `20261029000003` ile Vault sırrını gönderiyor, edge function sırrı istiyor: tutarlı.
- **`revenuecat-webhook`:** sabit zamanlı sır karşılaştırması, UUID doğrulaması, süresiz/promosyon Premium'un olaylarla kısalmaması, TEST olayı; mantık tutarlı (G-04'teki `no_couple` ve SANDBOX ayrımı dışında).
- **`process-account-deletions`:** yetki, sayfalama, depo temizliği (avatars, photos, memories, couple-memories = kodda kullanılan tüm bucket'lar), hata sonrası yeniden deneme.
- **Exoplanet/yıldız RPC'leri:** `REVOKE … FROM PUBLIC` ile bırakılanlar (Supabase varsayılanıyla `anon`'a hâlâ açık: `append_*_exoplanet`, `create/update/delete_exoplanet`, `get_star_system_map`, `get_exoplanet_details` …) ilk satırda `get_my_couple_id() IS NULL → 42501` ile kapanıyor (fail-closed). Güvenlik açığı yok; yalnızca Supabase linter uyarısı üretir.
- **Storage politikaları:** `photos/memories/couple-memories` couple_id klasörüyle sınırlı, silme sahibine; avatar bilinçli herkese açık.
- **`auth-gateway`:** hesap varlığı sızdırılmıyor, şifre değişince tüm oturumlar kapanıyor, kodlar 6-10 haneli, fail-closed rate limit.
- **Hesap silme / çıkış temizliği:** önbellek, widget, yerel bildirim, push token temizleniyor.
- **Premium süre dolumu istemcide:** zamanlayıcı + ön plana dönüşte kontrol var.
- **Dinleyici/zamanlayıcı temizliği:** 3 realtime kanal (`AuthContext`, `StarPointsToastHost`, `StarSparkManager`) ve `setInterval`'lar temizleniyor (taranan 6 kullanım); `Image` için `expo-image`.
- **Sır taraması:** `git grep` ile izlenen dosyalarda JWT/`sb_secret`/`AIza`/RevenueCat anahtarı deseni yok (yalnızca yer tutucu); `.env`, `google-services.json`, servis hesabı dosyası `.gitignore`'da.
- **Android widget (kod okuması):** `PendingIntent` bayrakları `FLAG_IMMUTABLE`, hata durumunda yedek görünüm, veri `MODE_PRIVATE`; alıcı `exported=true` yalnızca widget/saat yayınları için.
- **Bildirim kanalları:** sunucunun kullandığı üç kanal da (`partner_messages`, `letters_channel`, `medicine_channel`) istemcide oluşturuluyor.

## 8. Doğrulayamadıklarım

- **Canlı Supabase:** hiçbir migration çalıştırılmadı; canlıdaki politika/tetikleyici/fonksiyon imzaları ve elle yapılmış panel değişiklikleri bilinmiyor (G-02, G-04, G-05, G-08 canlıda teyit edilmeli). Taban şema repoda olmadığından `letters`, `meetings` vb. gerçek kolon/politika durumu okunamadı.
- **RLS ve yetkilerin otomatik taraması:** regex tabanlı; `character varying(n)` gibi imzalarda eşleşemeyen birkaç satır elle okundu, dinamik SQL yalnızca `20261030000006`'da vardı.
- **EAS ortam değişkenleri**, RevenueCat/AdMob/Play/App Store hesapları, webhook'un RevenueCat'te tanımlı olması, edge function'ların deploy durumu.
- **Cihazda:** widget'lar (Kotlin/iOS hiç derlenmedi), UMP formu, satın alma sandbox'ı, push (ön plan/arka plan/kapalı), Doze'da ilaç alarmı, eşleşme akışı, G-03/G-06 istismarının fiilen çalışması.
- **R8/ProGuard** (`enableProguardInReleaseBuilds: true`): `react-native-purchases`, `google-mobile-ads`, `quick-crypto` için tüketici kuralları yeterli mi, yalnızca release derlemesinde görülür.
- **Android 15 16 KB sayfa uyumu, hedef API seviyesi, Play ön yayın raporu:** `app.json`'da açık `targetSdkVersion` yok, SDK 57 varsayılanına bağlı; derlenmiş AAB incelenmedi.
- **Expo SDK 57 sürüm dokümanı** (AGENTS.md) bu oturumda okunamadı; `expo-notifications` zamanlama davranışı, `expo-audio` manifest eklemeleri ve `supabase-js` `signOut` varsayılanı belgeden değil bilgiden/kod okumasından.
- **Performans:** profil/ölçüm yapılmadı; yalnızca bundle boyutu ve temizlik desenleri incelendi. N+1 ve indeks eksikliği için taban şema gerekli.
- **Erişilebilirlik, kontrast, büyük yazı, küçük ekran, klavye, modal üst üste binmesi:** ekranlar cihazda/emülatörde çalıştırılmadı; yalnızca kod seviyesinde `fontScaleCap` ve rol/etiket varlığı görüldü.
- **Hukuki değerlendirme** (G-11, G-12, G-13, G-21): hukukçu görüşü gerekir.

---

## 9. Sonraki adım için önerilen sıra

1. **G-01** `revenuecat.ts`: yalnızca mevcut platform anahtarını kontrol et (5 dk, gelir).
2. **G-02** `letters` INSERT politikasını düşür + `REVOKE INSERT`; **G-08** `29000003` döngüsüne `meetings/calendar_notes/photo_archive` ekle; **G-31** `memories` INSERT `user_id` (tek migration).
3. **G-05** `20261030000006`'yı katalog döngüsüyle yeniden yaz ve canlıda anon yetkisini sorguyla doğrula.
4. **G-03 + G-06** davet ve doğrulama bağlantılarını onay/beyaz listeyle güvenceye al (+ `parseAppLink` testi, G-32).
5. **G-04 + G-10** Premium'u kullanıcı bazlı tut / `sync-premium` function'ı; join'de Premium+yıldız taşı; paywall'da sunucu Premium gelmediğinde dürüst mesaj.
6. **G-09** `invoke_push_webhook`'u hata yutan hale getir, payload'ı daralt; **G-07** `earn_tokens` kilidi.
7. **G-11/G-12/G-13** açık rıza adımı + yasal metinleri gerçek veri akışına eşitle (Nominatim, hata günlüğü, şifreleme kapsamı), `docs/legal`'i yeniden üret.
8. **G-14** yıldız adı raporlama/engelleme ve güçlendirilmiş filtre; **G-18** UMP gizlilik seçenekleri girişi.
9. **G-15** mektup açılışı için sunucu cron'unu doğru türlerle geri aç; **G-16** açılışta ortam doğrulaması.
10. P3 temizliği (G-19…G-33), ardından yeni EAS build ve cihazda uçtan uca deneme.
