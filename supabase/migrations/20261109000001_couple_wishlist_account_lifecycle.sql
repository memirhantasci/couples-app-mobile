-- ============================================================================
-- Ortak liste (Faz 1A, 2/2): hesap silme ve yeni eşleşmede taşıma
-- ----------------------------------------------------------------------------
-- Plan: docs/ORTAK_LISTE_PLANI.md (bölüm 4). İki fonksiyon, son tanımlarının (20261107000003 ve
-- 20261107000002) aynısıdır; yalnızca "Ortak liste" notlu satırlar eklendi.
--
--   • Silen kişinin maddeleri gider, partnerinkiler kalır. Silenin partner maddelerine verdiği "yaptık"
--     imzası boşaltılır (durum ve tarih korunur); "istiyorum" satırlarını purge_account_data siler.
--   • Eski çifti silinen kişinin maddeleri yeni çifte taşınır. Bu olmasaydı eşleşmede ON DELETE CASCADE ile
--     yok olurlardı. Taşınan maddeleri yeni partner göremez (eşleşme anından önce oluşturuldu).
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. PARTNER KALIRKEN ÇİFTTEN AYRILMA (silme gününde)
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
    'photo_archive.user_id', 'star_wishes.user_id',
    -- Ortak liste
    'couple_wishlist_items.created_by'
  ] LOOP
    v_table  := split_part(v_target, '.', 1);
    v_column := split_part(v_target, '.', 2);
    EXECUTE format('DELETE FROM public.%I WHERE couple_id = $1 AND (%I = $2 OR %I IS NULL)', v_table, v_column, v_column)
      USING p_couple_id, p_user_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_content_rows := v_content_rows + v_rows;
  END LOOP;

  -- Ortak liste: partnerin maddelerinde silenin "yaptık" imzası kalmaz
  UPDATE public.couple_wishlist_items AS w
     SET done_by = NULL
   WHERE w.couple_id = p_couple_id AND w.done_by = p_user_id;

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
-- 2. KİŞİNİN İÇERİĞİNİ BİR ÇİFTTEN DİĞERİNE TAŞIMA
-- ============================================================================
-- Yalnızca join_couple_by_code_uuid içinden (kişi eski çiftinde tek başınayken) çağrılır.
CREATE OR REPLACE FUNCTION public.move_member_content(p_user_id UUID, p_from INTEGER, p_to INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_from_key BYTEA;
  v_to_key   BYTEA;
  v_rows     BIGINT;
  v_total    BIGINT := 0;
  v_target   TEXT;
  v_table    TEXT;
  v_column   TEXT;
BEGIN
  IF p_user_id IS NULL OR p_from IS NULL OR p_to IS NULL OR p_from = p_to THEN
    RETURN jsonb_build_object('moved', 0);
  END IF;

  -- Koruma tetikleyicileri (tek kalan yazma kısıtı) ve push bildirimleri bu taşıma için devre dışı
  PERFORM set_config('app.allow_couple_change', 'true', true);
  PERFORM set_config('app.suppress_push', 'on', true);

  v_from_key := public.couple_encryption_key(p_from);
  v_to_key   := public.couple_encryption_key(p_to);

  -- Şifreli metin taşıyan tablolar
  UPDATE public.daily_notes AS dn
     SET couple_id = p_to,
         content = public.reencrypt_couple_text(dn.content, v_from_key, v_to_key)
   WHERE dn.couple_id = p_from AND dn.user_id = p_user_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_total := v_total + v_rows;

  UPDATE public.letters AS l
     SET couple_id = p_to,
         title = public.reencrypt_couple_text(l.title, v_from_key, v_to_key),
         content = public.reencrypt_couple_text(l.content, v_from_key, v_to_key)
   WHERE l.couple_id = p_from AND l.sender_id = p_user_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_total := v_total + v_rows;

  -- İlaç dozları: kişinin işaretledikleri ve kişinin ilaçlarına ait olanlar
  UPDATE public.medicine_logs AS ml
     SET couple_id = p_to
   WHERE ml.couple_id = p_from
     AND (ml.user_id = p_user_id
          OR ml.medicine_id IN (SELECT m.id FROM public.medicines AS m WHERE m.user_id = p_user_id));
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_total := v_total + v_rows;

  -- Diğer kişisel / oluşturana ait kayıtlar
  FOREACH v_target IN ARRAY ARRAY[
    'calendar_notes.user_id', 'map_notes.user_id', 'medicines.user_id', 'meetings.user_id',
    'memories.created_by', 'moods.user_id', 'period_logs.user_id', 'photo_archive.user_id',
    'star_wishes.user_id',
    -- Ortak liste
    'couple_wishlist_items.created_by'
  ] LOOP
    v_table  := split_part(v_target, '.', 1);
    v_column := split_part(v_target, '.', 2);
    EXECUTE format('UPDATE public.%I SET couple_id = $1 WHERE couple_id = $2 AND %I = $3', v_table, v_column)
      USING p_to, p_from, p_user_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_total := v_total + v_rows;
  END LOOP;

  -- Eski klasördeki dosyalar artık bu çiftin kayıtlarınca gösterilir (silme kuyruğu öneki kabul etsin).
  -- Daha önce eski çifte taşınmış klasörler de devralınır.
  INSERT INTO public.couple_merges (old_couple_id, new_couple_id, user_id)
  SELECT m.old_couple_id, p_to, p_user_id FROM public.couple_merges AS m WHERE m.new_couple_id = p_from
  UNION
  SELECT p_from, p_to, p_user_id
  ON CONFLICT DO NOTHING;

  PERFORM set_config('app.suppress_push', '', true);
  RETURN jsonb_build_object('moved', v_total);
END;
$$;

REVOKE ALL ON FUNCTION public.move_member_content(UUID, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;

COMMIT;
