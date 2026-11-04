-- ============================================================================
-- Yıldız bildirimi (report_star) geldiğinde destek@couplesky.app adresine e-posta uyarısı
-- ============================================================================
-- star_reports'a her yeni satırda report-alert Edge Function'ı çağrılır; fonksiyon bildirilen yıldızın
-- adını, kaç çiftin bildirdiğini ve adın gizlenip gizlenmediğini e-posta ile iletir. Böylece bildirimler
-- tabloya sessizce düşmez; ciddi bir şikayet tek bildirimle bile görülür ve 7 günlük inceleme taahhüdü
-- (Kullanım Koşulları, md. 8) izlenebilir.
--
-- Bildirim "en iyi çaba" işidir: e-posta gönderilemezse bildirim yine kaydedilir (bkz. push tetikleyicisi,
-- 20261101000000). Gizli anahtar Vault'taki PUSH_WEBHOOK_SECRET'tır (send-push ile aynı).
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.notify_star_report()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_secret text;
BEGIN
  BEGIN
    SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets
    WHERE name = 'PUSH_WEBHOOK_SECRET'
    LIMIT 1;

    IF v_secret IS NULL THEN
      RAISE WARNING 'Bildirim e-postası gönderilemedi (star_reports): PUSH_WEBHOOK_SECRET Vault içinde bulunamadı';
      RETURN NEW;
    END IF;

    PERFORM net.http_post(
      url     := 'https://vjnzoomngpwlkxwvixqs.supabase.co/functions/v1/report-alert',
      headers := jsonb_build_object(
        'Content-Type',     'application/json',
        'x-webhook-secret', v_secret
      ),
      body    := jsonb_build_object('star_id', NEW.star_id)
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Bildirim e-postası gönderilemedi (star_reports): %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_star_report() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_notify_star_report ON public.star_reports;
CREATE TRIGGER trg_notify_star_report
  AFTER INSERT ON public.star_reports
  FOR EACH ROW EXECUTE FUNCTION public.notify_star_report();

COMMIT;
