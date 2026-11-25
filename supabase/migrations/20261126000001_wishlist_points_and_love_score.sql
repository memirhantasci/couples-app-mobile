-- ============================================================================
-- MIGRATION: 20261126000001_wishlist_points_and_love_score.sql
-- "Birlikte Yapacaklarımız" (Ortak Liste) → Yıldız Parlaklığı & Aşk Skoru
-- ============================================================================
-- Kurallar (anti-abuse & günlük limit korumalı):
--   1. wishlist_add  (+1 puan, user_day):   Kişi başı günde en fazla 1 puan.
--      Aynı gün 20 fikir eklense de 1 puan; aynı gün silinirse puan geri alınır.
--   2. wishlist_done (+2 puan, couple_day): Çift başı günde en fazla 1 puan.
--      source_key = 'couple_wishlist_items:<id>:done'.
--      Aynı gün done → open geri alınırsa (veya madde silinirse) puan geri çekilir;
--      sıradaki 'capped' tamamlanan madde varsa puanı devralır.
--      Ertesi gün geri açıp tekrar "yaptık" işaretlemek puan vermez (dünkü kayıt
--      'awarded' kaldığı için source_key zaten canlıdır).
--   3. 💗 "İstiyorum" (couple_wishlist_wants) puan vermez — spam yüzeyi sıfır.
--   4. get_couple_love_activity(): wishlist_add_authors_recent (son 14 gün) ve
--      wishlist_done_recent (son 30 gün) eklenir; paired & paired_at koruması
--      aynen korunur.
-- ============================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Puan kuralları ve günlük döküm sütunları
-- ────────────────────────────────────────────────────────────────────────────
INSERT INTO public.activity_point_rules (activity_type, points, scope) VALUES
  ('wishlist_add',  1, 'user_day'),    -- Ortak listeye yeni fikir ekleme (kişi başı günde 1)
  ('wishlist_done', 2, 'couple_day')   -- Birlikte yapılan madde (çift başı günde 1)
ON CONFLICT (activity_type) DO UPDATE
  SET points = EXCLUDED.points,
      scope  = EXCLUDED.scope;

ALTER TABLE public.couple_daily_activity
  ADD COLUMN IF NOT EXISTS wishlist_add_points  SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wishlist_done_points SMALLINT NOT NULL DEFAULT 0;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. apply_activity_points (wish_points dahil mevcut tüm sütunlar korunur)
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.apply_activity_points(
  p_couple_id     INTEGER,
  p_activity_date DATE,
  p_activity_type TEXT,
  p_delta         INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_delta = 0 THEN
    RETURN;
  END IF;

  IF p_delta > 0 THEN
    INSERT INTO public.couple_daily_activity (couple_id, activity_date)
    VALUES (p_couple_id, p_activity_date)
    ON CONFLICT (couple_id, activity_date) DO NOTHING;
  END IF;

  UPDATE public.couple_daily_activity AS d
     SET mood_points            = GREATEST(0, d.mood_points            + CASE WHEN p_activity_type = 'mood'            THEN p_delta ELSE 0 END),
         medicine_points        = GREATEST(0, d.medicine_points        + CASE WHEN p_activity_type = 'medicine'        THEN p_delta ELSE 0 END),
         calendar_note_points   = GREATEST(0, d.calendar_note_points   + CASE WHEN p_activity_type = 'calendar_note'   THEN p_delta ELSE 0 END),
         pinned_note_points     = GREATEST(0, d.pinned_note_points     + CASE WHEN p_activity_type = 'pinned_note'     THEN p_delta ELSE 0 END),
         period_tracking_points = GREATEST(0, d.period_tracking_points + CASE WHEN p_activity_type = 'period_tracking' THEN p_delta ELSE 0 END),
         letter_points          = GREATEST(0, d.letter_points          + CASE WHEN p_activity_type = 'letter'          THEN p_delta ELSE 0 END),
         planet_points          = GREATEST(0, d.planet_points          + CASE WHEN p_activity_type = 'planet'          THEN p_delta ELSE 0 END),
         photo_points           = GREATEST(0, d.photo_points           + CASE WHEN p_activity_type = 'photo'           THEN p_delta ELSE 0 END),
         diary_points           = GREATEST(0, d.diary_points           + CASE WHEN p_activity_type = 'diary'           THEN p_delta ELSE 0 END),
         profile_pic_points     = GREATEST(0, d.profile_pic_points     + CASE WHEN p_activity_type = 'profile_pic'     THEN p_delta ELSE 0 END),
         meeting_points         = GREATEST(0, d.meeting_points         + CASE WHEN p_activity_type = 'meeting'         THEN p_delta ELSE 0 END),
         memory_points          = GREATEST(0, d.memory_points          + CASE WHEN p_activity_type = 'memory'          THEN p_delta ELSE 0 END),
         wish_points            = GREATEST(0, d.wish_points            + CASE WHEN p_activity_type = 'wish'            THEN p_delta ELSE 0 END),
         wishlist_add_points    = GREATEST(0, d.wishlist_add_points    + CASE WHEN p_activity_type = 'wishlist_add'    THEN p_delta ELSE 0 END),
         wishlist_done_points   = GREATEST(0, d.wishlist_done_points   + CASE WHEN p_activity_type = 'wishlist_done'   THEN p_delta ELSE 0 END),
         daily_total            = GREATEST(0, d.daily_total + p_delta),
         updated_at             = NOW()
   WHERE d.couple_id = p_couple_id
     AND d.activity_date = p_activity_date;

  IF p_delta > 0 THEN
    INSERT INTO public.couple_activity_score AS s (couple_id, cumulative_score, last_activity_date)
    VALUES (p_couple_id, p_delta, p_activity_date)
    ON CONFLICT (couple_id) DO UPDATE
      SET cumulative_score   = s.cumulative_score + EXCLUDED.cumulative_score,
          last_activity_date = GREATEST(s.last_activity_date, EXCLUDED.last_activity_date),
          updated_at         = NOW();
  ELSE
    UPDATE public.couple_activity_score AS s
       SET cumulative_score = GREATEST(0, s.cumulative_score + p_delta),
           updated_at       = NOW()
     WHERE s.couple_id = p_couple_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_activity_points(INTEGER, DATE, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. couple_wishlist_items puan trigger'ları
-- ────────────────────────────────────────────────────────────────────────────
-- 3.1 Fikir ekleme (wishlist_add): ekleme +1 (kişi/gün), aynı gün silme -1
DROP TRIGGER IF EXISTS trg_activity_points_wishlist_add ON public.couple_wishlist_items;
CREATE TRIGGER trg_activity_points_wishlist_add
  AFTER INSERT OR DELETE ON public.couple_wishlist_items
  FOR EACH ROW EXECUTE FUNCTION public.trg_activity_points_row('wishlist_add', 'created_by');

-- 3.2 Birlikte yaptık (wishlist_done): open → done (+2, çift/gün), done → open veya done iken silme geri alır
CREATE OR REPLACE FUNCTION public.trg_activity_points_wishlist_done()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_source TEXT;
  v_user   UUID;
BEGIN
  BEGIN
    IF TG_OP = 'DELETE' THEN
      IF OLD.status = 'done' THEN
        PERFORM public.revoke_couple_activity('couple_wishlist_items:' || OLD.id::text || ':done');
      END IF;
      RETURN NULL;
    END IF;

    v_source := 'couple_wishlist_items:' || NEW.id::text || ':done';

    IF OLD.status = 'done' AND NEW.status IS DISTINCT FROM 'done' THEN
      PERFORM public.revoke_couple_activity(v_source);
    END IF;

    IF NEW.status = 'done' AND OLD.status IS DISTINCT FROM 'done' THEN
      v_user := COALESCE(NEW.done_by, auth.uid(), NEW.created_by);
      PERFORM public.award_couple_activity(NEW.couple_id, v_user, 'wishlist_done', v_source);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Yıldız puanı işlenemedi (%.wishlist_done %): %', TG_TABLE_NAME, TG_OP, SQLERRM;
  END;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.trg_activity_points_wishlist_done() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_activity_points_wishlist_done ON public.couple_wishlist_items;
CREATE TRIGGER trg_activity_points_wishlist_done
  AFTER UPDATE OF status OR DELETE ON public.couple_wishlist_items
  FOR EACH ROW EXECUTE FUNCTION public.trg_activity_points_wishlist_done();

-- ────────────────────────────────────────────────────────────────────────────
-- 4. Aşk skoru aktivite özeti (paired & paired_at koruması aynen korunur)
-- ────────────────────────────────────────────────────────────────────────────
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
    'wishlist_add_authors_recent', (
      SELECT count(DISTINCT log.user_id)::integer FROM log
       WHERE log.activity_type = 'wishlist_add' AND log.activity_date >= me.today - 14),
    'wishlist_done_recent', (
      SELECT count(*)::integer FROM log
       WHERE log.activity_type = 'wishlist_done' AND log.activity_date >= me.today - 30),
    'paired', me.paired
  )
  FROM me
  WHERE me.couple_id IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.get_couple_love_activity() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_couple_love_activity() TO authenticated;

COMMIT;
