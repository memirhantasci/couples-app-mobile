-- ============================================================================
-- Premium bitince yıldız: 14 günlük yenileme süresi, ardından sahiplik kaybı
-- ============================================================================
-- Kural (uygulamada ve yasal metinlerde de yazılıdır):
--   • Premium bittiğinde (iptal / ödeme alınamaması / süre bitimi) çifte, bitiş tarihinden (couples.premium_expires_at)
--     itibaren 14 gün verilir. Bu sürede hiçbir şey silinmez; Premium özellikleri kilitli kalır, yenilenirse her şey
--     olduğu gibi devam eder.
--   • 14 gün içinde yenilenmezse çiftin yıldızı serbest bırakılır: sahiplik kalkar (yıldız yeniden sahiplenilebilir),
--     ışıltı skoru ve günlük döküm sıfırlanır, kıvılcımlar ve anı gezegenleri silinir, yıldız bağlantıları kalkar.
--     Mektup, fotoğraf, günlük gibi diğer içerikler SİLİNMEZ.
--   • Süresiz Premium (premium_expires_at NULL) ve hiç Premium olmamış çiftler bu kuraldan etkilenmez.
--
-- Parçalar:
--   release_lapsed_star(couple)  → tek çiftin yıldızını bırakır (koşulu kendisi yeniden doğrular; yenilemeyle yarışmaz)
--   list_lapsed_stars(limit)     → süresi dolmuş çiftler
--   release-lapsed-stars Edge Function → önce anı gezegeni dosyalarını Storage API ile siler (SQL ile silmek dosyayı
--                                  depoda sahipsiz bırakır), sonra release_lapsed_star çağırır
--   pg_cron                      → günde bir kez (00:20 Türkiye) Edge Function'ı çağırır
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Bırakılan yıldızların kaydı (denetim: kimin yıldızı ne zaman, hangi gerekçeyle serbest kaldı)
CREATE TABLE IF NOT EXISTS public.star_lapse_releases (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  couple_id   INTEGER NOT NULL,
  catalog_id  BIGINT,
  premium_expired_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.star_lapse_releases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.star_lapse_releases FROM PUBLIC, anon, authenticated;

-- Yenileme süresi dolmuş mu? (has_active_premium false ve bitiş + 14 gün geçmiş)
CREATE OR REPLACE FUNCTION public.is_star_lapsed(p_couple_id INTEGER, p_grace INTERVAL DEFAULT INTERVAL '14 days')
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.couples AS c
     WHERE c.id = p_couple_id
       AND c.premium_expires_at IS NOT NULL
       AND c.premium_expires_at < NOW() - p_grace
       AND NOT public.has_active_premium(c.id)
  );
$$;

CREATE OR REPLACE FUNCTION public.list_lapsed_stars(p_limit INTEGER DEFAULT 20)
RETURNS TABLE (couple_id INTEGER)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT cs.couple_id
    FROM public.couple_stars AS cs
   WHERE public.is_star_lapsed(cs.couple_id)
   ORDER BY cs.couple_id
   LIMIT GREATEST(1, LEAST(p_limit, 100));
$$;

CREATE OR REPLACE FUNCTION public.release_lapsed_star(p_couple_id INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_star_id    UUID;
  v_catalog_id BIGINT;
  v_expired_at TIMESTAMPTZ;
BEGIN
  IF p_couple_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Aynı çift için eşzamanlı puan / sahiplik işlemleriyle sıralan
  PERFORM pg_advisory_xact_lock(hashtext('couple_activity_lock'), p_couple_id);

  -- Kilidi beklerken abonelik yenilenmiş olabilir: koşulu yeniden doğrula
  IF NOT public.is_star_lapsed(p_couple_id) THEN
    RETURN FALSE;
  END IF;

  SELECT cs.id, cs.catalog_id INTO v_star_id, v_catalog_id
    FROM public.couple_stars AS cs
   WHERE cs.couple_id = p_couple_id;

  IF v_star_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT c.premium_expires_at INTO v_expired_at FROM public.couples AS c WHERE c.id = p_couple_id;

  -- Yıldız bağlantıları (iki yönlü) ve bu çiftin gönderdiği istekler
  DELETE FROM public.star_connections AS sc
   WHERE sc.requested_by_couple_id = p_couple_id
      OR sc.star_a_id = v_star_id
      OR sc.star_b_id = v_star_id;

  -- Katalog kaydı yeniden sahiplenilebilir olur
  UPDATE public.celestial_catalog AS cc SET is_claimed = FALSE WHERE cc.id = v_catalog_id;

  -- Yıldız satırı: anı gezegenleri ve kıvılcımlar ON DELETE CASCADE ile silinir
  DELETE FROM public.couple_stars AS cs WHERE cs.id = v_star_id;

  -- Işıltı skoru ve günlük döküm sıfırlanır (aşk skorunun beslendiği couple_activity_log korunur)
  DELETE FROM public.couple_activity_score AS s WHERE s.couple_id = p_couple_id;
  DELETE FROM public.couple_daily_activity AS d WHERE d.couple_id = p_couple_id;

  INSERT INTO public.star_lapse_releases (couple_id, catalog_id, premium_expired_at)
  VALUES (p_couple_id, v_catalog_id, v_expired_at);

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.is_star_lapsed(INTEGER, INTERVAL) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.list_lapsed_stars(INTEGER)        FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_lapsed_star(INTEGER)      FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_star_lapsed(INTEGER, INTERVAL) TO service_role;
GRANT EXECUTE ON FUNCTION public.list_lapsed_stars(INTEGER)   TO service_role;
GRANT EXECUTE ON FUNCTION public.release_lapsed_star(INTEGER) TO service_role;

-- Edge Function'ı çağıran yardımcı (Vault'taki gizli anahtarla; send-push ile aynı desen)
CREATE OR REPLACE FUNCTION public.invoke_release_lapsed_stars()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_secret text;
BEGIN
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'PUSH_WEBHOOK_SECRET'
  LIMIT 1;

  IF v_secret IS NULL THEN
    RAISE EXCEPTION 'PUSH_WEBHOOK_SECRET Vault içinde bulunamadı';
  END IF;

  PERFORM net.http_post(
    url     := 'https://vjnzoomngpwlkxwvixqs.supabase.co/functions/v1/release-lapsed-stars',
    headers := jsonb_build_object(
      'Content-Type',     'application/json',
      'x-webhook-secret', v_secret
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
END;
$$;

REVOKE ALL ON FUNCTION public.invoke_release_lapsed_stars() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  v_job_id BIGINT;
BEGIN
  SELECT jobid INTO v_job_id FROM cron.job WHERE jobname = 'release-lapsed-stars' LIMIT 1;
  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_id);
  END IF;
END;
$$;

-- 21:20 UTC = 00:20 Türkiye
SELECT cron.schedule('release-lapsed-stars', '20 21 * * *', $cron$ SELECT public.invoke_release_lapsed_stars(); $cron$);

COMMIT;
