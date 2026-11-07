-- ============================================================================
-- Sign in with Apple: hesap silinirken Apple'a token iptali (revoke) için refresh token deposu
-- ----------------------------------------------------------------------------
-- Apple, Apple ile giriş sunan uygulamalarda hesap silinince kullanıcının Apple'daki bağlantısının
-- (Ayarlar > Apple Kimliği > Apple ile Giriş Yapan Uygulamalar) kaldırılmasını şart koşar (App Review 5.1.1(v)).
-- İptal için Apple'ın refresh token'ı gerekir; bu, uygulamanın girişte aldığı authorizationCode'un Edge Function
-- (apple-link) tarafından Apple'a gönderilmesiyle elde edilir ve burada saklanır. Yalnızca service_role okur/yazar;
-- istemci rollerinin hiçbir yetkisi yoktur (RLS açık, politika yok).
-- Silme hattı (process-account-deletions) iptali, kullanıcı verisi silinmeden ÖNCE yapar.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.apple_auth_tokens (
  user_id       UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  refresh_token TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.apple_auth_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.apple_auth_tokens FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.apple_auth_tokens TO service_role;

COMMENT ON TABLE public.apple_auth_tokens IS
  'Apple refresh token (yalnızca hesap silme sırasında Apple bağlantısını iptal etmek için). Sadece service_role.';

COMMIT;
