-- ============================================================================
-- İstemci hata günlüğü: üretimde çöken / hata veren ekranları görebilmek için
-- ============================================================================
-- Giriş yapmış kullanıcı yalnızca KENDİ adına satır ekleyebilir; kimse istemciden okuyamaz
-- (satırlar Supabase panelinden / service_role ile incelenir). Mesaj ve yığın uzunlukları sınırlıdır.
-- Mektup/günlük içeriği gibi kişisel veri bu tabloya yazılmaz (istemci yalnızca hata metni ve ekran adı yollar).
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.client_errors (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  message     TEXT NOT NULL CHECK (char_length(message) <= 500),
  stack       TEXT CHECK (char_length(stack) <= 4000),
  context     TEXT CHECK (char_length(context) <= 100),
  app_version TEXT CHECK (char_length(app_version) <= 30),
  platform    TEXT CHECK (char_length(platform) <= 20),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_errors_created_at ON public.client_errors(created_at DESC);

ALTER TABLE public.client_errors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Insert own client errors" ON public.client_errors;
CREATE POLICY "Insert own client errors"
  ON public.client_errors
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

REVOKE ALL ON public.client_errors FROM PUBLIC, anon;
GRANT INSERT ON public.client_errors TO authenticated;

COMMIT;
