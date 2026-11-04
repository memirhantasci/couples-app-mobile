# report-alert

Bir kullanıcı "Bu Yıldızı Bildir"e bastığında (`star_reports` tablosuna yeni satır) destek adresine e-posta gönderir.
Tetikleyici: `supabase/migrations/20261104000001_star_report_alert.sql`. Uygulama bu fonksiyonu çağırmaz;
yalnızca veritabanı tetikleyicisi çağırır (Vault'taki `PUSH_WEBHOOK_SECRET` ile).

## Kurulum (bir kez)

1. [Resend](https://resend.com) hesabı açın (ücretsiz plan yeterli) ve bir API anahtarı oluşturun.
2. Gönderen adresi için ya `couplesky.app` alan adını Resend'de doğrulayın (DNS kayıtları) ya da hızlı başlangıç için
   Resend'i **destek@couplesky.app** ile açıp gönderen olarak `onboarding@resend.dev` kullanın (yalnızca hesap
   sahibinin adresine gönderebilir).
3. Sırları tanımlayın ve fonksiyonu yayınlayın:

```bash
supabase secrets set RESEND_API_KEY=re_xxx REPORT_ALERT_FROM="CoupleSky <bildirim@couplesky.app>"
supabase functions deploy report-alert --no-verify-jwt
supabase db push   # tetikleyiciyi kurar
```

`--no-verify-jwt` gereklidir: veritabanı tetikleyicisi oturum anahtarı taşımaz; fonksiyon ortak gizli anahtarı kendisi doğrular.

## Alıcı

Varsayılan alıcı `destek@couplesky.app`. Değiştirmek için `REPORT_ALERT_TO` sırrını tanımlayın.
