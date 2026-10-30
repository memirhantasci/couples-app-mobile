-- ============================================================================
-- Hatırlatıcı RPC'leri: tür hataları, yinelenen bildirimler ve açık push token sızıntısı
-- ============================================================================
-- Canlıdaki altı get_*_reminders fonksiyonu (repoda yoktu) migration 003'ten ÖNCEKİ tamsayı kullanıcı
-- kimlikleriyle yazılmıştı. 003 bütün user_id/sender_id/receiver_id sütunlarını UUID yaptı; bu yüzden
--   • RETURNS TABLE(user_id integer …) bildirimleri UUID döndürürken "structure of query does not match
--     function result type" hatası verir,
--   • get_letter_unlock_reminders: DATE = TEXT, get_upcoming_meeting_reminders: TIMESTAMPTZ >= TEXT
--     "operator does not exist" hatası verir.
-- send-push hatayı yutup (`reminders && !error`) hiçbir şey göndermediği için altı zamanlanmış bildirim de
-- sessizce hiç çalışmadı. Üstelik fonksiyonlar SECURITY DEFINER, search_path'siz ve herkese açıktı:
-- anon anahtarıyla çağrılıp TÜM kullanıcıların push token'ları (ve görünen adları) okunabilirdi.
--
-- Bu migration:
--   1) Altı fonksiyonun EXECUTE yetkisini istemci rollerinden kaldırır (yalnızca service_role).
--   2) İlaç, buluşma, mektup kilidi ve regl hatırlatıcı cron'larını KAPATIR: bu hatırlatıcıları cihaz zaten
--      yerel bildirimle kurar (src/lib/reminderSync.ts, home.tsx). Sunucu işleri düzeltilse çift bildirim
--      gönderirdi. İlgili dört RPC (çalışmıyor, yetkisi kapalı) ileride gerekirse yeniden yazılır.
--   3) Yerel karşılığı olmayan iki hatırlatıcıyı (yıldönümü, hareketsizlik) doğru türlerle yeniden yazar.
-- ============================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Yetkiler: yalnızca service_role (send-push Edge Function)
-- ────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_sig TEXT;
BEGIN
  FOREACH v_sig IN ARRAY ARRAY[
    'public.get_active_medicine_reminders(text)',
    'public.get_active_period_reminders(text)',
    'public.get_letter_unlock_reminders(text)',
    'public.get_upcoming_meeting_reminders(text, text)',
    'public.get_anniversary_reminders(text, integer)',
    'public.get_inactivity_reminders(timestamp without time zone)'
  ]
  LOOP
    IF to_regprocedure(v_sig) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', v_sig);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', v_sig);
    END IF;
  END LOOP;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Yerel bildirimle zaten karşılanan hatırlatıcıların sunucu işlerini kapat
-- ────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_job RECORD;
BEGIN
  FOR v_job IN
    SELECT jobid FROM cron.job
     WHERE jobname IN ('push-medicine-reminder', 'push-meeting-reminder', 'push-letter-unlock', 'push-period-reminder')
  LOOP
    PERFORM cron.unschedule(v_job.jobid);
  END LOOP;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Yıldönümü hatırlatıcısı
--    send-push, bugünün "-AA-GG" eşleşmesini ve yılı verir; ilişki ve tanışma tarihleri (YYYY-MM-DD metin/tarih)
--    karşılaştırılır. Kayıt yılı bugünse (0. yıl dönümü) gönderilmez; iki tarih de bugüne denk gelirse
--    kişi başına tek bildirim (ilişki başlangıcı öncelikli).
-- ────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.get_anniversary_reminders(text, integer);

CREATE FUNCTION public.get_anniversary_reminders(match_str TEXT, current_year INTEGER)
RETURNS TABLE(couple_id INTEGER, user_id UUID, anniversary_type TEXT, years INTEGER, push_token TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT DISTINCT ON (u.id, pt.token)
         c.id,
         u.id,
         d.kind,
         current_year - y.yr,
         pt.token
    FROM public.couples AS c
    JOIN public.users AS u ON u.couple_id = c.id
    JOIN public.push_tokens AS pt ON pt.user_id = u.id
   CROSS JOIN LATERAL (
          VALUES (1, 'yıl dönümü', c.relationship_start_date::TEXT),
                 (2, 'tanışma yıl dönümü', c.meet_date::TEXT)
        ) AS d(priority, kind, value)
   CROSS JOIN LATERAL (
          SELECT CASE WHEN d.value ~ '^[0-9]{4}-' THEN substring(d.value FROM 1 FOR 4)::INTEGER END AS yr
        ) AS y
   WHERE d.value LIKE '%' || match_str
     AND y.yr IS NOT NULL
     AND current_year - y.yr > 0
     AND NOT EXISTS (SELECT 1 FROM public.account_deletion_requests AS r WHERE r.user_id = u.id)
   ORDER BY u.id, pt.token, d.priority;
$$;

REVOKE ALL ON FUNCTION public.get_anniversary_reminders(TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_anniversary_reminders(TEXT, INTEGER) TO service_role;

-- ────────────────────────────────────────────────────────────────────────────
-- 4. Hareketsizlik hatırlatıcısı
--    Eski sürüm login_logs tablosuna bakıyordu; Supabase Auth'a geçişten beri bu tablo doldurulmuyordu, yani
--    "hiç girişi yok" koşulu HERKES için doğruydu ve her kullanıcıya "seni özledik" gidecekti.
--    Etkinlik artık auth.users.last_sign_in_at ve auth.sessions.updated_at (oturum yenilemesi: uygulama
--    açıldıkça güncellenir) en büyüğüdür. Silme talebi bekleyen hesaplara gönderilmez.
-- ────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.get_inactivity_reminders(timestamp without time zone);

CREATE FUNCTION public.get_inactivity_reminders(three_days_ago_str TIMESTAMP WITHOUT TIME ZONE)
RETURNS TABLE(user_id UUID, push_token TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT u.id, pt.token
    FROM public.users AS u
    JOIN public.push_tokens AS pt ON pt.user_id = u.id
    JOIN auth.users AS au ON au.id = u.id
   WHERE GREATEST(
           au.last_sign_in_at,
           (SELECT max(s.updated_at) FROM auth.sessions AS s WHERE s.user_id = u.id)
         ) < (three_days_ago_str AT TIME ZONE 'UTC')
     AND NOT EXISTS (SELECT 1 FROM public.account_deletion_requests AS r WHERE r.user_id = u.id);
$$;

REVOKE ALL ON FUNCTION public.get_inactivity_reminders(TIMESTAMP WITHOUT TIME ZONE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_inactivity_reminders(TIMESTAMP WITHOUT TIME ZONE) TO service_role;

COMMIT;
