-- ============================================================================
-- Partner bilgilendirmesi: hesap silme talebi, vazgeçme ve çiftin dağılması
-- ============================================================================
-- Biri hesabını silince çiftin ortak verisi (anılar, mektuplar, fotoğraflar, günlükler, yıldız)
-- silinir ve partner çiftten ayrılır. Bu sırada partnere hiçbir şey söylenmiyordu.
--
-- partner_notices: partnere gösterilecek bildirimler.
--   deletion_requested : partner hesabını silmek istedi (scheduled_for: silinme zamanı)
--   deletion_cancelled : partner silmekten vazgeçti
--   couple_dissolved   : hesap silindi, ortak veriler silindi, çift dağıldı
-- Satırlar yalnızca bu dosyadaki RPC'ler ve purge_account_data tarafından yazılır; kullanıcı kendi
-- satırlarını okuyabilir ve ack_partner_notice() ile "gördüm" diye işaretler.
-- Her yeni satır, push bildirimini send-push Edge Function'a bir DB tetikleyicisiyle iletir
-- (gönderim hatası talebi/silmeyi asla engellemez).
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.partner_notices (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL CHECK (kind IN ('deletion_requested', 'deletion_cancelled', 'couple_dissolved')),
  scheduled_for TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  seen_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_partner_notices_unseen ON public.partner_notices (user_id) WHERE seen_at IS NULL;

ALTER TABLE public.partner_notices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS partner_notices_select_own ON public.partner_notices;
CREATE POLICY partner_notices_select_own ON public.partner_notices
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

REVOKE ALL ON public.partner_notices FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.partner_notices TO authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- Gördüm işareti
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.ack_partner_notice(p_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Oturum bulunamadı.' USING ERRCODE = '42501';
  END IF;
  UPDATE public.partner_notices AS n
     SET seen_at = NOW()
   WHERE n.id = p_id AND n.user_id = auth.uid() AND n.seen_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.ack_partner_notice(BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ack_partner_notice(BIGINT) TO authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- Push tetikleyicisi (hata yutulur: bildirim gidemese de asıl işlem tamamlanır)
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_partner_notice()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_secret TEXT;
BEGIN
  BEGIN
    SELECT decrypted_secret INTO v_secret
      FROM vault.decrypted_secrets
     WHERE name = 'PUSH_WEBHOOK_SECRET'
     LIMIT 1;

    IF v_secret IS NOT NULL THEN
      PERFORM net.http_post(
        url     := 'https://vjnzoomngpwlkxwvixqs.supabase.co/functions/v1/send-push',
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secret),
        body    := jsonb_build_object('type', 'INSERT', 'table', 'partner_notices', 'record', row_to_json(NEW))
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_partner_notice() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_notify_partner_notice ON public.partner_notices;
CREATE TRIGGER trg_notify_partner_notice
  AFTER INSERT ON public.partner_notices
  FOR EACH ROW EXECUTE FUNCTION public.notify_partner_notice();

-- ────────────────────────────────────────────────────────────────────────────
-- Silme talebi: partnere haber ver
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.request_account_deletion()
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid       UUID := auth.uid();
  v_when      TIMESTAMPTZ;
  v_couple_id INTEGER;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Oturum bulunamadı.' USING ERRCODE = '42501';
  END IF;

  -- Tekrar çağrılırsa ilk talebin zamanı korunur ve partnere ikinci kez haber verilmez
  INSERT INTO public.account_deletion_requests AS r (user_id, scheduled_for)
  VALUES (v_uid, NOW() + INTERVAL '7 days')
  ON CONFLICT (user_id) DO NOTHING
  RETURNING r.scheduled_for INTO v_when;

  IF v_when IS NULL THEN
    SELECT r.scheduled_for INTO v_when FROM public.account_deletion_requests AS r WHERE r.user_id = v_uid;
  ELSE
    SELECT u.couple_id INTO v_couple_id FROM public.users AS u WHERE u.id = v_uid;
    IF v_couple_id IS NOT NULL THEN
      INSERT INTO public.partner_notices (user_id, kind, scheduled_for)
      SELECT u.id, 'deletion_requested', v_when
        FROM public.users AS u
       WHERE u.couple_id = v_couple_id AND u.id <> v_uid;
    END IF;
  END IF;

  -- Silinmek üzere olan hesabın hiçbir cihazına artık bildirim gitmesin
  DELETE FROM public.push_tokens AS t WHERE t.user_id = v_uid;

  RETURN v_when;
END;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- Vazgeçme: partnerin "silinecek" bildirimi kalkar, vazgeçildiği söylenir
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cancel_account_deletion()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid       UUID := auth.uid();
  v_couple_id INTEGER;
  v_removed   BIGINT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Oturum bulunamadı.' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.account_deletion_requests AS r WHERE r.user_id = v_uid;
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  SELECT u.couple_id INTO v_couple_id FROM public.users AS u WHERE u.id = v_uid;
  IF v_couple_id IS NOT NULL THEN
    DELETE FROM public.partner_notices AS n
     WHERE n.kind = 'deletion_requested'
       AND n.user_id IN (SELECT u.id FROM public.users AS u WHERE u.couple_id = v_couple_id AND u.id <> v_uid);
    GET DIAGNOSTICS v_removed = ROW_COUNT;

    IF v_removed > 0 THEN
      INSERT INTO public.partner_notices (user_id, kind)
      SELECT u.id, 'deletion_cancelled'
        FROM public.users AS u
       WHERE u.couple_id = v_couple_id AND u.id <> v_uid;
    END IF;
  END IF;

  RETURN TRUE;
END;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- purge_account_data: çift dağılırken partnere "couple_dissolved" bırak
-- (20261022000000'daki tanımın aynısı + 3.3'te bildirim satırı)
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.purge_account_data(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_couple_id    INTEGER;
  v_couple_rows  BIGINT := 0;
  v_user_rows    BIGINT := 0;
  v_targets      TEXT[];
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id boş olamaz.';
  END IF;

  -- Cron ve elle tetikleme aynı anda aynı hesabı temizlemesin
  PERFORM pg_advisory_xact_lock(hashtext('purge_account_data'), hashtext(p_user_id::text));

  -- Kullanıcının ve partnerinin couple_id'si korumalı sütundur (018 trigger'ı)
  PERFORM set_config('app.allow_couple_change', 'on', true);

  SELECT u.couple_id INTO v_couple_id FROM public.users AS u WHERE u.id = p_user_id;

  IF v_couple_id IS NOT NULL THEN
    -- 3.1 Yıldız: bağlantılar (requested_by_couple_id silme eylemsiz) ve katalog kaydı boşa çıkar
    DELETE FROM public.star_connections AS sc
     WHERE sc.requested_by_couple_id = v_couple_id
        OR sc.star_a_id IN (SELECT cs.id FROM public.couple_stars AS cs WHERE cs.couple_id = v_couple_id)
        OR sc.star_b_id IN (SELECT cs.id FROM public.couple_stars AS cs WHERE cs.couple_id = v_couple_id);

    UPDATE public.celestial_catalog AS cc
       SET is_claimed = FALSE
     WHERE cc.id IN (SELECT cs.catalog_id FROM public.couple_stars AS cs WHERE cs.couple_id = v_couple_id);

    -- 3.2 couple_id sütunu taşıyan her tablo (mektuplar, fotoğraflar, günlükler, yıldız...)
    SELECT array_agg(cl.relname || '.couple_id' ORDER BY cl.relname)
      INTO v_targets
      FROM pg_catalog.pg_attribute AS att
      JOIN pg_catalog.pg_class AS cl ON cl.oid = att.attrelid
      JOIN pg_catalog.pg_namespace AS ns ON ns.oid = cl.relnamespace
     WHERE ns.nspname = 'public'
       AND cl.relkind IN ('r', 'p')
       AND att.attname = 'couple_id'
       AND att.attnum > 0
       AND NOT att.attisdropped
       AND cl.relname NOT IN ('users', 'couples');

    v_couple_rows := public.purge_rows_with_retry(COALESCE(v_targets, ARRAY[]::TEXT[]), v_couple_id::text);

    -- 3.3 Partner(ler) çiftten ayrılır; kendilerine neler olduğunu anlatan bildirim bırakılır
    DELETE FROM public.partner_notices AS n
     WHERE n.kind IN ('deletion_requested', 'deletion_cancelled')
       AND n.user_id IN (SELECT u.id FROM public.users AS u WHERE u.couple_id = v_couple_id AND u.id <> p_user_id);

    INSERT INTO public.partner_notices (user_id, kind)
    SELECT u.id, 'couple_dissolved'
      FROM public.users AS u
     WHERE u.couple_id = v_couple_id AND u.id <> p_user_id;

    UPDATE public.users AS u SET couple_id = NULL WHERE u.couple_id = v_couple_id;
    DELETE FROM public.couples AS c WHERE c.id = v_couple_id;
  END IF;

  -- 3.4 Kullanıcıya bağlı kalan satırlar: users/auth.users'a yabancı anahtarı olan sütunlar
  --     ve yabancı anahtarsız bilinen kullanıcı sütunları
  SELECT array_agg(DISTINCT target)
    INTO v_targets
    FROM (
      SELECT cl.relname || '.' || att.attname AS target
        FROM pg_catalog.pg_constraint AS con
        JOIN pg_catalog.pg_class AS cl ON cl.oid = con.conrelid
        JOIN pg_catalog.pg_namespace AS ns ON ns.oid = cl.relnamespace
        JOIN pg_catalog.pg_attribute AS att
          ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
       WHERE con.contype = 'f'
         AND ns.nspname = 'public'
         AND cl.relkind IN ('r', 'p')
         AND array_length(con.conkey, 1) = 1
         AND con.confrelid IN ('public.users'::regclass, 'auth.users'::regclass)
         AND cl.relname NOT IN ('users', 'account_deletion_requests')
      UNION
      SELECT cl.relname || '.' || att.attname
        FROM pg_catalog.pg_attribute AS att
        JOIN pg_catalog.pg_class AS cl ON cl.oid = att.attrelid
        JOIN pg_catalog.pg_namespace AS ns ON ns.oid = cl.relnamespace
       WHERE ns.nspname = 'public'
         AND cl.relkind IN ('r', 'p')
         AND att.attname IN ('user_id', 'sender_id', 'receiver_id')
         AND att.atttypid = 'uuid'::regtype
         AND att.attnum > 0
         AND NOT att.attisdropped
         AND cl.relname NOT IN ('users', 'account_deletion_requests')
    ) AS targets;

  v_user_rows := public.purge_rows_with_retry(COALESCE(v_targets, ARRAY[]::TEXT[]), p_user_id::text);

  -- 3.5 Profil satırı (isim, cinsiyet, avatar adresi). auth.users kaydını Edge Function siler.
  DELETE FROM public.users AS u WHERE u.id = p_user_id;

  RETURN jsonb_build_object(
    'couple_id',   v_couple_id,
    'couple_rows', v_couple_rows,
    'user_rows',   v_user_rows
  );
END;
$$;

REVOKE ALL ON FUNCTION public.purge_account_data(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_account_data(UUID) TO service_role;

-- Görülmüş bildirimler 30 gün sonra silinir
SELECT cron.schedule(
  'purge-partner-notices',
  '51 3 * * *',
  $cron$ DELETE FROM public.partner_notices WHERE seen_at IS NOT NULL AND seen_at < now() - interval '30 days'; $cron$
);

COMMIT;
