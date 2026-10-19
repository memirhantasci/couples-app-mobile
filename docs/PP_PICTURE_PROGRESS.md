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
- [ ] **Faz 6** — [x] Harita pinleri (not/buluşma pininde avatar, foto pininde yükleyen rozeti; `useFreezeAfterImageLoad`) · [ ] Yıldız ekranı
- [ ] ~~Faz 7 — Widget~~ (kapsam dışı)

## Sıradaki adım
Faz 6 (devam): Yıldız ekranı (`modules/stars/components/OurStarScreen.tsx` — çiftin fotoğrafları).

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
