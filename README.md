# CoupleSky

Çiftler için anı defteri, zaman kilitli mektuplar, takvim, harita ve ortak yıldız gökyüzü uygulaması
(Expo SDK 57 · React Native 0.86 · Supabase · RevenueCat · AdMob). Türkçe ve İngilizce.

## Geliştirme

```bash
npm install
cp .env.example .env     # Supabase / Maps / RevenueCat / AdMob değerlerini doldur
npx expo start           # geliştirme istemcisi (Expo Go yetmez: yerel modüller var)
npm run lint
npx tsc --noEmit
npm test
```

Ortam değişkenleri üretim derlemelerinde EAS ortamından gelir (`eas.json` → `environment: production`).

## Dizin

| Yol | İçerik |
| :-- | :-- |
| `src/app` | Expo Router ekranları |
| `src/modules/stars` | Ortak yıldız / gökyüzü modülü (Skia) |
| `src/locales` | `tr.json` / `en.json` (tip güvenli çeviri anahtarları) |
| `supabase/migrations` | Veritabanı şeması, RLS ve RPC'ler (dosya adı sırasıyla uygulanır) |
| `supabase/functions` | Edge Function'lar: `auth-gateway`, `send-push`, `process-account-deletions`, `revenuecat-webhook` |
| `plugins`, `widgets` | Android / iOS ana ekran widget'ları |
| `docs/legal` | Mağaza formları için herkese açık yasal sayfalar (`node scripts/build-legal-pages.js` ile üretilir) |

## Yayın notları

- Premium durumunu yalnızca `revenuecat-webhook` yazar (`REVENUECAT_WEBHOOK_SECRET`, `--no-verify-jwt` ile dağıtılır).
- Yerel (native) bağımlılık, eklenti ya da izin değişince `app.json` içindeki `version` artırılmalıdır
  (`runtimeVersion` politikası `appVersion`); aksi halde OTA güncellemesi eski ikilik dosyalarda hata verir.
- `docs/legal` değiştiyse sayfaları yeniden üretip yayınlayın.
