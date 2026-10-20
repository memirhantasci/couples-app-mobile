# 🧩 Ana Ekran Widget'ı — İlerleme Takibi

Branch: `widget-picture` · Her faz ayrı commit. Token biterse buradan devam edilir.

## Kararlar
- **Tamamı Premium:** ücretsiz kullanıcıda widget "Premium'a özel 👑" kilit görünümünü gösterir (tıklayınca `/paywall`).
  Premium bitiş zamanı (`premiumUntil`) payload'da taşınır; uygulama açılmasa bile widget o anda kendini kilitler.
- **İçerik:** gün sayacı + çift fotoğrafı + partnerin (bugünkü) ruh hali. Özel günlük notu ARTIK widget'a gitmez (gizlilik).
- **Platformlar:** iOS (`expo-widgets`, küçük/orta + kilit ekranı accessory) ve Android (kendi config plugin'imiz, native Kotlin).
- Gün sayısı **widget içinde hesaplanır** (`startDate`'ten): uygulama günlerce açılmasa da doğru kalır.
- Çıkış/hesap silme → widget temizlenir (`signedOut` durumu + fotoğraf dosyaları silinir).

## Veri sözleşmesi (JS → iOS & Android)
`CoupleWidgetPayload` → `src/utils/widgetBridge.ts`:
`state: 'ready' | 'locked' | 'signedOut'`, `myName`, `partnerName`, `startDate (YYYY-MM-DD|null)`,
`premiumUntil (ISO|null)`, `partnerMoodEmoji`, `partnerMoodLabel`, `moodDate`, `myAvatarPath`, `partnerAvatarPath`.

## Fazlar
- [ ] **Faz 1** — `widgetBridge.ts` yeniden yazımı (payload, avatar indirme, temizleme) + çağrı noktaları (home, çıkış, arka plan)
- [ ] **Faz 2** — iOS widget (`widgets/CoupleWidget.tsx`: small/medium/accessory, timeline, kilit durumu, deep link)
- [ ] **Faz 3** — Android widget (plugin yeniden yazımı: Kotlin dosyaları `plugins/android-widget/`, 2 layout, kilit durumu, tarih değişimi)
- [ ] **Faz 4** — Doğrulama (`expo prebuild` ile iki platform, tsc, lint) + telefon test listesi

## Sıradaki adım
Faz 1.

## Telefonda test (EAS development/preview build şart — Expo Go'da widget çalışmaz)
(Faz 4'te doldurulacak)
