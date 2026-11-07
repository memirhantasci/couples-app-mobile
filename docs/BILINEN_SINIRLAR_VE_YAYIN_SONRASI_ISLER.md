# Bilinen sınırlar ve yayın sonrası işler

Son güncelleme: 2026-11-07

## 0. Eski denetim raporlarından kalan açık işler (2026-11-07 kontrolü)

`DENETIM_GECE_TARAMASI.md` ve `KAPSAMLI_SATIS_ONCESI_DENETIM_RAPORU.md` (30 Ekim) ile `WEB_SITESI_YASAL_METIN_GUNCELLEMELERI.md`
maddeleri güncel kod ve canlı veritabanıyla tek tek karşılaştırıldı; biten her şey için dosya silindi (git geçmişinde duruyor).
Bitmeyenler:

### Yayından önce
- **Sign in with Apple token iptali (2-5):** Uygulamada Apple ile giriş var (`login.tsx`). Hesap silinirken Apple'a token revoke
  çağrısı gitmiyor (`process-account-deletions` yapmıyor). Apple bunu şart koşar. `.p8` anahtarı ve Services ID gerekir.
- **Kayıtta yaş onayı (G-21):** Yasal metinler 16 yaş sınırı beyan ediyor, kayıt ekranında "16 yaşından büyüğüm" onayı yok.
- **Depo gizliliği:** GitHub deposu `memirhantasci/couples-app-mobile` herkese açıksa private yap; geçmişte `.env` ve
  `google-services.json` var. Google Cloud'da Maps ve Firebase anahtarlarını paket adı/SHA-1 ile kısıtla; sohbette görünen
  RevenueCat `sk_` anahtarını yenile.
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
- **Ödüllü reklam SSV (Y-3):** reklam token'ı istemci beyanına dayanıyor; günde 25 sınırı var. AdMob Server-Side Verification ekle.
- **iOS ATT / SKAdNetwork (G-19):** `app.json` AdMob eklentisinde `skAdNetworkItems` yok (reklam gelirini ve atfı etkiler).
- **Promosyon kodu kalıntısı:** Uygulamadan kaldırıldı ve `promo_codes` boş, ama `redeem_promo_code` RPC'si ve tablolar duruyor;
  istemci yetkisini kaldır ya da sil. (`max_uses` kontrolü kilitsiz, ama aktif kod yok.)
- **Mektup açılış bildirimi (G-30, G-15):** yerel bildirim 09:00, mektup Türkiye 00:00'da açılıyor; sunucu bildirimi kapalı,
  bildirim yalnızca cihaz senkronuna bağlı.
- **Cihaz doğrulama yalnızca istemci kapısı (G-17):** sunucuda zorlanmıyor; "güvenlik" diye sunma ya da gateway'de zorunlu kıl.
- **Ölü bağlantı (G-27):** `couplesapp://reset-password?token_hash=...` kullanılmıyor, kaldırılabilir.
- **Derleme ortamları (G-28):** `eas.json` development ve preview profilleri de `production` ortamını kullanıyor (canlı Supabase ve
  RevenueCat); ayrı bir test projesi gerekirse ayır.
- **Doğrulanmadı:** `auth-gateway` kova tüketme/kilitleme (G-24), `send-push` küçük sorunları (G-25), test kapsamı (G-32),
  `MaterialSymbols` fontu 973 KB (G-33).
- **Diğer:** Sentry/çökme izleme hesabı; `icon.png` sol üst silik çerçeve; ~22 ikon düğmesinde belirsiz erişilebilirlik etiketi;
  taban şema dökümü (`supabase db dump`; repoda taban migration yok, `20260907_*` dosyaları önek çakışmalı); büyük dosyalar
  (`OurStarScreen.tsx` vb.); Unsplash demo görselleri çevrimiçi; Nominatim yedeği (kullanıcı artınca ücretli geocoding);
  `report-alert` Edge Function'ı repoda duruyor ama kurulmadı (vazgeçilmişti): sil ya da kur.

## 1. Zaman kilitli mektup: kilit yalnızca istemci tarafında (öncelikli)

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
