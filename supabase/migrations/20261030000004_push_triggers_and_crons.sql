-- ============================================================================
-- Push bildirimlerinin tetikleyicileri ve zamanlanmış işleri (repoda ilk kez)
-- ============================================================================
-- send-push Edge Function iki yoldan çağrılır ve bunların hiçbirinin kaydı şimdiye kadar migration'larda
-- yoktu (panelden elle kurulmuştu; yeniden kurulamaz, doğrulanamazdı):
--   1) Veritabanı tetikleyicileri → invoke_push_webhook(): anlık bildirimler
--   2) pg_cron işleri → invoke_cron_edge_function(): zamanlanmış hatırlatıcılar
--
-- Bu migration İDEMPOTENTTİR ve "canlıdaki ne olursa olsun" aynı sonucu verir:
--   • Aşağıdaki tablolardaki mevcut push tetikleyicileri (invoke_push_webhook ya da send-push'a giden herhangi
--     bir webhook) silinip aşağıdaki tek sürümle yeniden kurulur (çift bildirim olmaz; moods'ta daha önce olmuştu).
--   • send-push'a giden mevcut pg_cron işleri silinip aşağıdaki altı iş kurulur.
-- Hatırlatıcı RPC'leri (get_active_medicine_reminders, get_active_period_reminders, get_letter_unlock_reminders,
-- get_upcoming_meeting_reminders, get_anniversary_reminders, get_inactivity_reminders) bu repoda tanımlı DEĞİLDİR;
-- canlı veritabanında bulunmaları gerekir (kontrol sorgusu: raporun "Kalan işler" bölümü).
--
-- Saatler UTC'dir; Türkiye = UTC+3.
-- Çift gönderimi önlemek için send-push, push_dedupe tablosuyla aynı bildirimi tekrar göndermez.
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ────────────────────────────────────────────────────────────────────────────
-- 0. Gönderilmiş bildirimlerin kaydı (yalnızca service_role / Edge Function)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.push_dedupe (
  key     TEXT PRIMARY KEY,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_push_dedupe_sent_at ON public.push_dedupe (sent_at);
ALTER TABLE public.push_dedupe ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.push_dedupe FROM PUBLIC, anon, authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Anlık bildirim tetikleyicileri
-- ────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_rec RECORD;
  v_spec RECORD;
BEGIN
  -- Mevcut push tetikleyicilerini temizle
  FOR v_rec IN
    SELECT t.tgname, c.relname
      FROM pg_trigger AS t
      JOIN pg_class AS c ON c.oid = t.tgrelid
      JOIN pg_namespace AS n ON n.oid = c.relnamespace
     WHERE NOT t.tgisinternal
       AND n.nspname = 'public'
       AND c.relname IN ('letters', 'medicine_logs', 'moods', 'period_logs', 'meetings', 'memories', 'calendar_notes', 'couples')
       AND (pg_get_triggerdef(t.oid) ILIKE '%invoke_push_webhook%' OR pg_get_triggerdef(t.oid) ILIKE '%send-push%')
  LOOP
    EXECUTE format('DROP TRIGGER %I ON public.%I', v_rec.tgname, v_rec.relname);
  END LOOP;

  -- Tek sürümü kur (send-push hangi olayı bekliyorsa onu: letters/period_logs/meetings/memories/calendar_notes
  -- INSERT; medicine_logs INSERT+UPDATE (DRANK'e geçiş); moods INSERT+UPDATE; couples UPDATE (eşleşme))
  FOR v_spec IN
    SELECT * FROM (VALUES
      ('letters',        'INSERT'),
      ('medicine_logs',  'INSERT OR UPDATE'),
      ('moods',          'INSERT OR UPDATE'),
      ('period_logs',    'INSERT'),
      ('meetings',       'INSERT'),
      ('memories',       'INSERT'),
      ('calendar_notes', 'INSERT'),
      ('couples',        'UPDATE')
    ) AS s(tbl, events)
  LOOP
    IF to_regclass('public.' || v_spec.tbl) IS NOT NULL THEN
      EXECUTE format(
        'CREATE TRIGGER %I AFTER %s ON public.%I FOR EACH ROW EXECUTE FUNCTION public.invoke_push_webhook()',
        'push_on_' || v_spec.tbl, v_spec.events, v_spec.tbl
      );
    ELSE
      RAISE NOTICE 'Tablo yok, tetikleyici atlandı: %', v_spec.tbl;
    END IF;
  END LOOP;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Zamanlanmış hatırlatıcılar
-- ────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_job RECORD;
BEGIN
  -- send-push'a giden mevcut işleri kaldır (account deletion / yıldız işlerine dokunulmaz)
  FOR v_job IN
    SELECT jobid FROM cron.job
     WHERE command ILIKE '%invoke_cron_edge_function%' OR command ILIKE '%functions/v1/send-push%'
  LOOP
    PERFORM cron.unschedule(v_job.jobid);
  END LOOP;
END $$;

-- İlaç: send-push anı "SS:DD" olarak Türkiye saatine çevirip ilaç saatiyle birebir eşler → her dakika
SELECT cron.schedule('push-medicine-reminder', '* * * * *',
  $cron$ SELECT public.invoke_cron_edge_function('{"type":"CRON","job":"medicine_reminder"}'::jsonb); $cron$);

-- Mektup kilidi: Türkiye saatiyle gece yarısından hemen sonra (00:01 TR = 21:01 UTC)
SELECT cron.schedule('push-letter-unlock', '1 21 * * *',
  $cron$ SELECT public.invoke_cron_edge_function('{"type":"CRON","job":"letter_unlock"}'::jsonb); $cron$);

-- Regl hatırlatıcısı ve yıldönümü: sabah 09:00 TR (06:00 UTC)
SELECT cron.schedule('push-period-reminder', '0 6 * * *',
  $cron$ SELECT public.invoke_cron_edge_function('{"type":"CRON","job":"period_reminder"}'::jsonb); $cron$);
SELECT cron.schedule('push-anniversary-reminder', '5 6 * * *',
  $cron$ SELECT public.invoke_cron_edge_function('{"type":"CRON","job":"anniversary_reminder"}'::jsonb); $cron$);

-- Buluşma (2 saat önceden): 10 dakikada bir; aynı buluşma için tekrar gönderilmez (push_dedupe)
SELECT cron.schedule('push-meeting-reminder', '*/10 * * * *',
  $cron$ SELECT public.invoke_cron_edge_function('{"type":"CRON","job":"meeting_reminder"}'::jsonb); $cron$);

-- Hareketsizlik: akşam 18:00 TR (15:00 UTC); kişi başına en fazla haftada bir (push_dedupe)
SELECT cron.schedule('push-inactivity-reminder', '0 15 * * *',
  $cron$ SELECT public.invoke_cron_edge_function('{"type":"CRON","job":"inactivity_reminder"}'::jsonb); $cron$);

-- push_dedupe 14 günden eski kayıtları siler
SELECT cron.schedule('purge-push-dedupe', '37 3 * * *',
  $cron$ DELETE FROM public.push_dedupe WHERE sent_at < now() - interval '14 days'; $cron$);

COMMIT;
