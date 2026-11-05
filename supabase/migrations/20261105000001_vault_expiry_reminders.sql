-- ============================================================================
-- Kasa süresi bitmeden önce bildirim (tam boy fotoğraf tasfiyesi)
-- ============================================================================
-- Kasa (subscription_status = 'vault') vault_until'de biter ve tam boy fotoğraflar, anı / gezegen görselleri
-- ile profil fotoğrafları kalıcı olarak silinir (bkz. 20261104000003_subscription_lifecycle.sql). Kullanıcı bunu
-- önceden duymadan verisini kaybetmesin diye iki aşamalı uyarı gönderilir:
--   aşama 7: tasfiyeye 7 günden az, 1 günden fazla kaldığında (kişi başına bir kez)
--   aşama 1: tasfiyeye 1 günden az kaldığında (kişi başına bir kez)
-- Tekrar gönderimi send-push, push_dedupe tablosuyla önler (anahtar: iş + aşama + token).
--
-- Çiftin her üyesinin (silme talebi bekleyenler hariç) push token'ına gider; mesaj token'ın dilindedir.
-- Cron günde bir kez, 10:00 TR (07:00 UTC) çalışır. Yalnızca bu migration'ın kendi işi yeniden kurulur;
-- diğer cron işlerine dokunulmaz.
--
-- Kurulum: bu migration + `supabase functions deploy send-push --no-verify-jwt`
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.get_vault_expiry_reminders()
RETURNS TABLE(couple_id INTEGER, user_id UUID, push_token TEXT, stage INTEGER, days_left INTEGER)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT c.id,
         u.id,
         pt.token,
         CASE WHEN c.vault_until - statement_timestamp() <= INTERVAL '1 day' THEN 1 ELSE 7 END,
         GREATEST(1, CEIL(EXTRACT(EPOCH FROM (c.vault_until - statement_timestamp())) / 86400.0))::INTEGER
    FROM public.couples AS c
    JOIN public.users AS u ON u.couple_id = c.id
    JOIN public.push_tokens AS pt ON pt.user_id = u.id
   WHERE c.subscription_status = 'vault'
     AND c.vault_until IS NOT NULL
     AND c.vault_until > statement_timestamp()
     AND c.vault_until <= statement_timestamp() + INTERVAL '7 days'
     AND NOT EXISTS (SELECT 1 FROM public.account_deletion_requests AS r WHERE r.user_id = u.id);
$$;

REVOKE ALL ON FUNCTION public.get_vault_expiry_reminders() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_vault_expiry_reminders() TO service_role;

DO $$
DECLARE
  v_job_id BIGINT;
BEGIN
  FOR v_job_id IN SELECT jobid FROM cron.job WHERE jobname = 'push-vault-expiry-reminder' LOOP
    PERFORM cron.unschedule(v_job_id);
  END LOOP;
END $$;

-- 10:00 TR (07:00 UTC), günde bir kez
SELECT cron.schedule('push-vault-expiry-reminder', '0 7 * * *',
  $cron$ SELECT public.invoke_cron_edge_function('{"type":"CRON","job":"vault_expiry_reminder"}'::jsonb); $cron$);

COMMIT;
