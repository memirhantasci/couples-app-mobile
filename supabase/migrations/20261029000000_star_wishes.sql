-- ============================================================================
-- Kayan yıldız dilekleri: kişi başı günde 1 dilek hakkı + yıldıza küçük bir ışık katkısı
-- ============================================================================
-- • Dilek METNİ hiçbir yerde saklanmaz ve sunucuya gönderilmez; istemci yalnızca
--   "bugün dilek tuttum" der (make_wish). Tabloda metin sütunu yoktur.
-- • Hak KİŞİ başınadır, çift başına değil: partnerlerin ikisi de tutarsa çift günde en
--   fazla 2 dilek tutar. Gün sınırı diğer aktivitelerle aynıdır (Europe/Istanbul gece
--   yarısı, activity_local_date).
-- • Işık katkısı mevcut puan sistemiyle verilir (20261021000000_star_activity_brightness):
--   star_wishes'a eklenen satırı trg_activity_points_row 'wish' aktivitesi olarak puanlar.
--   Kişi başı günde 1 puan (tam parlaklık 300 puan → ≈ +%0,27 ışık); iki partner = 2 puan.
--   Değer activity_point_rules'tan tek satırla değiştirilebilir.
-- • Dilek tutmamanın cezası YOKTUR: dilek yalnızca puan ekler. Hareketsizlik cezası mevcut
--   kurallarla işler; dilek de bir aktivite olarak sayılır (ruh hali girmek gibi).
-- • İstemci star_wishes'a doğrudan yazamaz; satırı yalnızca make_wish() ekler. Limit
--   UNIQUE (user_id, wish_date) ile veritabanında garanti edilir (iki cihazdan aynı anda
--   istek gelse bile tek satır, tek puan).
-- • Hesap silme (purge_user_account) user_id / couple_id sütunlu tabloları kendiliğinden
--   bulur; bu tablo için ek bir işlem gerekmez.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. TABLO
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.star_wishes (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  -- Dilek anındaki çift; partneri olmayan kullanıcı da (puansız) dilek tutabilir
  couple_id  INTEGER REFERENCES public.couples(id) ON DELETE CASCADE,
  wish_date  DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT star_wishes_one_per_user_day UNIQUE (user_id, wish_date)
);

COMMENT ON TABLE  public.star_wishes IS 'Kayan yıldız dilekleri: kişi başı günde 1. Dilek metni saklanmaz; satır yalnızca hakkın kullanıldığını ve ışık puanını kaydeder.';
COMMENT ON COLUMN public.star_wishes.wish_date IS 'activity_local_date(created_at): Türkiye saatine göre gün.';

CREATE INDEX IF NOT EXISTS idx_star_wishes_couple_date
  ON public.star_wishes (couple_id, wish_date);

ALTER TABLE public.star_wishes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS star_wishes_select_own ON public.star_wishes;
CREATE POLICY star_wishes_select_own
  ON public.star_wishes FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR couple_id = (SELECT public.get_my_couple_id()));

-- Yazma yolu yalnızca make_wish() (SECURITY DEFINER)
REVOKE ALL ON public.star_wishes FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.star_wishes FROM authenticated;
GRANT SELECT ON public.star_wishes TO authenticated;


-- ============================================================================
-- 2. PUAN KURALI: kişi başı günde 1
-- ============================================================================
INSERT INTO public.activity_point_rules (activity_type, points, scope) VALUES
  ('wish', 1, 'user_day')
ON CONFLICT (activity_type) DO UPDATE
  SET points = EXCLUDED.points,
      scope  = EXCLUDED.scope;

ALTER TABLE public.couple_daily_activity
  ADD COLUMN IF NOT EXISTS wish_points SMALLINT NOT NULL DEFAULT 0;

-- apply_activity_points: 'wish' sütunu eklendi; geri kalan her şey önceki sürümle aynıdır.
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

-- Puanı diğer aktivitelerdeki genel trigger verir; satır silinirse (hesap silme) geri alınır.
DROP TRIGGER IF EXISTS trg_activity_points ON public.star_wishes;
CREATE TRIGGER trg_activity_points AFTER INSERT OR DELETE ON public.star_wishes
  FOR EACH ROW EXECUTE FUNCTION public.trg_activity_points_row('wish', 'user_id');


-- ============================================================================
-- 3. İSTEMCİ RPC'LERİ
-- ============================================================================

-- 3.1 Bugünkü dilek hakkını kullanır. Dilek metni parametre olarak ALINMAZ.
--   { ok: true,  points: <verilen puan>, resets_at }          → dilek kaydedildi
--   { ok: false, reason: 'already_used', points: 0, resets_at } → bugünkü hak zaten kullanılmış
-- points: çifti olmayan kullanıcıda 0 (dilek yine tutulur, yalnızca ışık katkısı olmaz).
CREATE OR REPLACE FUNCTION public.make_wish()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id   UUID := auth.uid();
  v_couple_id INTEGER;
  v_today     DATE := public.activity_local_date(NOW());
  v_resets_at TIMESTAMPTZ := ((public.activity_local_date(NOW()) + 1)::timestamp AT TIME ZONE 'Europe/Istanbul');
  v_wish_id   BIGINT;
  v_points    INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Yetkisiz işlem: oturum bulunamadı.' USING ERRCODE = '42501';
  END IF;

  SELECT u.couple_id INTO v_couple_id FROM public.users AS u WHERE u.id = v_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Yetkisiz işlem: kullanıcı profili bulunamadı.' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.star_wishes (user_id, couple_id, wish_date)
  VALUES (v_user_id, v_couple_id, v_today)
  ON CONFLICT ON CONSTRAINT star_wishes_one_per_user_day DO NOTHING
  RETURNING id INTO v_wish_id;

  IF v_wish_id IS NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'reason', 'already_used', 'points', 0, 'resets_at', v_resets_at);
  END IF;

  -- AFTER INSERT trigger'ı bu noktada çalışmış ve puanı yazmıştır
  SELECT COALESCE(SUM(l.points), 0)::integer INTO v_points
    FROM public.couple_activity_log AS l
   WHERE l.source_key = 'star_wishes:' || v_wish_id::text
     AND l.status = 'awarded';

  RETURN jsonb_build_object('ok', TRUE, 'points', v_points, 'resets_at', v_resets_at);
END;
$$;

-- 3.2 Bugünkü dilek hakkının durumu (meteor yakalanınca istemci dilek ekranını açıp açmayacağına bakar).
CREATE OR REPLACE FUNCTION public.get_my_wish_status()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id      UUID := auth.uid();
  v_couple_id    INTEGER;
  v_today        DATE := public.activity_local_date(NOW());
  v_used         BOOLEAN;
  v_partner_used BOOLEAN := FALSE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Yetkisiz işlem: oturum bulunamadı.' USING ERRCODE = '42501';
  END IF;

  v_couple_id := public.get_my_couple_id();

  SELECT EXISTS (
    SELECT 1 FROM public.star_wishes AS w
     WHERE w.user_id = v_user_id AND w.wish_date = v_today
  ) INTO v_used;

  IF v_couple_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.star_wishes AS w
       WHERE w.couple_id = v_couple_id AND w.user_id <> v_user_id AND w.wish_date = v_today
    ) INTO v_partner_used;
  END IF;

  RETURN jsonb_build_object(
    'available',          NOT v_used,
    'used_today',         v_used,
    'partner_used_today', v_partner_used,
    'resets_at',          ((v_today + 1)::timestamp AT TIME ZONE 'Europe/Istanbul')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.make_wish()          FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_wish_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.make_wish()          TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_wish_status() TO authenticated;

COMMIT;
