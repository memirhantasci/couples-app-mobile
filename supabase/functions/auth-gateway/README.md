# auth-gateway

Kullanıcı adıyla giriş ve şifre sıfırlama. Kullanıcı adının e-postası yalnızca sunucuda çözülür;
istemciye ne e-posta ne doğrulama kodu döner. Deneme sınırları `consume_auth_rate_limit()` ile
uygulanır (`supabase/migrations/20261022000004_encryption_overhaul.sql`). İstemci tarafı:
`src/lib/authGateway.ts`.

## Dağıtım (bir kez)

```bash
supabase db push                                   # migration'ı uygular
supabase functions deploy auth-gateway --no-verify-jwt
```

`--no-verify-jwt` gereklidir: fonksiyon oturum açılmadan (giriş / şifremi unuttum ekranlarından)
çağrılır ve projenin anahtarı JWT değil (`sb_publishable_...`).

## Supabase Auth ayarı

Şifre sıfırlama kodu Supabase Auth'un **Reset Password** e-postasıyla gider. Dashboard →
Authentication → Email Templates → *Reset Password* şablonunda kod yer almalı, ör.:

```html
<p>Şifre sıfırlama kodun: <strong>{{ .Token }}</strong></p>
```

## Uçlar

| `action`         | Gövde                              | Başarılı yanıt                      |
| ---------------- | ---------------------------------- | ----------------------------------- |
| `sign-in`        | `username`, `password`             | `access_token`, `refresh_token`     |
| `request-reset`  | `identifier` (kullanıcı adı/e-posta) | `{ ok: true }` (hesap yoksa da)   |
| `reset-password` | `identifier`, `code`, `password`   | `{ ok: true }`, diğer oturumlar kapanır |

Hata gövdesi `{ "error": "<kod>" }`: `invalid_credentials`, `email_not_confirmed` (yalnızca şifre
doğruyken, `email` ile), `too_many_requests`, `invalid_code`, `weak_password`, `unavailable`.
