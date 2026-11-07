# Bilinen sınırlar ve yayın sonrası işler

Son güncelleme: 2026-11-07

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
