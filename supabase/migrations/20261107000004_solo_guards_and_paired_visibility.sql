-- ============================================================================
-- Hesap silme v2 (3/4): tek kalanın kısıtları ve "eşleşme anından sonrası" görünürlüğü
-- ----------------------------------------------------------------------------
-- Tasarım: docs/HESAP_SILME_VE_PREMIUM_TASARIMI.md (madde 3, üçüncü tur kararlar, açık nokta 0)
--
-- A. Tek kalan / eşleşmemiş kullanıcı (sunucuda zorlanır, istemci yalnızca açıklar):
--    • Premium'u varsa: ruh hali, günlük, takvim notu, harita notu, ilaç, regl kaydı yazabilir.
--    • Premium'u yoksa: hiçbir şey kaydedemez.
--    • Fotoğraf, mektup, özel gün, buluşma, yıldız (sahiplenme, gezegen, kıvılcım, bağ, dilek) yalnızca
--      eşleşmiş çiftlere açık; Premium olsa bile.
--    Silme her zaman serbest (kişi kendi verisini her zaman silebilir).
--
-- B. Görünürlük: bir kayıt sahibine her zaman görünür; partnere yalnızca eşleşme anından (couples.paired_at)
--    SONRA oluşturulduysa. Çift düzeyindeki eski ortak öğeler (özel gün, harita pini, takvim notu, buluşma)
--    yalnızca oluşturanına görünür ve yalnızca onun tarafından düzenlenip silinebilir. Kural RLS'de,
--    depolama erişiminde ve ortak veri okuyan RPC'lerde aynıdır.
--
-- C. Depolama: eski, herkese açık politikalar ("Public Access Memories", "Allow All Insert", "Auth Delete",
--    "Auth Update") kaldırılır; bunlar anon anahtarla bile tüm fotoğrafların okunmasına / silinmesine izin
--    veriyordu ve görünürlük kuralını boşa çıkarıyordu.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. YAZMA KISITI
-- ============================================================================
-- TG_ARGV[0]: 'premium' → tek kalan Premium ile kullanabilir; 'partner' → eşleşme şart.
-- Sistem işleri (auth.uid() yok) ve sunucunun taşıma / silme işlemleri (bayrakla) kısıtlanmaz.
CREATE OR REPLACE FUNCTION public.trg_solo_write_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_couple INTEGER;
BEGIN
  IF v_uid IS NULL OR public.app_flag_on('app.allow_couple_change') THEN
    RETURN NEW;
  END IF;

  SELECT u.couple_id INTO v_couple FROM public.users AS u WHERE u.id = v_uid;
  IF public.couple_is_paired(v_couple) THEN
    RETURN NEW;
  END IF;

  IF TG_ARGV[0] = 'premium' THEN
    IF public.has_active_premium(v_couple) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'SOLO_PREMIUM_REQUIRED: Partnerin olmadan kayıt eklemek için Premium gerekir.'
      USING ERRCODE = 'P0021';
  END IF;

  RAISE EXCEPTION 'PARTNER_REQUIRED: Bu özellik için bir partnerle eşleşmen gerekiyor.'
    USING ERRCODE = 'P0020';
END;
$$;

REVOKE ALL ON FUNCTION public.trg_solo_write_guard() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  v_table TEXT;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['moods', 'daily_notes', 'calendar_notes', 'map_notes', 'medicines', 'medicine_logs', 'period_logs'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_solo_write_guard ON public.%I', v_table);
    EXECUTE format(
      'CREATE TRIGGER trg_solo_write_guard BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.trg_solo_write_guard(%L)',
      v_table, 'premium');
  END LOOP;

  FOREACH v_table IN ARRAY ARRAY['photo_archive', 'memories', 'meetings', 'couple_stars', 'star_exoplanets', 'star_sparks', 'star_connections', 'star_wishes'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_solo_write_guard ON public.%I', v_table);
    EXECUTE format(
      'CREATE TRIGGER trg_solo_write_guard BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.trg_solo_write_guard(%L)',
      v_table, 'partner');
  END LOOP;
END;
$$;

-- Mektup yalnızca yazılırken kısıtlanır: gizleme / silme isteği yanıtları (UPDATE) serbest
DROP TRIGGER IF EXISTS trg_solo_write_guard ON public.letters;
CREATE TRIGGER trg_solo_write_guard
  BEFORE INSERT ON public.letters
  FOR EACH ROW EXECUTE FUNCTION public.trg_solo_write_guard('partner');


-- ============================================================================
-- 2. GÖRÜNÜRLÜK (RLS)
-- ============================================================================
-- Kalıp: sahibi = ben  VEYA  (benim çiftim  VE  eşleşme anından sonra oluşturulmuş).
-- (SELECT ...) sarmalı fonksiyonları satır başına değil sorgu başına bir kez çalıştırır.

-- 2.1 Takvim notları
DROP POLICY IF EXISTS calendar_notes_select ON public.calendar_notes;
DROP POLICY IF EXISTS calendar_notes_select_visible ON public.calendar_notes;
CREATE POLICY calendar_notes_select_visible ON public.calendar_notes
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR (couple_id = (SELECT public.get_my_couple_id()) AND created_at >= (SELECT public.my_couple_paired_at()))
  );

-- 2.2 Harita notları
DROP POLICY IF EXISTS map_notes_select_couple ON public.map_notes;
DROP POLICY IF EXISTS map_notes_select_visible ON public.map_notes;
CREATE POLICY map_notes_select_visible ON public.map_notes
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR (couple_id = (SELECT public.get_my_couple_id()) AND created_at >= (SELECT public.my_couple_paired_at()))
  );

-- 2.3 Ruh hali
DROP POLICY IF EXISTS moods_select ON public.moods;
DROP POLICY IF EXISTS moods_select_visible ON public.moods;
CREATE POLICY moods_select_visible ON public.moods
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR (couple_id = (SELECT public.get_my_couple_id()) AND created_at >= (SELECT public.my_couple_paired_at()))
  );

-- 2.4 İlaçlar ve dozlar (doz, ilacı partnere görünüyorsa görünür)
DROP POLICY IF EXISTS medicines_select ON public.medicines;
DROP POLICY IF EXISTS medicines_select_visible ON public.medicines;
CREATE POLICY medicines_select_visible ON public.medicines
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR (couple_id = (SELECT public.get_my_couple_id()) AND created_at >= (SELECT public.my_couple_paired_at()))
  );

DROP POLICY IF EXISTS medicine_logs_select ON public.medicine_logs;
DROP POLICY IF EXISTS medicine_logs_select_visible ON public.medicine_logs;
CREATE POLICY medicine_logs_select_visible ON public.medicine_logs
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR (
      couple_id = (SELECT public.get_my_couple_id())
      AND medicine_id IN (
        SELECT m.id FROM public.medicines AS m
         WHERE m.couple_id = (SELECT public.get_my_couple_id())
           AND (m.user_id = (SELECT auth.uid()) OR m.created_at >= (SELECT public.my_couple_paired_at()))
      )
    )
  );

-- 2.5 Regl kayıtları: partnere yalnızca Premium'da (önceki kural) ve eşleşmeden sonra.
-- "View couple data" eski bir paneldeki politikaydı ve Premium şartını boşa çıkarıyordu.
DROP POLICY IF EXISTS "View couple data" ON public.period_logs;
DROP POLICY IF EXISTS "View own couple period logs" ON public.period_logs;
DROP POLICY IF EXISTS period_logs_select_visible ON public.period_logs;
CREATE POLICY period_logs_select_visible ON public.period_logs
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR (
      couple_id = (SELECT public.get_my_couple_id())
      AND created_at >= (SELECT public.my_couple_paired_at())
      AND (SELECT public.has_my_active_premium())
    )
  );

-- 2.6 Fotoğraflar
DROP POLICY IF EXISTS "View own couple photos" ON public.photo_archive;
DROP POLICY IF EXISTS photo_archive_select ON public.photo_archive;
DROP POLICY IF EXISTS photo_archive_select_visible ON public.photo_archive;
CREATE POLICY photo_archive_select_visible ON public.photo_archive
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR (couple_id = (SELECT public.get_my_couple_id()) AND created_at >= (SELECT public.my_couple_paired_at()))
  );

-- 2.7 Özel günler / anılar: görebildiğini düzenler ve siler (eski öğe yalnızca oluşturanınındır)
DROP POLICY IF EXISTS memories_select ON public.memories;
DROP POLICY IF EXISTS memories_select_couple ON public.memories;
DROP POLICY IF EXISTS memories_update ON public.memories;
DROP POLICY IF EXISTS memories_update_couple ON public.memories;
DROP POLICY IF EXISTS memories_delete ON public.memories;
DROP POLICY IF EXISTS memories_delete_couple ON public.memories;
DROP POLICY IF EXISTS memories_select_visible ON public.memories;
DROP POLICY IF EXISTS memories_update_visible ON public.memories;
DROP POLICY IF EXISTS memories_delete_visible ON public.memories;
CREATE POLICY memories_select_visible ON public.memories
  FOR SELECT TO authenticated
  USING (
    created_by = (SELECT auth.uid())
    OR (couple_id = (SELECT public.get_my_couple_id()) AND created_at >= (SELECT public.my_couple_paired_at()))
  );
CREATE POLICY memories_update_visible ON public.memories
  FOR UPDATE TO authenticated
  USING (
    couple_id = (SELECT public.get_my_couple_id())
    AND (created_by = (SELECT auth.uid()) OR created_at >= (SELECT public.my_couple_paired_at()))
  )
  WITH CHECK (couple_id = (SELECT public.get_my_couple_id()));
CREATE POLICY memories_delete_visible ON public.memories
  FOR DELETE TO authenticated
  USING (
    couple_id = (SELECT public.get_my_couple_id())
    AND (created_by = (SELECT auth.uid()) OR created_at >= (SELECT public.my_couple_paired_at()))
  );

-- 2.8 Buluşmalar: aynı kural
DROP POLICY IF EXISTS meetings_select ON public.meetings;
DROP POLICY IF EXISTS meetings_update ON public.meetings;
DROP POLICY IF EXISTS meetings_delete ON public.meetings;
DROP POLICY IF EXISTS meetings_select_visible ON public.meetings;
DROP POLICY IF EXISTS meetings_update_visible ON public.meetings;
DROP POLICY IF EXISTS meetings_delete_visible ON public.meetings;
CREATE POLICY meetings_select_visible ON public.meetings
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR (couple_id = (SELECT public.get_my_couple_id()) AND created_at >= (SELECT public.my_couple_paired_at()))
  );
CREATE POLICY meetings_update_visible ON public.meetings
  FOR UPDATE TO authenticated
  USING (
    couple_id = (SELECT public.get_my_couple_id())
    AND (user_id = (SELECT auth.uid()) OR created_at >= (SELECT public.my_couple_paired_at()))
  )
  WITH CHECK (couple_id = (SELECT public.get_my_couple_id()));
CREATE POLICY meetings_delete_visible ON public.meetings
  FOR DELETE TO authenticated
  USING (
    couple_id = (SELECT public.get_my_couple_id())
    AND (user_id = (SELECT auth.uid()) OR created_at >= (SELECT public.my_couple_paired_at()))
  );

-- 2.9 Dilekler ve puan günlüğü
DROP POLICY IF EXISTS star_wishes_select_own ON public.star_wishes;
DROP POLICY IF EXISTS star_wishes_select_visible ON public.star_wishes;
CREATE POLICY star_wishes_select_visible ON public.star_wishes
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR (couple_id = (SELECT public.get_my_couple_id()) AND created_at >= (SELECT public.my_couple_paired_at()))
  );

DROP POLICY IF EXISTS couple_activity_log_select_own ON public.couple_activity_log;
DROP POLICY IF EXISTS couple_activity_log_select_visible ON public.couple_activity_log;
CREATE POLICY couple_activity_log_select_visible ON public.couple_activity_log
  FOR SELECT TO authenticated
  USING (
    couple_id = (SELECT public.get_my_couple_id())
    AND (user_id = (SELECT auth.uid()) OR created_at >= (SELECT public.my_couple_paired_at()))
  );


-- ============================================================================
-- 3. DEPOLAMA
-- ============================================================================
CREATE OR REPLACE FUNCTION public.can_view_photo_object(p_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.photo_archive AS p
     WHERE (p.storage_path = p_name OR p.thumb_path = p_name)
       AND (p.user_id = auth.uid()
            OR (p.couple_id = public.get_my_couple_id() AND p.created_at >= public.my_couple_paired_at()))
  );
$$;

CREATE OR REPLACE FUNCTION public.can_view_memory_object(p_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memories AS m
     WHERE m.image_path = p_name
       AND (m.created_by = auth.uid()
            OR (m.couple_id = public.get_my_couple_id() AND m.created_at >= public.my_couple_paired_at()))
  );
$$;

REVOKE ALL ON FUNCTION public.can_view_photo_object(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_view_memory_object(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_photo_object(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_view_memory_object(TEXT) TO authenticated, service_role;

-- Herkese açık eski politikalar
DROP POLICY IF EXISTS "Allow All Insert" ON storage.objects;
DROP POLICY IF EXISTS "Auth Delete" ON storage.objects;
DROP POLICY IF EXISTS "Auth Update" ON storage.objects;
DROP POLICY IF EXISTS "Public Access Memories" ON storage.objects;

-- Fotoğraflar: yükleyen her zaman; diğerleri yalnızca görebildiği bir kayıt dosyayı gösteriyorsa
DROP POLICY IF EXISTS photos_select_couple ON storage.objects;
DROP POLICY IF EXISTS photos_select_visible ON storage.objects;
CREATE POLICY photos_select_visible ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'photos'
    AND (owner_id = (SELECT auth.uid())::text OR public.can_view_photo_object(name))
  );

DROP POLICY IF EXISTS photos_delete_own ON storage.objects;
CREATE POLICY photos_delete_own ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'photos' AND owner_id = (SELECT auth.uid())::text);

DROP POLICY IF EXISTS photos_insert_couple_premium ON storage.objects;
CREATE POLICY photos_insert_couple_premium ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'photos'
    AND (storage.foldername(name))[1] = (SELECT public.get_my_couple_id())::text
    AND (SELECT public.has_my_active_premium())
    AND (SELECT public.my_couple_is_paired())
  );

-- Özel gün görselleri: görebildiği özel günün görselini görür ve (düzenlerken) siler
DROP POLICY IF EXISTS memories_select_couple ON storage.objects;
DROP POLICY IF EXISTS memories_select_visible ON storage.objects;
CREATE POLICY memories_select_visible ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'memories'
    AND (owner_id = (SELECT auth.uid())::text OR public.can_view_memory_object(name))
  );

DROP POLICY IF EXISTS memories_delete_couple ON storage.objects;
DROP POLICY IF EXISTS memories_delete_visible ON storage.objects;
CREATE POLICY memories_delete_visible ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'memories'
    AND (owner_id = (SELECT auth.uid())::text OR public.can_view_memory_object(name))
  );

DROP POLICY IF EXISTS memories_insert_couple_premium ON storage.objects;
CREATE POLICY memories_insert_couple_premium ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'memories'
    AND (storage.foldername(name))[1] = (SELECT public.get_my_couple_id())::text
    AND (SELECT public.has_my_active_premium())
    AND (SELECT public.my_couple_is_paired())
  );


-- ============================================================================
-- 4. ORTAK VERİ OKUYAN RPC'LER
-- ============================================================================

-- Aşk ölçer: tek kalınca 0; yalnızca eşleşme anından sonraki etkinlik sayılır
CREATE OR REPLACE FUNCTION public.get_couple_love_activity()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH me AS (
    SELECT public.get_my_couple_id() AS couple_id,
           public.activity_local_date(NOW()) AS today,
           COALESCE(public.my_couple_paired_at(), 'infinity'::timestamptz) AS since,
           public.my_couple_is_paired() AS paired
  ),
  log AS (
    SELECT l.*
      FROM public.couple_activity_log AS l, me
     WHERE me.paired
       AND l.couple_id = me.couple_id
       AND l.status = 'awarded'
       AND l.created_at >= me.since
  )
  SELECT jsonb_build_object(
    'mood_authors_today', (
      SELECT count(DISTINCT log.user_id)::integer FROM log
       WHERE log.activity_type = 'mood' AND log.activity_date = me.today),
    'daily_authors_today', (
      SELECT count(DISTINCT log.user_id)::integer FROM log
       WHERE log.activity_type = 'diary' AND log.activity_date = me.today),
    'calendar_authors_recent', (
      SELECT count(DISTINCT log.user_id)::integer FROM log
       WHERE log.activity_type = 'calendar_note' AND log.activity_date >= me.today - 7),
    'completed_meetings_recent', (
      SELECT count(*)::integer FROM log
       WHERE log.activity_type = 'meeting' AND log.activity_date >= me.today - 30),
    'letter_senders_recent', (
      SELECT count(DISTINCT log.user_id)::integer FROM log
       WHERE log.activity_type = 'letter' AND log.activity_date >= me.today - 30),
    'photo_recent_7d', (
      SELECT count(*)::integer FROM log
       WHERE log.activity_type = 'photo' AND log.activity_date >= me.today - 7),
    'photo_recent_30d', (
      SELECT count(*)::integer FROM log
       WHERE log.activity_type = 'photo' AND log.activity_date >= me.today - 30),
    'paired', me.paired
  )
  FROM me
  WHERE me.couple_id IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.get_couple_note_activity(p_today DATE, p_since DATE)
RETURNS TABLE(daily_authors_today INTEGER, calendar_authors_recent INTEGER)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    (SELECT count(DISTINCT dn.user_id)::integer
       FROM public.daily_notes AS dn
       JOIN public.users AS u ON u.id = dn.user_id
      WHERE u.couple_id = public.get_my_couple_id()
        AND dn.date = p_today
        AND (dn.user_id = auth.uid() OR dn.created_at >= public.my_couple_paired_at())),
    (SELECT count(DISTINCT cn.user_id)::integer
       FROM public.calendar_notes AS cn
      WHERE cn.couple_id = public.get_my_couple_id()
        AND cn.date >= p_since
        AND (cn.user_id = auth.uid() OR cn.created_at >= public.my_couple_paired_at()));
$$;

CREATE OR REPLACE FUNCTION public.get_couple_period_activity(p_since DATE, p_month_start DATE)
RETURNS TABLE(has_recent BOOLEAN, has_this_month BOOLEAN)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    COALESCE(bool_or(pl.date >= p_since), false),
    COALESCE(bool_or(pl.date >= p_month_start), false)
  FROM public.period_logs AS pl
  WHERE pl.couple_id = public.get_my_couple_id()
    AND (pl.user_id = auth.uid() OR pl.created_at >= public.my_couple_paired_at());
$$;

-- Partnere regl hatırlatması yalnızca eşleşmeden sonra kaydedilen günler için
CREATE OR REPLACE FUNCTION public.get_active_period_reminders(target_date_str TEXT)
RETURNS TABLE(user_id INTEGER, user_push_token TEXT, display_name TEXT, partner_id INTEGER, partner_push_token TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.user_id,
    ut.token AS user_push_token,
    u.display_name,
    CASE WHEN p.created_at >= c.paired_at THEN partner.id END AS partner_id,
    CASE WHEN p.created_at >= c.paired_at THEN pt.token END AS partner_push_token
  FROM period_logs p
  JOIN users u ON u.id = p.user_id
  LEFT JOIN couples c ON c.id = u.couple_id
  LEFT JOIN users partner ON partner.couple_id = u.couple_id AND partner.id != u.id
  LEFT JOIN push_tokens ut ON ut.user_id = u.id
  LEFT JOIN push_tokens pt ON pt.user_id = partner.id
  WHERE p.date = target_date_str;
END;
$$;
REVOKE ALL ON FUNCTION public.get_active_period_reminders(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_period_reminders(TEXT) TO service_role;


-- ============================================================================
-- 5. MEKTUP SİLME: karşı taraf yoksa onay beklenmez
-- ============================================================================
-- Alıcının hesabı silinmişse (receiver_id boş) ya da alıcı artık partner değilse gönderen mektubu
-- doğrudan siler: istek akışı ve bekleme süreleri atlanır.
CREATE OR REPLACE FUNCTION public.request_letter_deletion(p_letter_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_letter public.letters%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_letter FROM public.letters WHERE id = p_letter_id FOR UPDATE;
  IF NOT FOUND OR v_letter.sender_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Yalnızca kendi yazdığın mektubun silinmesini isteyebilirsin.' USING ERRCODE = '42501';
  END IF;

  IF v_letter.receiver_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.users AS u
     WHERE u.id = v_letter.receiver_id
       AND u.couple_id = public.get_my_couple_id()
       AND u.id <> v_uid
  ) THEN
    DELETE FROM public.letters WHERE id = p_letter_id;
    RETURN;
  END IF;

  IF v_letter.unlock_date > public.app_today() THEN
    RAISE EXCEPTION 'Mektup açılış gününe kadar silinemez; dilersen listenden gizleyebilirsin.';
  END IF;

  IF now() < public.letter_deletion_request_opens_at(v_letter.unlock_date, v_letter.created_at) THEN
    RAISE EXCEPTION 'Silme isteği, mektup açıldıktan 72 saat sonra gönderilebilir.';
  END IF;

  IF v_letter.deletion_approved_at IS NOT NULL THEN
    RAISE EXCEPTION 'Partnerin silmeyi zaten onayladı.';
  END IF;

  IF v_letter.deletion_requested_at IS NOT NULL AND v_letter.deletion_rejected_at IS NULL THEN
    RAISE EXCEPTION 'Silme isteğin zaten partnerinin onayını bekliyor.';
  END IF;

  IF v_letter.deletion_rejected_at IS NOT NULL
     AND now() < v_letter.deletion_rejected_at + INTERVAL '72 hours' THEN
    RAISE EXCEPTION 'Partnerin bu mektubu saklamak istedi. Yeni bir istek 72 saat sonra gönderilebilir.';
  END IF;

  UPDATE public.letters
     SET deletion_requested_at = now(),
         deletion_approved_at  = NULL,
         deletion_rejected_at  = NULL
   WHERE id = p_letter_id;
END;
$$;

REVOKE ALL ON FUNCTION public.request_letter_deletion(BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_letter_deletion(BIGINT) TO authenticated;

COMMIT;
