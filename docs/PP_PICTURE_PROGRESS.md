# 📸 Profil Fotoğrafı (PP) — İlerleme Takibi

Branch: `pp-picture` · Spec: `ARAYUZ_GELISTIRMESI.md` → "[ÇOK ZOR-2] Profil Fotoğrafı"

> Bu dosya, iş yarıda kalırsa kaldığı yerden devam edebilmek için tutulur.
> Her faz ayrı commit'tir; **"Sıradaki adım"** bölümü her commit'te güncellenir.

## Alınan kararlar
- **Bucket:** `avatars`, **public** (spec'teki `avatar_url` + `?v=` cache-bust yaklaşımı).
- **Dosya yolu:** `${userId}/avatar.jpg` (upsert). Storage RLS yalnızca kendi klasörüne + premium iken yazdırır.
- **Premium bitince:** dosya silinmez ama istemci fotoğrafı **göstermez**, harf avatarına döner (`profile.isPremium` çift bazlı).
- **Kaldırma:** premium olmasa bile her zaman serbest (DB `NULL` + storage delete).
- **Migration:** Claude dosyayı yazar, kullanıcı canlı DB'ye uygular (dashboard SQL editor veya `supabase db push`).
- **Widget (Faz 7):** kapsam dışı.

## Fazlar
- [x] **Faz 0** — Plan + bu dosya
- [x] **Faz 1** — Migration `supabase/migrations/20261020000000_user_avatars.sql` (⚠️ canlıya UYGULANMADI — kullanıcı uygulayacak)
- [x] **Faz 2** — Çekirdek: `src/lib/avatar.ts`, `useAvatarUpload`, `useCoupleAvatars`, `components/avatar/{UserAvatar,AvatarActionSheet,EditableAvatar}`, paywall `avatar` kaynağı, AuthContext realtime invalidation
- [x] **Faz 3** — Tetikleyiciler: `menu.tsx` + `profile.tsx` avatarı → `<EditableAvatar />`
- [x] **Faz 4** — Takvim (`getAuthorAvatar` → `useCoupleAvatars`) + Ana Sayfa `<CoupleAvatarRing />` (hero kart üst satırı) & partner ruh hali rozeti (`dashboardData.partnerMood`)
- [x] **Faz 5** — Mektuplar (liste `personRow` avatarı + `PendingLettersCard` fotoğraflı mühür pulu) + Buluşmalar (`meetings.tsx` planlayan satırı, `MeetingCountdown` başlık avatarı; home meetings select'ine `user_id` eklendi)
- [x] **Faz 6** — Harita pinleri (not/buluşma pininde avatar, foto pininde yükleyen rozeti; `useFreezeAfterImageLoad`) · Yıldız ekranı: `StarInfoBadge` HUD'unda mini `<CoupleAvatarRing />` (en az bir foto varsa). 3D canvas'a gömme bilinçli olarak yapılmadı.
- [ ] ~~Faz 7 — Widget~~ (kapsam dışı)

## Sıradaki adım
Kod tarafı bitti. Kalanlar (kullanıcı):
1. **Migration'ı canlıya uygula:** `supabase/migrations/20261020000000_user_avatars.sql` → Supabase Dashboard › SQL Editor'e yapıştır & çalıştır (veya `supabase db push`).
   Uygulanana kadar uygulama çökmez; avatarlar harf olarak kalır, yükleme hata toast'ı verir.
2. **Cihazda test** (aşağıdaki kontrol listesi).
3. Sorun yoksa `develop`'a PR.

## Test kontrol listesi
- [ ] Demo modu: menü/ayarlar avatarına dokun → "Profilinizi Özelleştirmek İçin Ücretsiz Kayıt Olun 📸" daveti, izin istenmez.
- [ ] Ücretsiz hesap: avatar rozetinde 👑; dokununca `PremiumPaywall` ("Özel Profil Fotoğrafı"), kamera/galeri izni İSTENMEZ.
- [ ] Premium: kamera rozeti → alt menü (Çek / Galeriden Seç / Kaldır / Vazgeç); kare kırpma; yüklerken spinner; başarı toast'ı.
- [ ] Fotoğraf değiştir → menü, ayarlar, ana sayfa halkası anında güncellenir (önbellekte eski kalmaz).
- [ ] Partner telefonunda: ana sayfa halkası, takvim notu imzası, mektup pulu, buluşma imzası, harita pinleri yeni fotoğrafı gösterir.
- [ ] Kaldır → harf avatarına döner.
- [ ] Premium süresi dolunca → her yerde harf avatarı.
- [ ] Sunucu kalkanı (SQL Editor'den, premium'suz bir kullanıcı JWT'siyle veya RLS testiyle): `update users set avatar_url='https://x' ...` → reddedilir; başka kullanıcının klasörüne upload → reddedilir.

## Bilinen sınırlamalar / sonraki iyileştirmeler
- Premium'u biten ve fotoğrafı yüklü kullanıcı avatar menüsüne ulaşamadığı için "Kaldır"ı göremez (fotoğraf zaten gizli).
- Buluşmalarda partner adı yerine "Sevgilin" yazıyor (meetings ekranında partner adı sorgusu yok).
- Public bucket: URL'yi bilen herkes dosyayı açabilir (bilinçli karar; yol UUID içerdiği için tahmin edilemez).

## Mimari (Faz 2)
- **Tek doğruluk kaynağı:** `useCoupleAvatars()` → `{ myAvatarUrl, partnerAvatarUrl, getAvatarUrl(userId), hasStoredAvatar }`.
  Query key `["couple_avatars", coupleId]`. `profile.isPremium` false ise tüm URL'ler `null` döner (premium bitince gizleme).
  `avatar_url` bilinçli olarak `AuthContext.fetchProfile` select'ine EKLENMEDİ: migration uygulanmadan sütun seçilirse
  profil sorgusu komple düşüp uygulamayı bozardı. Ayrı sorgu hata alırsa sessizce `{}` döner.
- **Yükleme:** `useAvatarUpload()` → `openAvatarMenu` (demo → kayıt daveti, ücretsiz → paywall, premium → sheet),
  `uploadAvatar(source)` (en tepede sert `isPremium` kontrolü), `removeAvatar()`. `lib/avatar.uploadAvatar` da `isPremium` ister.
- **UI:** `<UserAvatar uri name size badge loading />` her yerde kullanılacak salt-görüntü bileşeni.
  `<EditableAvatar />` kendi avatarı için: kamera rozeti (premium) / taç rozeti (ücretsiz), sheet + paywall + demo modalı içinde.
- **Realtime:** AuthContext kanalı `users` tablosunda `couple_id=eq.X` UPDATE'lerinde `couple_avatars`'ı invalidate eder.

## Notlar
- `expo-image-manipulator` v57: `manipulateAsync` deprecated → `ImageManipulator.manipulate(uri).resize(...)` → `renderAsync()` → `saveAsync({ format, compress, base64 })`.
- `expo-image-picker` v57: `mediaTypes: ['images']`, `allowsEditing: true`, `aspect: [1, 1]` (iOS her zaman kare).
