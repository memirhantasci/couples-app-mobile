-- ============================================================================
-- Ödüllü reklam sunucu tarafı doğrulaması (AdMob SSV): kayıt tablosu ve ödül fonksiyonu
-- ----------------------------------------------------------------------------
-- DURUM (2026-11-13): YAZILDI, CANLIYA UYGULANMADI. Etkinleştirme: supabase/functions/admob-ssv/README.md
--
-- Bugün reklam ödülünü istemci earn_tokens('ad_reward') ile kendisi ister; sunucu reklamın izlendiğini
-- doğrulayamaz (tek önlem 24 saatte 25 ödül). SSV'de AdMob, reklam bitince admob-ssv Edge Function'ına imzalı
-- istek gönderir; token'ı yalnızca bu fonksiyon yazar.
--
-- Yalnızca ekler: yeni tablo ve yeni fonksiyon (yalnızca service_role). earn_tokens'a DOKUNMAZ; eski sürümler
-- aynen çalışır. earn_tokens'ın istemci yetkisi ancak SSV'li istemci yayıldıktan sonra ayrı bir adımla alınır.
--
-- Kurallar earn_tokens ile aynı: ödül 25 jeton, kullanıcı başına 24 saatte en çok 25 ödül (iki yol birlikte
-- sayılır, aynı kilit). Ek olarak işlem kimliği (transaction_id) tekildir: AdMob aynı isteği yinelerse ya da
-- biri yakaladığı geçerli isteği yeniden gönderirse ikinci kez ödül yazılmaz.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.ad_reward_callbacks (
  transaction_id TEXT PRIMARY KEY,
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ad_unit        TEXT,
  result         TEXT NOT NULL CHECK (result IN ('granted', 'limit')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ad_reward_callbacks_user ON public.ad_reward_callbacks (user_id, created_at DESC);

ALTER TABLE public.ad_reward_callbacks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ad_reward_callbacks FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.ad_reward_callbacks TO service_role;

-- Dönüş: 'granted' | 'duplicate' | 'limit' | 'unknown_user'
CREATE OR REPLACE FUNCTION public.grant_ad_reward_ssv(p_user_id UUID, p_transaction_id TEXT, p_ad_unit TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_amount      CONSTANT INTEGER := 25;
  v_daily_limit CONSTANT INTEGER := 25;
  v_today_count INTEGER;
  v_result      TEXT;
BEGIN
  IF p_user_id IS NULL OR p_transaction_id IS NULL OR btrim(p_transaction_id) = '' THEN
    RAISE EXCEPTION 'Geçersiz istek' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.users AS u WHERE u.id = p_user_id) THEN
    RETURN 'unknown_user';
  END IF;

  -- earn_tokens ile AYNI kilit: iki yoldan gelen ödüller sırayla sayılır
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('earn_tokens:' || p_user_id::text, 0));

  IF EXISTS (SELECT 1 FROM public.ad_reward_callbacks AS c WHERE c.transaction_id = p_transaction_id) THEN
    RETURN 'duplicate';
  END IF;

  SELECT count(*) INTO v_today_count
    FROM public.token_transactions AS t
   WHERE t.user_id = p_user_id
     AND t.reason = 'ad_reward'
     AND t.created_at >= (statement_timestamp() - interval '24 hours');

  v_result := CASE WHEN v_today_count >= v_daily_limit THEN 'limit' ELSE 'granted' END;

  -- Başka kullanıcının kilidi altında aynı işlem kimliği gelirse birincil anahtar ikincisini durdurur
  INSERT INTO public.ad_reward_callbacks (transaction_id, user_id, ad_unit, result)
  VALUES (p_transaction_id, p_user_id, p_ad_unit, v_result)
  ON CONFLICT (transaction_id) DO NOTHING;
  IF NOT FOUND THEN
    RETURN 'duplicate';
  END IF;

  IF v_result = 'granted' THEN
    PERFORM set_config('app.allow_token_change', 'true', true);
    UPDATE public.users AS u
       SET token_balance = COALESCE(u.token_balance, 0) + v_amount
     WHERE u.id = p_user_id;
    INSERT INTO public.token_transactions (user_id, amount, reason)
    VALUES (p_user_id, v_amount, 'ad_reward');
  END IF;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_ad_reward_ssv(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_ad_reward_ssv(UUID, TEXT, TEXT) TO service_role;

COMMIT;
