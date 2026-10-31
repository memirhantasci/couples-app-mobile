-- ============================================================================
-- Push tetikleyicisi kullanıcının kaydını ASLA engellemesin
-- ============================================================================
-- invoke_push_webhook() letters, medicine_logs, moods, period_logs, meetings, memories, calendar_notes ve
-- couples tablolarındaki AFTER tetikleyicilerinden çağrılır. Eski sürüm Vault'ta PUSH_WEBHOOK_SECRET
-- bulunamazsa (ya da pg_net / JSON üretimi hata verirse) EXCEPTION fırlatıyordu; AFTER tetikleyicideki hata
-- ise tüm INSERT'i geri alır. Sonuç: bildirim altyapısındaki bir aksaklık yüzünden kullanıcı takvime not
-- yazamıyor, mektup/ruh hali/buluşma kaydedemiyordu — ve uygulama hatayı sessizce yuttuğu için nedenini
-- kimse göremiyordu.
--
-- Bildirim "en iyi çaba" işidir: gönderilemezse kayıt yine de tamamlanır, sorun yalnızca veritabanı
-- günlüğüne uyarı olarak düşer (Supabase → Logs → Postgres).
-- Fonksiyon imzası, SECURITY DEFINER ve yetkiler değişmez; mevcut tetikleyiciler olduğu gibi çalışmaya devam eder.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.invoke_push_webhook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_secret text;
  payload  jsonb;
BEGIN
  BEGIN
    SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets
    WHERE name = 'PUSH_WEBHOOK_SECRET'
    LIMIT 1;

    IF v_secret IS NULL THEN
      RAISE WARNING 'Push gönderilemedi (%.% %): PUSH_WEBHOOK_SECRET Vault içinde bulunamadı',
        TG_TABLE_NAME, TG_OP, TG_WHEN;
      RETURN NEW;
    END IF;

    payload := jsonb_build_object(
      'type',       TG_OP,
      'table',      TG_TABLE_NAME,
      'record',     row_to_json(NEW),
      'old_record', CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE row_to_json(OLD) END
    );

    PERFORM net.http_post(
      url     := 'https://vjnzoomngpwlkxwvixqs.supabase.co/functions/v1/send-push',
      headers := jsonb_build_object(
        'Content-Type',     'application/json',
        'x-webhook-secret', v_secret
      ),
      body    := payload
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Push gönderilemedi (%.% %): %', TG_TABLE_NAME, TG_OP, TG_WHEN, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.invoke_push_webhook() FROM PUBLIC, anon, authenticated;
