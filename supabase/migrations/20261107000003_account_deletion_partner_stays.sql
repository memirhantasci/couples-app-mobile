-- ============================================================================
-- Hesap silme v2 (2/4): silenin içeriği gider, partnerin hesabı ve içeriği kalır
-- ----------------------------------------------------------------------------
-- Tasarım: docs/HESAP_SILME_VE_PREMIUM_TASARIMI.md (madde 1, 2, 4, 5 ve kademeli silme)
--
-- 7. günde (A = silen, B = partner):
--   • A'nın oluşturduğu / yazdığı / yüklediği her şey silinir; B'nin her şeyi kalır.
--   • B'nin A'ya yazdığı mektuplar kalır (alıcı boşaltılır).
--   • Yıldız ve içindeki TÜM gezegenler silinir, yıldız gökyüzüne serbest kalır.
--   • Özel günlerde A'nınkiler, oluşturanı bilinmeyenler ve otomatik yıldönümleri silinir.
--   • Çift kaydı B'nin çifti olarak kalır: tarihler ve tarih hakları sıfırlanır, eşleşme kodu yenilenir.
--   • Premium'u A aldıysa B'de biter (Edge Function ardından B'nin kendi aboneliğini mağazadan doğrular).
--   • Dosyalar: yalnızca A'nınkiler (kayıt silinince silme kuyruğuna girer) ve A'nın avatarı.
-- Çiftte A'dan başka kimse yoksa (hiç eşleşmemiş, tek kalmış ya da partner önce silinmiş) her şey silinir.
--
-- Ayrıca: silme hatırlatmaları (3 gün / 1 gün kala, A'ya ve B'ye), hareketsiz eşleşmemiş hesapların
-- temizliği (30 / 60 gün, aktif abonelik ve korunan hesaplar hariç).
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. TALEP TÜRÜ
-- ============================================================================
ALTER TABLE public.account_deletion_requests
  ADD COLUMN IF NOT EXISTS reason TEXT NOT NULL DEFAULT 'user';
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'account_deletion_requests_reason_check') THEN
    ALTER TABLE public.account_deletion_requests
      ADD CONSTRAINT account_deletion_requests_reason_check CHECK (reason IN ('user', 'inactive'));
  END IF;
END;
$$;


-- ============================================================================
-- 2. TALEP / VAZGEÇME
-- ============================================================================
-- Push token'ları artık silinmez: silmeye 3 gün ve 1 gün kala A'ya "vazgeçmek için giriş yap" hatırlatması
-- gider. Bu sürede A'ya başka bildirim gitmez (send-push ve get_partner_push_tokens bekleyen talebi atlar).
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

  -- Tekrar çağrılırsa ilk talebin zamanı korunur ve partnere ikinci kez haber verilmez.
  -- Hareketsizlik nedeniyle açılmış talep kullanıcının kendi talebine dönüşür (7 gün yeniden başlar).
  DELETE FROM public.account_deletion_requests AS r WHERE r.user_id = v_uid AND r.reason = 'inactive';

  INSERT INTO public.account_deletion_requests AS r (user_id, scheduled_for, reason)
  VALUES (v_uid, NOW() + INTERVAL '7 days', 'user')
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

  RETURN v_when;
END;
$$;

-- Uygulama, bekleyen talebi olan hesapla açılınca bunu kendiliğinden çağırır (madde 1: otomatik iptal).
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

  UPDATE public.users AS u SET last_seen_at = NOW() WHERE u.id = v_uid;

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

REVOKE ALL ON FUNCTION public.request_account_deletion() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_account_deletion() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_account_deletion() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_account_deletion() TO authenticated;


-- ============================================================================
-- 3. PARTNER KALIRKEN ÇİFTTEN AYRILMA (silme gününde)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.dissolve_couple_for_leaving_member(p_couple_id INTEGER, p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_couple        public.couples%ROWTYPE;
  v_rows          BIGINT;
  v_content_rows  BIGINT := 0;
  v_star_planets  BIGINT := 0;
  v_premium_ended BOOLEAN := FALSE;
  v_target        TEXT;
  v_table         TEXT;
  v_column        TEXT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('couple_activity_lock'), p_couple_id);
  SELECT * INTO v_couple FROM public.couples AS c WHERE c.id = p_couple_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('dissolved', FALSE);
  END IF;

  PERFORM set_config('app.allow_couple_change', 'true', true);
  PERFORM set_config('app.suppress_push', 'on', true);

  -- 3.1 Yıldız ve içindeki tüm gezegenler (kimin oluşturduğuna bakılmaksızın); yıldız gökyüzüne serbest kalır
  DELETE FROM public.star_connections AS sc
   WHERE sc.requested_by_couple_id = p_couple_id
      OR sc.star_a_id IN (SELECT cs.id FROM public.couple_stars AS cs WHERE cs.couple_id = p_couple_id)
      OR sc.star_b_id IN (SELECT cs.id FROM public.couple_stars AS cs WHERE cs.couple_id = p_couple_id);

  UPDATE public.celestial_catalog AS cc
     SET is_claimed = FALSE
   WHERE cc.id IN (SELECT cs.catalog_id FROM public.couple_stars AS cs WHERE cs.couple_id = p_couple_id);

  -- Kasadaki (yıldızsız) gezegenler dahil; görselleri silme kuyruğuna tetikleyiciyle girer
  DELETE FROM public.star_exoplanets AS ep
   WHERE ep.couple_id = p_couple_id
      OR ep.star_id IN (SELECT cs.id FROM public.couple_stars AS cs WHERE cs.couple_id = p_couple_id);
  GET DIAGNOSTICS v_star_planets = ROW_COUNT;

  -- Kıvılcımlar, yıldız bildirimleri ve bağlar ON DELETE CASCADE ile gider
  DELETE FROM public.couple_stars AS cs WHERE cs.couple_id = p_couple_id;

  -- Işıltı / aşk ölçer geçmişi: yeni eşleşme sıfırdan başlar
  DELETE FROM public.couple_activity_score AS s WHERE s.couple_id = p_couple_id;
  DELETE FROM public.couple_daily_activity AS d WHERE d.couple_id = p_couple_id;
  DELETE FROM public.couple_activity_log AS l WHERE l.couple_id = p_couple_id;
  DELETE FROM public.star_lapse_releases AS r WHERE r.couple_id = p_couple_id;

  -- 3.2 Özel günler: silenin, oluşturanı bilinmeyenler ve otomatik yıldönümleri
  DELETE FROM public.memories AS m
   WHERE m.couple_id = p_couple_id
     AND (m.created_by = p_user_id OR m.created_by IS NULL OR COALESCE(m.is_default, FALSE));
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_content_rows := v_content_rows + v_rows;

  -- 3.3 Silenin (ve sahibi bilinmeyen eski) kişisel / ortak kayıtları. Partnerinkiler kalır.
  FOREACH v_target IN ARRAY ARRAY[
    'calendar_notes.user_id', 'daily_notes.user_id', 'map_notes.user_id', 'medicines.user_id',
    'medicine_logs.user_id', 'meetings.user_id', 'moods.user_id', 'period_logs.user_id',
    'photo_archive.user_id', 'star_wishes.user_id'
  ] LOOP
    v_table  := split_part(v_target, '.', 1);
    v_column := split_part(v_target, '.', 2);
    EXECUTE format('DELETE FROM public.%I WHERE couple_id = $1 AND (%I = $2 OR %I IS NULL)', v_table, v_column, v_column)
      USING p_couple_id, p_user_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_content_rows := v_content_rows + v_rows;
  END LOOP;

  -- Mektuplar: silenin yazdıkları gider; partnerin ona yazdıkları alıcısız kalır
  DELETE FROM public.letters AS l WHERE l.sender_id = p_user_id OR (l.couple_id = p_couple_id AND l.sender_id IS NULL);
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_content_rows := v_content_rows + v_rows;
  UPDATE public.letters AS l SET receiver_id = NULL WHERE l.receiver_id = p_user_id;

  -- Davet kodu silenin de bildiği bir koddu: yeni eşleşmede yenisi üretilir
  DELETE FROM public.couple_referral_codes AS rc WHERE rc.couple_id = p_couple_id;

  -- 3.4 Premium: silen aldıysa partnerde bu an biter (tolerans yok). Partnerin kendi aboneliği varsa
  --     process-account-deletions mağazadan doğrulayıp yeniden yazar.
  IF v_couple.premium_owner_id = p_user_id THEN
    PERFORM set_config('app.allow_premium_override', 'on', true);
    UPDATE public.couples AS c
       SET is_premium = FALSE, premium_expires_at = NULL, premium_owner_id = NULL
     WHERE c.id = p_couple_id;
    PERFORM set_config('app.allow_premium_override', 'off', true);
    v_premium_ended := TRUE;
  END IF;

  -- Yıldız zaten silindi: kış uykusu / kasa döngüsü tek kalan çift için işlemez (madde açık nokta 5)
  PERFORM set_config('app.allow_subscription_lifecycle', 'on', true);
  UPDATE public.couples AS c
     SET subscription_status = CASE
           WHEN public.premium_entitlement_active(c.is_premium, c.premium_expires_at) THEN 'active'::public.subscription_status
           ELSE 'free'::public.subscription_status END,
         grace_until = NULL,
         vault_until = NULL,
         subscription_status_changed_at = statement_timestamp()
   WHERE c.id = p_couple_id;
  PERFORM set_config('app.allow_subscription_lifecycle', 'off', true);

  -- 3.5 Çift kaydı: tarihler ve tarih hakları sıfır, eşleşme kodu yeni (eski kodu silen biliyordu)
  PERFORM set_config('app.allow_dates_change', 'on', true);
  UPDATE public.couples AS c
     SET meet_date = NULL,
         relationship_start_date = NULL,
         dates_last_changed_at = NULL,
         dates_set_at = NULL,
         dates_change_period = NULL,
         dates_change_count = 0,
         deletion_scheduled_at = NULL,
         pairing_code = public.generate_pairing_code()
   WHERE c.id = p_couple_id;
  PERFORM set_config('app.allow_dates_change', 'off', true);

  -- 3.6 Partnere ne olduğunu anlatan bildirim (bekleyen "silinecek" bildirimi kalkar)
  DELETE FROM public.partner_notices AS n
   WHERE n.kind IN ('deletion_requested', 'deletion_cancelled')
     AND n.user_id IN (SELECT u.id FROM public.users AS u WHERE u.couple_id = p_couple_id AND u.id <> p_user_id);

  INSERT INTO public.partner_notices (user_id, kind)
  SELECT u.id, 'couple_dissolved'
    FROM public.users AS u
   WHERE u.couple_id = p_couple_id AND u.id <> p_user_id;

  -- 3.7 Silen çiftten çıkar; çift tek üyeli kalır
  UPDATE public.users AS u SET couple_id = NULL WHERE u.id = p_user_id;
  UPDATE public.couples AS c
     SET member_count = (SELECT count(*) FROM public.users AS u WHERE u.couple_id = p_couple_id)
   WHERE c.id = p_couple_id;

  PERFORM set_config('app.suppress_push', '', true);

  RETURN jsonb_build_object(
    'dissolved',     TRUE,
    'content_rows',  v_content_rows,
    'star_planets',  v_star_planets,
    'premium_ended', v_premium_ended
  );
END;
$$;

REVOKE ALL ON FUNCTION public.dissolve_couple_for_leaving_member(INTEGER, UUID) FROM PUBLIC, anon, authenticated;


-- ============================================================================
-- 4. VERİTABANI TEMİZLİĞİ
-- ============================================================================
CREATE OR REPLACE FUNCTION public.purge_account_data(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_couple_id    INTEGER;
  v_others       UUID[] := '{}';
  v_mode         TEXT := 'no_couple';
  v_dissolve     JSONB;
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
    SELECT COALESCE(array_agg(u.id ORDER BY u.id), '{}') INTO v_others
      FROM public.users AS u
     WHERE u.couple_id = v_couple_id AND u.id <> p_user_id;
  END IF;

  IF v_couple_id IS NOT NULL AND cardinality(v_others) > 0 THEN
    -- Partner kalıyor: yalnızca silenin içeriği ve ortak yıldız gider
    v_mode := 'dissolved';
    v_dissolve := public.dissolve_couple_for_leaving_member(v_couple_id, p_user_id);

  ELSIF v_couple_id IS NOT NULL THEN
    -- Çiftte başka kimse yok: çiftin tamamı silinir
    v_mode := 'couple_deleted';

    DELETE FROM public.star_connections AS sc
     WHERE sc.requested_by_couple_id = v_couple_id
        OR sc.star_a_id IN (SELECT cs.id FROM public.couple_stars AS cs WHERE cs.couple_id = v_couple_id)
        OR sc.star_b_id IN (SELECT cs.id FROM public.couple_stars AS cs WHERE cs.couple_id = v_couple_id);

    UPDATE public.celestial_catalog AS cc
       SET is_claimed = FALSE
     WHERE cc.id IN (SELECT cs.catalog_id FROM public.couple_stars AS cs WHERE cs.couple_id = v_couple_id);

    -- couple_id sütunu taşıyan her tablo. Silme kuyruğu hariç: kayıtlar silinirken tetikleyicilerin
    -- kuyruğa yazdığı dosyalar (taşınmış klasörler dahil) silinmeden önce kaybolmasın.
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
       AND cl.relname NOT IN ('users', 'couples', 'storage_purge_queue');

    v_couple_rows := public.purge_rows_with_retry(COALESCE(v_targets, ARRAY[]::TEXT[]), v_couple_id::text);

    UPDATE public.users AS u SET couple_id = NULL WHERE u.couple_id = v_couple_id;
    DELETE FROM public.couples AS c WHERE c.id = v_couple_id;
  END IF;

  -- Partnerin ona yazdığı mektuplar silinmez, alıcısız kalır (başka çiftlerde kalmış eski mektuplar dahil)
  UPDATE public.letters AS l SET receiver_id = NULL WHERE l.receiver_id = p_user_id;

  -- Kullanıcıya bağlı kalan satırlar: users/auth.users'a yabancı anahtarı olan sütunlar ve yabancı
  -- anahtarsız bilinen kullanıcı sütunları. Çift kaydı (premium_owner_id), mektup alıcısı ve taşıma
  -- kayıtları hariç.
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
         AND cl.relname NOT IN ('users', 'couples', 'account_deletion_requests', 'couple_merges')
      UNION
      SELECT cl.relname || '.' || att.attname
        FROM pg_catalog.pg_attribute AS att
        JOIN pg_catalog.pg_class AS cl ON cl.oid = att.attrelid
        JOIN pg_catalog.pg_namespace AS ns ON ns.oid = cl.relnamespace
       WHERE ns.nspname = 'public'
         AND cl.relkind IN ('r', 'p')
         AND att.attname IN ('user_id', 'sender_id', 'created_by')
         AND att.atttypid = 'uuid'::regtype
         AND att.attnum > 0
         AND NOT att.attisdropped
         AND cl.relname NOT IN ('users', 'couples', 'account_deletion_requests', 'couple_merges')
    ) AS targets;

  v_user_rows := public.purge_rows_with_retry(COALESCE(v_targets, ARRAY[]::TEXT[]), p_user_id::text);

  -- Profil satırı (isim, cinsiyet, avatar adresi). auth.users kaydını Edge Function siler.
  DELETE FROM public.users AS u WHERE u.id = p_user_id;

  RETURN jsonb_build_object(
    'mode',           v_mode,
    'couple_id',      v_couple_id,
    'remaining_user_ids', to_jsonb(v_others),
    'dissolve',       v_dissolve,
    'couple_rows',    v_couple_rows,
    'user_rows',      v_user_rows
  );
END;
$$;

REVOKE ALL ON FUNCTION public.purge_account_data(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_account_data(UUID) TO service_role;


-- ============================================================================
-- 5. SİLME HATIRLATMALARI (3 gün ve 1 gün kala; A'ya ve partnerine)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_account_deletion_reminders()
RETURNS TABLE(user_id UUID, push_token TEXT, audience TEXT, stage INTEGER, days_left INTEGER, scheduled_for TIMESTAMPTZ)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH due AS (
    SELECT r.user_id, r.scheduled_for,
           CASE WHEN r.scheduled_for - statement_timestamp() <= INTERVAL '1 day' THEN 1 ELSE 3 END AS stage,
           GREATEST(1, CEIL(EXTRACT(EPOCH FROM (r.scheduled_for - statement_timestamp())) / 86400.0))::INTEGER AS days_left
      FROM public.account_deletion_requests AS r
     WHERE r.reason = 'user'
       AND r.scheduled_for > statement_timestamp()
       AND r.scheduled_for <= statement_timestamp() + INTERVAL '3 days'
  )
  -- Silinecek kişinin kendisi
  SELECT d.user_id, pt.token, 'self', d.stage, d.days_left, d.scheduled_for
    FROM due AS d
    JOIN public.push_tokens AS pt ON pt.user_id = d.user_id
  UNION ALL
  -- Partneri (kendi de silinmek üzere değilse)
  SELECT p.id, pt.token, 'partner', d.stage, d.days_left, d.scheduled_for
    FROM due AS d
    JOIN public.users AS me ON me.id = d.user_id
    JOIN public.users AS p ON p.couple_id = me.couple_id AND p.id <> me.id
    JOIN public.push_tokens AS pt ON pt.user_id = p.id
   WHERE me.couple_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.account_deletion_requests AS r2 WHERE r2.user_id = p.id);
$$;

REVOKE ALL ON FUNCTION public.get_account_deletion_reminders() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_account_deletion_reminders() TO service_role;


-- ============================================================================
-- 6. HAREKETSİZ HESAP TEMİZLİĞİ (madde 5)
-- ============================================================================

-- Uygulama her açılışta çağırır; en fazla 6 saatte bir yazar
CREATE OR REPLACE FUNCTION public.touch_last_seen()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;
  UPDATE public.users AS u
     SET last_seen_at = NOW()
   WHERE u.id = auth.uid()
     AND (u.last_seen_at IS NULL OR u.last_seen_at < NOW() - INTERVAL '6 hours');
END;
$$;

REVOKE ALL ON FUNCTION public.touch_last_seen() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.touch_last_seen() TO authenticated;

-- Hesabın hareketsizlikten silineceği an (silinmeyecekse NULL):
--   • yalnızca eşleşmemiş kullanıcılar (eşleşmiş kullanıcı asla silinmez)
--   • hiç eşleşmemiş: son açılıştan 30 gün; eşleşip tek kalmış: 60 gün
--   • aktif Premium (süresiz dahil) silinmez; biten Premium'da bitişten en az 60 gün beklenir
--   • korunan (mağaza inceleme / geliştirici) hesaplar ve zaten silinmek üzere olanlar hariç
CREATE OR REPLACE FUNCTION public.inactive_account_due_at(p_user_id UUID)
RETURNS TIMESTAMPTZ
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
           WHEN u.protected_from_cleanup THEN NULL
           WHEN c.id IS NOT NULL AND public.couple_is_paired(c.id) THEN NULL
           WHEN c.id IS NOT NULL AND public.premium_entitlement_active(c.is_premium, c.premium_expires_at) THEN NULL
           ELSE GREATEST(
             COALESCE(u.last_seen_at, u.created_at, NOW())
               + CASE WHEN c.paired_at IS NULL THEN INTERVAL '30 days' ELSE INTERVAL '60 days' END,
             CASE WHEN c.premium_expires_at IS NOT NULL THEN c.premium_expires_at + INTERVAL '60 days' END
           )
         END
    FROM public.users AS u
    LEFT JOIN public.couples AS c ON c.id = u.couple_id
   WHERE u.id = p_user_id
     AND NOT EXISTS (SELECT 1 FROM public.account_deletion_requests AS r WHERE r.user_id = u.id);
$$;

REVOKE ALL ON FUNCTION public.inactive_account_due_at(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inactive_account_due_at(UUID) TO service_role;

-- Silmeye 7 gün ve 1 gün kala bildirim
CREATE OR REPLACE FUNCTION public.get_inactive_account_reminders()
RETURNS TABLE(user_id UUID, push_token TEXT, stage INTEGER, days_left INTEGER, due_at TIMESTAMPTZ)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT x.id, pt.token,
         CASE WHEN x.due_at - statement_timestamp() <= INTERVAL '1 day' THEN 1 ELSE 7 END,
         GREATEST(1, CEIL(EXTRACT(EPOCH FROM (x.due_at - statement_timestamp())) / 86400.0))::INTEGER,
         x.due_at
    FROM (
      SELECT u.id, public.inactive_account_due_at(u.id) AS due_at
        FROM public.users AS u
        LEFT JOIN public.couples AS c ON c.id = u.couple_id
       -- Ön eleme: son 23 günde açanlar (30 günlük kuralın 7 gün öncesi) aday değildir
       WHERE COALESCE(u.last_seen_at, u.created_at) < NOW() - INTERVAL '23 days'
         AND NOT u.protected_from_cleanup
    ) AS x
    JOIN public.push_tokens AS pt ON pt.user_id = x.id
   WHERE x.due_at IS NOT NULL
     AND x.due_at > statement_timestamp()
     AND x.due_at <= statement_timestamp() + INTERVAL '7 days';
$$;

REVOKE ALL ON FUNCTION public.get_inactive_account_reminders() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_inactive_account_reminders() TO service_role;

-- Süresi dolanlara silme talebi açar; silmeyi saatlik process-account-deletions yapar (aynı hat:
-- dosyalar → purge_account_data → auth.admin.deleteUser)
CREATE OR REPLACE FUNCTION public.schedule_inactive_account_deletions(p_limit INTEGER DEFAULT 200)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  INSERT INTO public.account_deletion_requests (user_id, scheduled_for, reason)
  SELECT x.id, statement_timestamp(), 'inactive'
    FROM (
      SELECT u.id, public.inactive_account_due_at(u.id) AS due_at
        FROM public.users AS u
       WHERE COALESCE(u.last_seen_at, u.created_at) < NOW() - INTERVAL '30 days'
         AND NOT u.protected_from_cleanup
    ) AS x
   WHERE x.due_at IS NOT NULL
     AND x.due_at <= statement_timestamp()
   ORDER BY x.due_at
   LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 200), 1000))
  ON CONFLICT (user_id) DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.schedule_inactive_account_deletions(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_inactive_account_deletions(INTEGER) TO service_role;


-- ============================================================================
-- 7. SİLİNMEK ÜZERE OLAN HESABA PARTNER BİLDİRİMİ GİTMEZ
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_partner_push_tokens(p_couple_id INTEGER)
RETURNS TABLE(token TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  -- Çağıran, istenen çiftin üyesi değilse boş döner
  IF p_couple_id IS NULL OR p_couple_id IS DISTINCT FROM public.get_my_couple_id() THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT pt.token
    FROM public.push_tokens pt
    JOIN public.users u ON u.id = pt.user_id
   WHERE u.couple_id = p_couple_id
     AND u.id <> auth.uid()
     AND NOT EXISTS (SELECT 1 FROM public.account_deletion_requests AS r WHERE r.user_id = u.id);
END;
$$;


-- ============================================================================
-- 8. ZAMANLAMA
-- ============================================================================
DO $$
DECLARE
  v_job_id BIGINT;
BEGIN
  FOR v_job_id IN
    SELECT jobid FROM cron.job
     WHERE jobname IN ('inactive-account-cleanup', 'push-account-deletion-reminder', 'push-inactive-account-reminder')
  LOOP
    PERFORM cron.unschedule(v_job_id);
  END LOOP;
END;
$$;

-- Türkiye saatiyle 07:23'te süresi dolan hareketsiz hesaplara talep açılır (saatlik iş siler)
SELECT cron.schedule(
  'inactive-account-cleanup',
  '23 4 * * *',
  $cron$ SELECT public.schedule_inactive_account_deletions(500); $cron$
);

-- Hatırlatmalar Türkiye saatiyle 11:00'de (gece bildirim gitmesin); her aşama kişi başına bir kez
SELECT cron.schedule(
  'push-account-deletion-reminder',
  '0 8 * * *',
  $cron$ SELECT public.invoke_cron_edge_function('{"type":"CRON","job":"account_deletion_reminder"}'::jsonb); $cron$
);

SELECT cron.schedule(
  'push-inactive-account-reminder',
  '10 8 * * *',
  $cron$ SELECT public.invoke_cron_edge_function('{"type":"CRON","job":"inactive_account_reminder"}'::jsonb); $cron$
);

COMMIT;
