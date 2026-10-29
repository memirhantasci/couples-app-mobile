-- ============================================================================
-- MIGRATION: 20261029000003_audit_batch_cron_stars_rls_notes.sql
--
-- 4.3  Hesap silme cron'u: Edge Function Authorization / x-webhook-secret ister ama cron hiçbir
--      başlık göndermiyordu (her saat 401, hiçbir hesap silinmiyordu). Cron artık Vault'taki
--      sırrı gönderen bir fonksiyonu çağırır. Sır adı Edge Function'ın okuduğu ortam
--      değişkenleriyle aynıdır: DELETION_WEBHOOK_SECRET, yoksa PUSH_WEBHOOK_SECRET.
--
-- 5.1  Aşk Skoru: günlük notlar RLS yüzünden okuyana göre değişiyordu, iki partner farklı skor
--      görüyordu. get_couple_note_activity yalnızca "kaç farklı kişi yazdı" sayılarını döndürür
--      (içerik değil), her iki partnerde aynı sonucu verir.
--
-- 6.3  couple_stars: SELECT USING (true) herkesin tüm çiftlerin gizli yıldız adlarını okumasına
--      izin veriyordu. Okuma kendi çiftiyle sınırlanır; başka çiftlerin yıldızları zaten maskeli
--      RPC'lerle (get_stars_in_viewport vb.) okunur. UPDATE yolu 20261025000003'te kapatılmıştı;
--      burada güvence için yinelenir. Haritadan seçilen yıldızın kimliği için dar bir RPC eklenir.
--
-- 6.7  008'deki "Insert own data" / "Update own data" yalnızca user_id'yi doğruluyordu; başka
--      çiftin couple_id'si ile kayıt eklenebiliyordu. couple_id artık NULL ya da kendi çifti olmalı.
-- ============================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- 4.3 Hesap silme cron'u
-- ────────────────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.invoke_process_account_deletions()
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
  WHERE name IN ('DELETION_WEBHOOK_SECRET', 'PUSH_WEBHOOK_SECRET')
    AND decrypted_secret IS NOT NULL AND decrypted_secret <> ''
  ORDER BY (name = 'DELETION_WEBHOOK_SECRET') DESC
  LIMIT 1;

  IF v_secret IS NULL THEN
    RAISE EXCEPTION 'DELETION_WEBHOOK_SECRET / PUSH_WEBHOOK_SECRET Vault içinde bulunamadı';
  END IF;

  PERFORM net.http_post(
    url     := 'https://vjnzoomngpwlkxwvixqs.supabase.co/functions/v1/process-account-deletions',
    headers := jsonb_build_object(
      'Content-Type',     'application/json',
      'x-webhook-secret', v_secret
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
END;
$$;

REVOKE ALL ON FUNCTION public.invoke_process_account_deletions() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  v_job_id BIGINT;
BEGIN
  SELECT jobid INTO v_job_id FROM cron.job WHERE jobname = 'process-account-deletions' LIMIT 1;
  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_id);
  END IF;
END;
$$;

SELECT cron.schedule(
  'process-account-deletions',
  '17 * * * *',
  $cron$ SELECT public.invoke_process_account_deletions(); $cron$
);


-- ────────────────────────────────────────────────────────────────────────────
-- 5.1 Aşk Skoru: günlük / takvim notu etkinliği (sayılar, içerik değil)
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_couple_note_activity(p_today date, p_since date)
RETURNS TABLE (daily_authors_today integer, calendar_authors_recent integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    (SELECT count(DISTINCT dn.user_id)::integer
       FROM public.daily_notes AS dn
       JOIN public.users AS u ON u.id = dn.user_id
      WHERE u.couple_id = public.get_my_couple_id()
        AND dn.date = p_today),
    (SELECT count(DISTINCT cn.user_id)::integer
       FROM public.calendar_notes AS cn
      WHERE cn.couple_id = public.get_my_couple_id()
        AND cn.date >= p_since);
$$;

REVOKE ALL ON FUNCTION public.get_couple_note_activity(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_couple_note_activity(date, date) TO authenticated;


-- ────────────────────────────────────────────────────────────────────────────
-- 6.3 couple_stars
-- ────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "couple_stars_read_all" ON public.couple_stars;
DROP POLICY IF EXISTS "couple_stars_select_own" ON public.couple_stars;
CREATE POLICY "couple_stars_select_own"
  ON public.couple_stars
  FOR SELECT
  TO authenticated
  USING (couple_id = (SELECT public.get_my_couple_id()));

DROP POLICY IF EXISTS "couple_stars_update_own" ON public.couple_stars;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.couple_stars FROM anon, authenticated;
REVOKE ALL ON public.couple_stars FROM anon;

-- Haritada seçilen (başkasının olabilecek) yıldızın kimliği: ad ve çift bilgisi sızdırılmaz
CREATE OR REPLACE FUNCTION public.get_star_id_by_catalog_id(p_catalog_id bigint)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT cs.id
  FROM public.couple_stars AS cs
  WHERE cs.catalog_id = p_catalog_id
    AND auth.uid() IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.get_star_id_by_catalog_id(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_star_id_by_catalog_id(bigint) TO authenticated;


-- ────────────────────────────────────────────────────────────────────────────
-- 6.7 Insert / Update own data: couple_id de doğrulanır
-- ────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['daily_notes', 'moods', 'medicines', 'medicine_logs', 'period_logs']
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = t AND column_name = 'user_id'
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = t AND column_name = 'couple_id'
    ) THEN
      -- couple_id NULL kalabilir: günlük notlar couple_id'siz eklenir, mod eşleşmeden önce de
      -- seçilebilir. NULL satırı hiçbir çift okuyamaz; engellenen yalnızca başka çiftin kimliğidir.
      EXECUTE format('DROP POLICY IF EXISTS "Insert own data" ON public.%I', t);
      EXECUTE format(
        'CREATE POLICY "Insert own data" ON public.%I FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()) AND (couple_id IS NULL OR couple_id = (SELECT public.get_my_couple_id())))',
        t
      );

      EXECUTE format('DROP POLICY IF EXISTS "Update own data" ON public.%I', t);
      EXECUTE format(
        'CREATE POLICY "Update own data" ON public.%I FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()) AND (couple_id IS NULL OR couple_id = (SELECT public.get_my_couple_id())))',
        t
      );
    END IF;
  END LOOP;
END $$;

COMMIT;
