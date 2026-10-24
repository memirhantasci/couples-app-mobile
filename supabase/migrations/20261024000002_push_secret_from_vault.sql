-- send-push çağrılarındaki gömülü service_role anahtarını kaldırır.
-- Çağrılar artık Vault'taki PUSH_WEBHOOK_SECRET'ı x-webhook-secret başlığıyla gönderir.
-- invoke_cron_edge_function bir RPC olarak herkese açıktı; yetki kapatılır.

CREATE OR REPLACE FUNCTION public.invoke_cron_edge_function(payload jsonb)
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
    url     := 'https://vjnzoomngpwlkxwvixqs.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type',     'application/json',
      'x-webhook-secret', v_secret
    ),
    body    := payload
  );
END;
$$;

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
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'PUSH_WEBHOOK_SECRET'
  LIMIT 1;

  IF v_secret IS NULL THEN
    RAISE EXCEPTION 'PUSH_WEBHOOK_SECRET Vault içinde bulunamadı';
  END IF;

  payload := jsonb_build_object(
    'type',       TG_OP,
    'table',      TG_TABLE_NAME,
    'record',     row_to_json(NEW),
    'old_record', row_to_json(OLD)
  );

  PERFORM net.http_post(
    url     := 'https://vjnzoomngpwlkxwvixqs.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type',     'application/json',
      'x-webhook-secret', v_secret
    ),
    body    := payload
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.invoke_cron_edge_function(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.invoke_push_webhook() FROM PUBLIC, anon, authenticated;
