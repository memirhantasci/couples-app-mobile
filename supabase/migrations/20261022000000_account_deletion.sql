-- ============================================================================
-- Hesap silme (KVKK md. 7/11 · App Store 5.1.1(v) · Google Play hesap silme)
-- ----------------------------------------------------------------------------
-- Eski akış yalnızca couples.deletion_scheduled_at'e tarih yazıp çıkış yapıyordu: bu sütunu
-- okuyan bir iş yoktu, hiçbir veri, dosya ya da hesap silinmiyordu. Çifti olmayan kullanıcı
-- hesabını hiç silemiyordu. Yeni akış:
--
-- 1. request_account_deletion(): kullanıcı ister; 7 gün sonra silinmek üzere talep açılır.
-- 2. Bu 7 gün içinde AYNI kullanıcı giriş yapıp cancel_account_deletion() ile vazgeçebilir
--    (partnerin girişi başkasının silme talebini iptal edemez).
-- 3. Saatlik pg_cron işi `process-account-deletions` Edge Function'ını çağırır. Fonksiyon,
--    süresi dolan her talep için:
--      a. Storage API ile dosyaları siler: avatars/<user_id>/ ve çiftin photos/,
--         memories/, couple-memories/ altındaki <couple_id>/ klasörleri,
--      b. purge_account_data() ile veritabanındaki kişisel ve ortak verileri siler,
--      c. auth.admin.deleteUser() ile hesabı kaldırır.
--    Partnerin hesabı kalır; çiftten ayrılır ve yeniden eşleşme ekranına düşer.
--
-- Dosyalar SQL ile silinmez: storage.objects satırını silmek dosyanın kendisini depoda
-- sahipsiz bırakır. Dağıtım: supabase/functions/process-account-deletions/README.md
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. TALEPLER
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.account_deletion_requests (
  user_id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  scheduled_for   TIMESTAMPTZ NOT NULL,
  last_attempt_at TIMESTAMPTZ,
  last_error      TEXT
);

CREATE INDEX IF NOT EXISTS idx_account_deletion_requests_due
  ON public.account_deletion_requests (scheduled_for);

ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;

-- Kullanıcı yalnızca kendi talebini görür; yazma yalnızca aşağıdaki RPC'lerle
DROP POLICY IF EXISTS account_deletion_requests_select_own ON public.account_deletion_requests;
CREATE POLICY account_deletion_requests_select_own ON public.account_deletion_requests
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

REVOKE ALL ON public.account_deletion_requests FROM anon, authenticated;
GRANT SELECT ON public.account_deletion_requests TO authenticated;


-- ============================================================================
-- 2. İSTEMCİ RPC'LERİ
-- ============================================================================

-- Talep açar ve silinme zamanını döner. Tekrar çağrılırsa ilk talebin zamanı korunur.
CREATE OR REPLACE FUNCTION public.request_account_deletion()
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid  UUID := auth.uid();
  v_when TIMESTAMPTZ;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Oturum bulunamadı.' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.account_deletion_requests AS r (user_id, scheduled_for)
  VALUES (v_uid, NOW() + INTERVAL '7 days')
  ON CONFLICT (user_id) DO UPDATE SET user_id = r.user_id
  RETURNING r.scheduled_for INTO v_when;

  -- Silinmek üzere olan hesabın hiçbir cihazına artık bildirim gitmesin
  DELETE FROM public.push_tokens AS t WHERE t.user_id = v_uid;

  RETURN v_when;
END;
$$;

-- Kullanıcının kendi talebini geri alır; iptal edilecek talep yoksa FALSE.
CREATE OR REPLACE FUNCTION public.cancel_account_deletion()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Oturum bulunamadı.' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.account_deletion_requests AS r WHERE r.user_id = v_uid;
  RETURN FOUND;
END;
$$;


-- ============================================================================
-- 3. VERİTABANI TEMİZLİĞİ (yalnızca service_role / Edge Function)
-- ============================================================================
-- Tablo listesi katalogdan okunur: ilk şema panelden kurulduğu için migration'larda
-- görünmeyen tablolar da (letters, moods, photos...) kapsanır. Silme sırası bilinmediğinden
-- yabancı anahtar hatası veren tablo bir sonraki tura bırakılır.
CREATE OR REPLACE FUNCTION public.purge_rows_with_retry(p_targets TEXT[], p_value TEXT)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_pending TEXT[] := p_targets;
  v_retry   TEXT[];
  v_target  TEXT;
  v_rows    BIGINT;
  v_total   BIGINT := 0;
  v_pass    INTEGER := 0;
BEGIN
  -- Her öğe 'tablo.sütun' biçimindedir
  WHILE COALESCE(array_length(v_pending, 1), 0) > 0 LOOP
    v_pass := v_pass + 1;
    IF v_pass > 12 THEN
      RAISE EXCEPTION 'Silinemeyen tablolar (yabancı anahtar): %', array_to_string(v_pending, ', ');
    END IF;

    v_retry := ARRAY[]::TEXT[];
    FOREACH v_target IN ARRAY v_pending LOOP
      BEGIN
        EXECUTE format(
          'DELETE FROM public.%I WHERE %I::text = $1',
          split_part(v_target, '.', 1),
          split_part(v_target, '.', 2)
        ) USING p_value;
        GET DIAGNOSTICS v_rows = ROW_COUNT;
        v_total := v_total + v_rows;
      EXCEPTION WHEN foreign_key_violation THEN
        v_retry := v_retry || v_target;
      END;
    END LOOP;

    IF COALESCE(array_length(v_retry, 1), 0) = COALESCE(array_length(v_pending, 1), 0) AND v_pass > 1 THEN
      -- İki turdur hiçbir tablo ilerlemiyorsa döngüyü uzatmanın anlamı yok
      RAISE EXCEPTION 'Silinemeyen tablolar (yabancı anahtar): %', array_to_string(v_retry, ', ');
    END IF;
    v_pending := v_retry;
  END LOOP;

  RETURN v_total;
END;
$$;

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

    -- 3.3 Partner(ler) çiftten ayrılır; çift satırı silinir
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


-- ============================================================================
-- 4. YETKİLER
-- ============================================================================
REVOKE ALL ON FUNCTION public.request_account_deletion()             FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_account_deletion()              FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_account_deletion()          TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_account_deletion()           TO authenticated;

REVOKE ALL ON FUNCTION public.purge_rows_with_retry(TEXT[], TEXT)    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.purge_account_data(UUID)               FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_account_data(UUID)            TO service_role;


-- ============================================================================
-- 5. ZAMANLAMA: her saat başı +17. dakikada süresi dolan talepler işlenir
-- ============================================================================
-- Edge Function yalnızca süresi DOLMUŞ talepleri işler; erken ya da tekrar tetiklenmesi
-- zararsızdır. Bu yüzden JWT doğrulaması kapalı dağıtılır (--no-verify-jwt) ve cron'un
-- gizli anahtar taşıması gerekmez.
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron;

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
  $cron$
  SELECT net.http_post(
    url := 'https://vjnzoomngpwlkxwvixqs.supabase.co/functions/v1/process-account-deletions',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $cron$
);

COMMIT;
