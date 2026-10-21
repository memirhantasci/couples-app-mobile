-- ============================================================================
-- MIGRATION: 20261021000000_star_activity_brightness.sql
-- "Bizim Yıldızımız" — Aktiviteye dayalı yıldız parlaklığı
-- ============================================================================
-- Çiftler uygulamayı ne kadar aktif kullanırsa yıldızları gökyüzünde o kadar
-- parlak görünür.
--
--   aktivite tablosu ──trigger──► couple_activity_log     (denetim + günlük limit)
--                                 couple_daily_activity   (gün gün puan dökümü)
--                                 couple_activity_score   (kümülatif skor + parlaklık önbelleği)
--
-- Tasarım kararları:
--   • Puan, istemcinin çağırdığı bir "log" RPC'siyle DEĞİL, gerçek kayıt
--     tablolarındaki trigger'larla verilir. Puan yalnızca gerçekten yapılmış bir
--     aktiviteye karşılık gelir; bir fonksiyonu elle çağırarak puan toplanamaz.
--     Puanı kazandıran kayıt silinirse puan geri alınır; düzenleme puan vermez.
--   • Günlük limitler couple_activity_log üzerindeki kısmi UNIQUE index ile
--     veritabanında garanti edilir. Limit dolduktan sonraki aktiviteler 0 puanla
--     'capped' tutulur; puanı kazanan kayıt silinirse sıradaki 'capped' kayıt
--     puanı devralır (ör. aynı gün 2 mektup, ilki silinirse ikincisi sayılır).
--   • Puan trigger'ları asıl işlemi ASLA engellemez: puanlama hata verirse
--     WARNING loglanır, kullanıcının mektubu / fotoğrafı yine kaydedilir.
--   • Parlaklık = 0.20 + (skor / 300) × 0.80, tavan 1.00. Skor her aktivitede
--     anında güncellenir; gece cron'u yalnızca buluşmaları ödüllendirir ve
--     hareketsizlik cezasını uygular (puanlar iki kez sayılmaz).
--   • Gün sınırı Türkiye saatidir (Europe/Istanbul): "günde 1" hakkı
--     kullanıcının gece yarısında yenilenir; cron 00:05'te (21:05 UTC) çalışır.
--   • Makro gökyüzünde gerçek parlaklık yalnızca kendi yıldızınız ve kabul
--     edilmiş yıldız bağlantılarınız (star_connections) için döner. Diğer
--     tescilli yıldızlar izleyiciye ve güne göre sabit "gizemli" bir değer alır
--     (kare kare titremez, gün içinde değişmez). Yabancı çiftlerin gerçek skoru
--     veritabanından hiç çıkmaz. Sahipsiz yıldızlar 0.20 döner.
--   • Geçmiş aktiviteler geriye dönük puanlanmaz: tüm çiftler eşit başlar.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. SABİTLER VE SAF YARDIMCILAR
-- ============================================================================

-- Aktivite günü: Türkiye saatine göre takvim günü.
CREATE OR REPLACE FUNCTION public.activity_local_date(p_at TIMESTAMPTZ)
RETURNS DATE
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT (p_at AT TIME ZONE 'Europe/Istanbul')::date
$$;

-- Parlaklığın tavana (1.00) ulaştığı kümülatif skor.
CREATE OR REPLACE FUNCTION public.star_brightness_full_score()
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT 300
$$;

CREATE OR REPLACE FUNCTION public.calculate_star_brightness(p_score INTEGER)
RETURNS NUMERIC(3,2)
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT ROUND(
    LEAST(1.00, 0.20 + GREATEST(COALESCE(p_score, 0), 0)::numeric / public.star_brightness_full_score() * 0.80),
    2
  )::numeric(3,2)
$$;

-- Bağlantı kurulmamış tescilli yıldızların "gizemli" parlaklığı: 0.10 – 0.90.
-- Aynı izleyici aynı gün aynı yıldızı hep aynı parlaklıkta görür.
CREATE OR REPLACE FUNCTION public.star_mystery_brightness(
  p_catalog_id       BIGINT,
  p_viewer_couple_id INTEGER,
  p_day              DATE
)
RETURNS NUMERIC(3,2)
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT ROUND(
    0.10 + 0.80 * ((hashtext(p_catalog_id::text || ':' || p_viewer_couple_id::text || ':' || p_day::text)::bigint
                    + 2147483648) / 4294967295.0),
    2
  )::numeric(3,2)
$$;

-- Bir aktivite kaydının kalıcı kimliği ("tablo:id"). Tabloda id yoksa doğal
-- anahtar sütunlarından üretilir; ikisi de yoksa NULL döner (puan verilmez).
CREATE OR REPLACE FUNCTION public.activity_source_key(
  p_table       TEXT,
  p_row         JSONB,
  p_key_columns TEXT[]
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT p_table || ':' || COALESCE(
    p_row->>'id',
    NULLIF(
      (SELECT string_agg(COALESCE(p_row->>k.col, ''), ':' ORDER BY k.ord)
         FROM unnest(p_key_columns) WITH ORDINALITY AS k(col, ord)),
      ''
    )
  )
$$;


-- ============================================================================
-- 2. TABLOLAR
-- ============================================================================

-- 2.1 Puan kuralları (tek kaynak; değerler buradan ayarlanır)
--   user_day     → kişi başına günde 1
--   couple_day   → çift başına günde 1
--   couple_month → çift başına takvim ayında 1
--   user_once    → kişi başına bir kez
CREATE TABLE IF NOT EXISTS public.activity_point_rules (
  activity_type TEXT PRIMARY KEY,
  points        SMALLINT NOT NULL CHECK (points > 0),
  scope         TEXT NOT NULL CHECK (scope IN ('user_day', 'couple_day', 'couple_month', 'user_once'))
);

COMMENT ON TABLE public.activity_point_rules IS 'Yıldız parlaklığı puan kuralları: aktivite tipi, puan ve tekrar limiti.';

INSERT INTO public.activity_point_rules (activity_type, points, scope) VALUES
  ('mood',            1, 'user_day'),     -- Ruh hali (gün içindeki değişiklikler sayılmaz)
  ('medicine',        1, 'user_day'),     -- İlacını alan kişi
  ('calendar_note',   1, 'user_day'),     -- Takvim notu
  ('pinned_note',     1, 'user_day'),     -- Haritaya bırakılan not
  ('period_tracking', 2, 'couple_month'), -- Regl başlangıcı
  ('letter',          2, 'user_day'),     -- Mektup (gönderen)
  ('planet',          2, 'couple_day'),   -- Elle oluşturulan anı gezegeni
  ('photo',           1, 'user_day'),     -- Fotoğraf (N tane = 1)
  ('diary',           1, 'user_day'),     -- Günlük sayfası
  ('profile_pic',     1, 'user_once'),    -- İlk profil fotoğrafı
  ('meeting',         4, 'couple_day'),   -- Gerçekleşen buluşma (çifte toplam)
  ('memory',          1, 'user_day')      -- Anı kaydı
ON CONFLICT (activity_type) DO UPDATE
  SET points = EXCLUDED.points,
      scope  = EXCLUDED.scope;

-- 2.2 Aktivite günlüğü (denetim, limit ve geri alma kaydı)
CREATE TABLE IF NOT EXISTS public.couple_activity_log (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  couple_id     INTEGER NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES public.users(id) ON DELETE SET NULL,
  activity_type TEXT NOT NULL REFERENCES public.activity_point_rules(activity_type),
  activity_date DATE NOT NULL,
  dedupe_key    TEXT NOT NULL,
  source_key    TEXT NOT NULL,
  points        SMALLINT NOT NULL DEFAULT 0 CHECK (points >= 0),
  status        TEXT NOT NULL CHECK (status IN ('awarded', 'capped', 'revoked')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at    TIMESTAMPTZ
);

COMMENT ON TABLE  public.couple_activity_log IS 'Puan kazandıran her aktivite: awarded (puan aldı), capped (günlük limit doluydu), revoked (kayıt silindi).';
COMMENT ON COLUMN public.couple_activity_log.dedupe_key IS 'Limit anahtarı (ör. letter:<user>:<gün>). Çift başına aynı anahtarla yalnızca bir awarded kayıt olabilir.';
COMMENT ON COLUMN public.couple_activity_log.source_key IS 'Aktiviteyi doğuran kayıt (tablo:id). Kayıt silinince bu anahtarla geri alınır.';

-- Günlük limitin veritabanı garantisi
CREATE UNIQUE INDEX IF NOT EXISTS uq_couple_activity_log_awarded
  ON public.couple_activity_log (couple_id, dedupe_key)
  WHERE status = 'awarded';
-- Bir kayıt aynı anda en fazla bir canlı (iptal edilmemiş) puan girdisine sahiptir
CREATE UNIQUE INDEX IF NOT EXISTS uq_couple_activity_log_live_source
  ON public.couple_activity_log (source_key)
  WHERE status <> 'revoked';
-- Puan devri: sıradaki capped kaydı bulma
CREATE INDEX IF NOT EXISTS idx_couple_activity_log_capped
  ON public.couple_activity_log (couple_id, dedupe_key, id)
  WHERE status = 'capped';
CREATE INDEX IF NOT EXISTS idx_couple_activity_log_couple_created
  ON public.couple_activity_log (couple_id, created_at DESC);

-- 2.3 Günlük puan dökümü
CREATE TABLE IF NOT EXISTS public.couple_daily_activity (
  couple_id              INTEGER NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  activity_date          DATE NOT NULL,
  mood_points            SMALLINT NOT NULL DEFAULT 0,
  medicine_points        SMALLINT NOT NULL DEFAULT 0,
  calendar_note_points   SMALLINT NOT NULL DEFAULT 0,
  pinned_note_points     SMALLINT NOT NULL DEFAULT 0,
  period_tracking_points SMALLINT NOT NULL DEFAULT 0,
  letter_points          SMALLINT NOT NULL DEFAULT 0,
  planet_points          SMALLINT NOT NULL DEFAULT 0,
  photo_points           SMALLINT NOT NULL DEFAULT 0,
  diary_points           SMALLINT NOT NULL DEFAULT 0,
  profile_pic_points     SMALLINT NOT NULL DEFAULT 0,
  meeting_points         SMALLINT NOT NULL DEFAULT 0,
  memory_points          SMALLINT NOT NULL DEFAULT 0,
  daily_total            SMALLINT NOT NULL DEFAULT 0,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (couple_id, activity_date)
);

COMMENT ON TABLE public.couple_daily_activity IS 'Çiftin her günü için aktivite tipine göre kazanılan puanlar.';

-- 2.4 Kümülatif skor ve parlaklık önbelleği (makro gökyüzü bunu okur)
CREATE TABLE IF NOT EXISTS public.couple_activity_score (
  couple_id             INTEGER PRIMARY KEY REFERENCES public.couples(id) ON DELETE CASCADE,
  cumulative_score      INTEGER NOT NULL DEFAULT 0 CHECK (cumulative_score >= 0),
  brightness            NUMERIC(3,2) NOT NULL DEFAULT 0.20,
  brightness_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity_date    DATE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.couple_activity_score IS 'Çiftin tüm zamanların puanı (ceza düşülmüş) ve buna göre hesaplanmış yıldız parlaklığı.';
COMMENT ON COLUMN public.couple_activity_score.brightness IS 'calculate_star_brightness(cumulative_score); trigger ile her yazımda güncellenir.';

-- Hareketsizlik cezası taraması yalnızca puanı olan çiftlere bakar
CREATE INDEX IF NOT EXISTS idx_couple_activity_score_decay
  ON public.couple_activity_score (last_activity_date)
  WHERE cumulative_score > 0;

-- 2.5 Gece işinin durumu (ceza aynı gün için iki kez uygulanmaz, kaçırılan geceler telafi edilir)
CREATE TABLE IF NOT EXISTS public.star_brightness_job_state (
  id                    BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  decay_applied_through DATE NOT NULL
);

INSERT INTO public.star_brightness_job_state (id, decay_applied_through)
VALUES (TRUE, public.activity_local_date(NOW()) - 1)
ON CONFLICT (id) DO NOTHING;


-- ============================================================================
-- 3. PARLAKLIK ÖNBELLEĞİ TRIGGER'I
-- ============================================================================
CREATE OR REPLACE FUNCTION public.trg_couple_activity_score_brightness()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.brightness := public.calculate_star_brightness(NEW.cumulative_score);
  IF TG_OP = 'INSERT' OR NEW.brightness IS DISTINCT FROM OLD.brightness THEN
    NEW.brightness_updated_at := NOW();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_couple_activity_score_brightness ON public.couple_activity_score;
CREATE TRIGGER trg_couple_activity_score_brightness
  BEFORE INSERT OR UPDATE ON public.couple_activity_score
  FOR EACH ROW EXECUTE FUNCTION public.trg_couple_activity_score_brightness();


-- ============================================================================
-- 4. PUAN MOTORU (yalnızca trigger'lar ve cron çağırır; istemciye kapalı)
-- ============================================================================

-- 4.1 Günlük dökümü ve kümülatif skoru p_delta kadar değiştirir (negatif = geri alma).
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

-- 4.2 Bir aktiviteyi kaydeder; limit izin veriyorsa puanı verir. Verilen puanı döner.
CREATE OR REPLACE FUNCTION public.award_couple_activity(
  p_couple_id     INTEGER,
  p_user_id       UUID,
  p_activity_type TEXT,
  p_source_key    TEXT,
  p_activity_date DATE DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_points SMALLINT;
  v_scope  TEXT;
  v_date   DATE;
  v_key    TEXT;
BEGIN
  IF p_couple_id IS NULL OR p_source_key IS NULL THEN
    RETURN 0;
  END IF;

  SELECT r.points, r.scope INTO v_points, v_scope
    FROM public.activity_point_rules AS r
   WHERE r.activity_type = p_activity_type;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bilinmeyen aktivite tipi: %', p_activity_type USING ERRCODE = '22023';
  END IF;

  -- Kişi bazlı kural kimin yaptığını bilmeden uygulanamaz (sistem/servis kayıtları puan almaz)
  IF v_scope IN ('user_day', 'user_once') AND p_user_id IS NULL THEN
    RETURN 0;
  END IF;

  v_date := COALESCE(p_activity_date, public.activity_local_date(NOW()));
  v_key := p_activity_type || ':' || CASE v_scope
    WHEN 'user_day'     THEN p_user_id::text || ':' || v_date::text
    WHEN 'user_once'    THEN p_user_id::text
    WHEN 'couple_day'   THEN v_date::text
    WHEN 'couple_month' THEN to_char(v_date, 'YYYY-MM')
  END;

  -- Aynı çiftin eşzamanlı puan işlemleri sıralanır (iki partner aynı anda mektup yazsa bile)
  PERFORM pg_advisory_xact_lock(hashtext('couple_activity_lock'), p_couple_id);

  IF EXISTS (
    SELECT 1 FROM public.couple_activity_log AS l
     WHERE l.source_key = p_source_key AND l.status <> 'revoked'
  ) THEN
    RETURN 0;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.couple_activity_log AS l
     WHERE l.couple_id = p_couple_id AND l.dedupe_key = v_key AND l.status = 'awarded'
  ) THEN
    INSERT INTO public.couple_activity_log
      (couple_id, user_id, activity_type, activity_date, dedupe_key, source_key, points, status)
    VALUES
      (p_couple_id, p_user_id, p_activity_type, v_date, v_key, p_source_key, 0, 'capped');
    RETURN 0;
  END IF;

  INSERT INTO public.couple_activity_log
    (couple_id, user_id, activity_type, activity_date, dedupe_key, source_key, points, status)
  VALUES
    (p_couple_id, p_user_id, p_activity_type, v_date, v_key, p_source_key, v_points, 'awarded');

  PERFORM public.apply_activity_points(p_couple_id, v_date, p_activity_type, v_points);
  RETURN v_points;
END;
$$;

-- 4.3 Kaydı silinen / geçersizleşen aktivitenin puanını geri alır. Puanı kazanan kayıt
-- geri alınırsa aynı limit anahtarındaki ilk 'capped' kayıt puanı devralır.
-- Net düşülen puanı döner.
CREATE OR REPLACE FUNCTION public.revoke_couple_activity(p_source_key TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_entry     public.couple_activity_log%ROWTYPE;
  v_entry_id  BIGINT;
  v_next_id   BIGINT;
  v_next_date DATE;
  v_removed   INTEGER := 0;
BEGIN
  IF p_source_key IS NULL THEN
    RETURN 0;
  END IF;

  FOR v_entry_id IN
    SELECT l.id FROM public.couple_activity_log AS l
     WHERE l.source_key = p_source_key AND l.status <> 'revoked'
  LOOP
    SELECT * INTO v_entry FROM public.couple_activity_log AS l WHERE l.id = v_entry_id;

    -- Çift silinirken (CASCADE) puan tabloları zaten temizleniyor
    IF NOT EXISTS (SELECT 1 FROM public.couples AS c WHERE c.id = v_entry.couple_id) THEN
      CONTINUE;
    END IF;

    PERFORM pg_advisory_xact_lock(hashtext('couple_activity_lock'), v_entry.couple_id);

    -- Kilidi beklerken başka bir işlem durumu değiştirmiş olabilir: güncel hali oku
    SELECT * INTO v_entry FROM public.couple_activity_log AS l WHERE l.id = v_entry_id FOR UPDATE;
    IF v_entry.status = 'revoked' THEN
      CONTINUE;
    END IF;

    UPDATE public.couple_activity_log AS l
       SET status = 'revoked', revoked_at = NOW()
     WHERE l.id = v_entry_id;

    IF v_entry.status = 'awarded' THEN
      PERFORM public.apply_activity_points(v_entry.couple_id, v_entry.activity_date, v_entry.activity_type, -v_entry.points);
      v_removed := v_removed + v_entry.points;

      SELECT l.id, l.activity_date INTO v_next_id, v_next_date
        FROM public.couple_activity_log AS l
       WHERE l.couple_id = v_entry.couple_id
         AND l.dedupe_key = v_entry.dedupe_key
         AND l.status = 'capped'
       ORDER BY l.id
       LIMIT 1
       FOR UPDATE;

      IF v_next_id IS NOT NULL THEN
        UPDATE public.couple_activity_log AS l
           SET status = 'awarded', points = v_entry.points
         WHERE l.id = v_next_id;
        PERFORM public.apply_activity_points(v_entry.couple_id, v_next_date, v_entry.activity_type, v_entry.points);
        v_removed := v_removed - v_entry.points;
      END IF;
    END IF;
  END LOOP;

  RETURN v_removed;
END;
$$;


-- ============================================================================
-- 5. AKTİVİTE TRIGGER'LARI
-- ============================================================================
-- Tablo şemaları kısmen istemci tarafında evrildiğinden satırlar to_jsonb ile
-- okunur: bir tabloda beklenen sütun yoksa trigger hata vermez, NULL görür.

-- 5.1 Genel ekleme/silme trigger'ı
--   TG_ARGV[0] aktivite tipi
--   TG_ARGV[1] kişiyi tutan sütun ('' → işlemi yapan oturum: auth.uid())
--   TG_ARGV[2] id sütunu yoksa doğal anahtar sütunları (virgülle)
CREATE OR REPLACE FUNCTION public.trg_activity_points_row()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_type        TEXT   := TG_ARGV[0];
  v_user_column TEXT   := NULLIF(TG_ARGV[1], '');
  v_key_columns TEXT[] := string_to_array(NULLIF(COALESCE(TG_ARGV[2], ''), ''), ',');
  v_row         JSONB;
  v_source      TEXT;
  v_user        UUID;
  v_couple      INTEGER;
BEGIN
  BEGIN
    IF TG_OP = 'DELETE' THEN
      v_row := to_jsonb(OLD);
      PERFORM public.revoke_couple_activity(public.activity_source_key(TG_TABLE_NAME, v_row, v_key_columns));
      RETURN NULL;
    END IF;

    v_row := to_jsonb(NEW);

    -- Otomatik (fotoğraf/mektup yüklerken açılan) gezegenler ayrıca puanlanmaz
    IF v_type = 'planet' AND COALESCE((v_row->>'is_auto_generated')::boolean, FALSE) THEN
      RETURN NULL;
    END IF;
    IF v_type = 'period_tracking' AND COALESCE(v_row->>'type', 'period') <> 'period' THEN
      RETURN NULL;
    END IF;

    v_user := COALESCE(NULLIF(v_row->>v_user_column, '')::uuid, auth.uid());

    v_couple := NULLIF(v_row->>'couple_id', '')::integer;
    IF v_couple IS NULL AND v_row ? 'star_id' THEN
      SELECT cs.couple_id INTO v_couple
        FROM public.couple_stars AS cs
       WHERE cs.id = (v_row->>'star_id')::uuid;
    END IF;
    IF v_couple IS NULL AND v_user IS NOT NULL THEN
      SELECT u.couple_id INTO v_couple FROM public.users AS u WHERE u.id = v_user;
    END IF;

    PERFORM public.award_couple_activity(
      v_couple, v_user, v_type, public.activity_source_key(TG_TABLE_NAME, v_row, v_key_columns)
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Yıldız puanı işlenemedi (%.% %): %', TG_TABLE_NAME, v_type, TG_OP, SQLERRM;
  END;
  RETURN NULL;
END;
$$;

-- 5.2 İlaç: dozu "DRANK" işaretlenince ilacın sahibi +1 (günde 1); işaret kalkınca geri alınır.
CREATE OR REPLACE FUNCTION public.trg_activity_points_medicine()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  c_key_columns CONSTANT TEXT[] := ARRAY['user_id', 'medicine_id', 'date', 'time'];
  v_old    JSONB;
  v_new    JSONB;
  v_user   UUID;
  v_couple INTEGER;
BEGIN
  BEGIN
    IF TG_OP <> 'INSERT' THEN v_old := to_jsonb(OLD); END IF;
    IF TG_OP <> 'DELETE' THEN v_new := to_jsonb(NEW); END IF;

    IF v_old->>'status' = 'DRANK' AND (v_new IS NULL OR v_new->>'status' IS DISTINCT FROM 'DRANK') THEN
      PERFORM public.revoke_couple_activity(public.activity_source_key(TG_TABLE_NAME, v_old, c_key_columns));
    END IF;

    IF v_new->>'status' = 'DRANK' AND (v_old IS NULL OR v_old->>'status' IS DISTINCT FROM 'DRANK') THEN
      -- Puan dozu işaretleyene değil, ilacın sahibine yazılır
      SELECT m.user_id INTO v_user
        FROM public.medicines AS m
       WHERE m.id::text = v_new->>'medicine_id';
      v_user := COALESCE(v_user, NULLIF(v_new->>'user_id', '')::uuid);

      v_couple := NULLIF(v_new->>'couple_id', '')::integer;
      IF v_couple IS NULL AND v_user IS NOT NULL THEN
        SELECT u.couple_id INTO v_couple FROM public.users AS u WHERE u.id = v_user;
      END IF;

      PERFORM public.award_couple_activity(
        v_couple, v_user, 'medicine', public.activity_source_key(TG_TABLE_NAME, v_new, c_key_columns)
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Yıldız puanı işlenemedi (%.medicine %): %', TG_TABLE_NAME, TG_OP, SQLERRM;
  END;
  RETURN NULL;
END;
$$;

-- 5.3 Profil fotoğrafı: ilk kez eklenince +1; kaldırılırsa geri alınır (yeniden eklemek
-- puanı geri getirir, fotoğraf değiştirmek puan vermez).
CREATE OR REPLACE FUNCTION public.trg_activity_points_avatar()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  BEGIN
    IF OLD.avatar_url IS NULL AND NEW.avatar_url IS NOT NULL THEN
      PERFORM public.award_couple_activity(NEW.couple_id, NEW.id, 'profile_pic', 'users:' || NEW.id::text || ':avatar');
    ELSIF OLD.avatar_url IS NOT NULL AND NEW.avatar_url IS NULL THEN
      PERFORM public.revoke_couple_activity('users:' || NEW.id::text || ':avatar');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Yıldız puanı işlenemedi (users.profile_pic): %', SQLERRM;
  END;
  RETURN NULL;
END;
$$;

-- 5.4 Buluşma: puanı gece cron'u verir (award_completed_meetings). Ödüllendirilmiş bir
-- buluşma silinir, iptal edilir (is_active = false) veya ileri tarihe alınırsa geri alınır.
CREATE OR REPLACE FUNCTION public.trg_activity_points_meeting()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  BEGIN
    IF TG_OP = 'DELETE' THEN
      PERFORM public.revoke_couple_activity('meetings:' || OLD.id::text);
    ELSIF NEW.is_active IS NOT TRUE OR NEW.meeting_datetime > NOW() THEN
      PERFORM public.revoke_couple_activity('meetings:' || NEW.id::text);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Yıldız puanı işlenemedi (meetings %): %', TG_OP, SQLERRM;
  END;
  RETURN NULL;
END;
$$;

-- 5.5 Trigger bağlantıları
DROP TRIGGER IF EXISTS trg_activity_points ON public.moods;
CREATE TRIGGER trg_activity_points AFTER INSERT OR DELETE ON public.moods
  FOR EACH ROW EXECUTE FUNCTION public.trg_activity_points_row('mood', 'user_id');

DROP TRIGGER IF EXISTS trg_activity_points ON public.calendar_notes;
CREATE TRIGGER trg_activity_points AFTER INSERT OR DELETE ON public.calendar_notes
  FOR EACH ROW EXECUTE FUNCTION public.trg_activity_points_row('calendar_note', 'user_id');

DROP TRIGGER IF EXISTS trg_activity_points ON public.map_notes;
CREATE TRIGGER trg_activity_points AFTER INSERT OR DELETE ON public.map_notes
  FOR EACH ROW EXECUTE FUNCTION public.trg_activity_points_row('pinned_note', 'user_id');

DROP TRIGGER IF EXISTS trg_activity_points ON public.period_logs;
CREATE TRIGGER trg_activity_points AFTER INSERT OR DELETE ON public.period_logs
  FOR EACH ROW EXECUTE FUNCTION public.trg_activity_points_row('period_tracking', 'user_id', 'user_id,date');

DROP TRIGGER IF EXISTS trg_activity_points ON public.letters;
CREATE TRIGGER trg_activity_points AFTER INSERT OR DELETE ON public.letters
  FOR EACH ROW EXECUTE FUNCTION public.trg_activity_points_row('letter', 'sender_id');

DROP TRIGGER IF EXISTS trg_activity_points ON public.star_exoplanets;
CREATE TRIGGER trg_activity_points AFTER INSERT OR DELETE ON public.star_exoplanets
  FOR EACH ROW EXECUTE FUNCTION public.trg_activity_points_row('planet', '');

DROP TRIGGER IF EXISTS trg_activity_points ON public.photo_archive;
CREATE TRIGGER trg_activity_points AFTER INSERT OR DELETE ON public.photo_archive
  FOR EACH ROW EXECUTE FUNCTION public.trg_activity_points_row('photo', 'user_id');

DROP TRIGGER IF EXISTS trg_activity_points ON public.daily_notes;
CREATE TRIGGER trg_activity_points AFTER INSERT OR DELETE ON public.daily_notes
  FOR EACH ROW EXECUTE FUNCTION public.trg_activity_points_row('diary', 'user_id');

DROP TRIGGER IF EXISTS trg_activity_points ON public.memories;
CREATE TRIGGER trg_activity_points AFTER INSERT OR DELETE ON public.memories
  FOR EACH ROW EXECUTE FUNCTION public.trg_activity_points_row('memory', '');

DROP TRIGGER IF EXISTS trg_activity_points ON public.medicine_logs;
CREATE TRIGGER trg_activity_points AFTER INSERT OR UPDATE OF status OR DELETE ON public.medicine_logs
  FOR EACH ROW EXECUTE FUNCTION public.trg_activity_points_medicine();

DROP TRIGGER IF EXISTS trg_activity_points_avatar ON public.users;
CREATE TRIGGER trg_activity_points_avatar AFTER UPDATE OF avatar_url ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.trg_activity_points_avatar();

DROP TRIGGER IF EXISTS trg_activity_points ON public.meetings;
CREATE TRIGGER trg_activity_points AFTER UPDATE OF is_active, meeting_datetime OR DELETE ON public.meetings
  FOR EACH ROW EXECUTE FUNCTION public.trg_activity_points_meeting();


-- ============================================================================
-- 6. GECE İŞİ: BULUŞMA ÖDÜLÜ + HAREKETSİZLİK CEZASI
-- ============================================================================

-- 6.1 Saati gelmiş, iptal edilmemiş ve ÖNCEDEN planlanmış buluşmalara +4 (çift başına
-- günde 1). Geçmiş tarihli buluşma girip anında puan toplamak bu şartla engellenir.
CREATE OR REPLACE FUNCTION public.award_completed_meetings(p_lookback INTERVAL DEFAULT INTERVAL '7 days')
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_meeting RECORD;
  v_awarded INTEGER := 0;
BEGIN
  FOR v_meeting IN
    SELECT m.id, m.couple_id, m.user_id, m.meeting_datetime
      FROM public.meetings AS m
     WHERE m.is_active IS TRUE
       AND m.meeting_datetime <= NOW()
       AND m.meeting_datetime > NOW() - p_lookback
       AND COALESCE((to_jsonb(m)->>'created_at')::timestamptz, '-infinity'::timestamptz) < m.meeting_datetime
       AND NOT EXISTS (
         SELECT 1 FROM public.couple_activity_log AS l
          WHERE l.source_key = 'meetings:' || m.id::text AND l.status <> 'revoked'
       )
     ORDER BY m.meeting_datetime
  LOOP
    v_awarded := v_awarded + public.award_couple_activity(
      v_meeting.couple_id,
      v_meeting.user_id,
      'meeting',
      'meetings:' || v_meeting.id::text,
      public.activity_local_date(v_meeting.meeting_datetime)
    );
  END LOOP;
  RETURN v_awarded;
END;
$$;

-- 6.2 Son aktiviteden bu yana geçen tam gün sayısına göre her gün için ceza:
--   5–9 gün → -10 / gün,  10+ gün → -20 / gün,  skor 0'ın altına inmez.
-- Kaçırılan geceler bir sonraki çalışmada telafi edilir; aynı gün iki kez cezalanmaz.
-- Cezalandırılan çift-gün sayısını döner.
CREATE OR REPLACE FUNCTION public.apply_activity_decay()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_through DATE;
  v_target  DATE := public.activity_local_date(NOW()) - 1;
  v_day     DATE;
  v_rows    INTEGER;
  v_total   INTEGER := 0;
BEGIN
  SELECT s.decay_applied_through INTO v_through
    FROM public.star_brightness_job_state AS s
   WHERE s.id
     FOR UPDATE;

  IF v_through IS NULL THEN
    INSERT INTO public.star_brightness_job_state (id, decay_applied_through) VALUES (TRUE, v_target)
    ON CONFLICT (id) DO NOTHING;
    RETURN 0;
  END IF;

  FOR v_day IN
    SELECT g.day::date FROM generate_series(v_through + 1, v_target, INTERVAL '1 day') AS g(day)
  LOOP
    UPDATE public.couple_activity_score AS s
       SET cumulative_score = GREATEST(0, s.cumulative_score - CASE WHEN v_day - s.last_activity_date >= 10 THEN 20 ELSE 10 END),
           updated_at       = NOW()
     WHERE s.cumulative_score > 0
       AND s.last_activity_date <= v_day - 5;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_total := v_total + v_rows;
  END LOOP;

  UPDATE public.star_brightness_job_state AS s
     SET decay_applied_through = GREATEST(v_through, v_target)
   WHERE s.id;

  RETURN v_total;
END;
$$;

CREATE OR REPLACE FUNCTION public.run_star_brightness_nightly()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_meeting_points INTEGER;
  v_decayed        INTEGER;
BEGIN
  -- Önce buluşmalar: dün gerçekleşen buluşma dünkü aktivite sayılır ve cezayı önler
  v_meeting_points := public.award_completed_meetings();
  v_decayed := public.apply_activity_decay();
  RETURN jsonb_build_object('meeting_points', v_meeting_points, 'decayed_couple_days', v_decayed);
END;
$$;


-- ============================================================================
-- 7. İSTEMCİ RPC'LERİ
-- ============================================================================

-- 7.1 Kendi yıldızımızın puan ve parlaklık özeti
CREATE OR REPLACE FUNCTION public.get_my_star_brightness()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_couple_id    INTEGER;
  v_today        DATE := public.activity_local_date(NOW());
  v_score        public.couple_activity_score%ROWTYPE;
  v_points_today INTEGER;
BEGIN
  v_couple_id := public.get_my_couple_id();
  IF v_couple_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_score FROM public.couple_activity_score AS s WHERE s.couple_id = v_couple_id;
  SELECT d.daily_total INTO v_points_today
    FROM public.couple_daily_activity AS d
   WHERE d.couple_id = v_couple_id AND d.activity_date = v_today;

  RETURN jsonb_build_object(
    'cumulative_score',      COALESCE(v_score.cumulative_score, 0),
    'brightness',            COALESCE(v_score.brightness, public.calculate_star_brightness(0)),
    'full_brightness_score', public.star_brightness_full_score(),
    'points_today',          COALESCE(v_points_today, 0),
    'last_activity_date',    v_score.last_activity_date,
    'days_inactive',         CASE WHEN v_score.last_activity_date IS NULL THEN NULL
                                  ELSE v_today - v_score.last_activity_date END
  );
END;
$$;

-- 7.2 Gökyüzünde seçilen bir yıldızın parlaklığı. Skor yalnızca kendi yıldızımız ve
-- kabul edilmiş bağlantılarımız için döner; diğerleri gökyüzünde gördüğümüz gizemli değeri alır.
CREATE OR REPLACE FUNCTION public.get_star_brightness(p_catalog_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_my_couple_id   INTEGER := public.get_my_couple_id();
  v_my_star_id     UUID;
  v_star_id        UUID;
  v_star_couple_id INTEGER;
  v_visibility     TEXT;
  v_score          public.couple_activity_score%ROWTYPE;
BEGIN
  SELECT cs.id, cs.couple_id INTO v_star_id, v_star_couple_id
    FROM public.couple_stars AS cs
   WHERE cs.catalog_id = p_catalog_id;

  IF v_star_id IS NULL THEN
    RETURN jsonb_build_object('visibility', 'unclaimed', 'brightness', public.calculate_star_brightness(0));
  END IF;

  IF v_star_couple_id = v_my_couple_id THEN
    v_visibility := 'self';
  ELSE
    SELECT cs.id INTO v_my_star_id FROM public.couple_stars AS cs WHERE cs.couple_id = v_my_couple_id;
    IF v_my_star_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.star_connections AS sc
       WHERE sc.status = 'accepted'
         AND ((sc.star_a_id = v_my_star_id AND sc.star_b_id = v_star_id)
           OR (sc.star_b_id = v_my_star_id AND sc.star_a_id = v_star_id))
    ) THEN
      v_visibility := 'friend';
    ELSE
      RETURN jsonb_build_object(
        'visibility', 'hidden',
        'brightness', public.star_mystery_brightness(
          p_catalog_id, COALESCE(v_my_couple_id, 0), public.activity_local_date(NOW())
        )
      );
    END IF;
  END IF;

  SELECT * INTO v_score FROM public.couple_activity_score AS s WHERE s.couple_id = v_star_couple_id;
  RETURN jsonb_build_object(
    'visibility',         v_visibility,
    'brightness',         COALESCE(v_score.brightness, public.calculate_star_brightness(0)),
    'cumulative_score',   COALESCE(v_score.cumulative_score, 0),
    'last_activity_date', v_score.last_activity_date
  );
END;
$$;

-- 7.3 get_stars_in_viewport — luminosity_level artık aktivite parlaklığıdır:
--   sahipsiz yıldız        → 0.20
--   kendi yıldızımız       → gerçek parlaklık
--   bağlantılı (arkadaş)   → gerçek parlaklık  (is_connected = TRUE)
--   diğer tescilli yıldız  → gizemli parlaklık (izleyici + gün bazlı, 0.10–0.90)
-- Gerçek skor tablosuna yalnızca kendi + en fazla 3 bağlı yıldız için bakılır.
DROP FUNCTION IF EXISTS public.get_stars_in_viewport(NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC);

CREATE OR REPLACE FUNCTION public.get_stars_in_viewport(
  min_ra      NUMERIC,
  max_ra      NUMERIC,
  min_dec     NUMERIC,
  max_dec     NUMERIC,
  zoom_level  NUMERIC DEFAULT 1.0
)
RETURNS TABLE (
  catalog_id        BIGINT,
  catalog_code      VARCHAR(32),
  ra                NUMERIC(8,4),
  "dec"             NUMERIC(8,4),
  magnitude         NUMERIC(4,2),
  spectral_type     VARCHAR(16),
  base_color        VARCHAR(9),
  common_name       TEXT,
  is_claimed        BOOLEAN,
  is_mine           BOOLEAN,
  custom_name       VARCHAR(120),
  luminosity_level  NUMERIC(3,2),
  resonance_active  BOOLEAN,
  owner_initials    VARCHAR(16),
  is_connected      BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_my_couple_id    INTEGER;
  v_my_star_id      UUID;
  v_friend_star_ids UUID[] := ARRAY[]::UUID[];
  v_mag_limit       NUMERIC(4,2);
  v_today           DATE := public.activity_local_date(NOW());
BEGIN
  v_my_couple_id := CASE WHEN auth.uid() IS NULL THEN NULL ELSE public.get_my_couple_id() END;
  v_mag_limit := CASE
    WHEN zoom_level < 1.5 THEN 3.80
    WHEN zoom_level < 4.0 THEN 5.80
    ELSE 9.00
  END;

  IF v_my_couple_id IS NOT NULL THEN
    SELECT cs.id INTO v_my_star_id FROM public.couple_stars AS cs WHERE cs.couple_id = v_my_couple_id;
  END IF;
  IF v_my_star_id IS NOT NULL THEN
    v_friend_star_ids := ARRAY(
      SELECT CASE WHEN sc.star_a_id = v_my_star_id THEN sc.star_b_id ELSE sc.star_a_id END
        FROM public.star_connections AS sc
       WHERE sc.status = 'accepted'
         AND (sc.star_a_id = v_my_star_id OR sc.star_b_id = v_my_star_id)
    );
  END IF;

  RETURN QUERY
  SELECT
    cc.id,
    cc.catalog_code,
    cc.ra,
    cc.dec,
    cc.magnitude,
    cc.spectral_type,
    cc.base_color,
    cc.common_name,
    (cs.id IS NOT NULL) AS is_claimed,
    (cs.couple_id = v_my_couple_id) AS is_mine,
    CASE
      WHEN cs.couple_id = v_my_couple_id THEN cs.custom_name
      WHEN cs.id IS NOT NULL THEN 'Tescilli Yıldız'::VARCHAR(120)
      ELSE NULL::VARCHAR(120)
    END AS custom_name,
    CASE
      WHEN cs.id IS NULL THEN public.calculate_star_brightness(0)
      WHEN cs.couple_id = v_my_couple_id OR cs.id = ANY (v_friend_star_ids)
        THEN COALESCE(cas.brightness, public.calculate_star_brightness(0))
      ELSE public.star_mystery_brightness(cc.id, COALESCE(v_my_couple_id, 0), v_today)
    END::NUMERIC(3,2) AS luminosity_level,
    COALESCE(cs.resonance_until > NOW(), FALSE),
    CASE
      -- Kendi yıldızınız zaten Hero Beacon ile gösterilir; baş harfe gerek yok.
      WHEN cs.couple_id = v_my_couple_id THEN NULL::VARCHAR(16)
      WHEN cs.id IS NOT NULL THEN cs.owner_initials
      ELSE NULL::VARCHAR(16)
    END AS owner_initials,
    COALESCE(cs.id = ANY (v_friend_star_ids), FALSE) AS is_connected
  FROM public.celestial_catalog cc
  LEFT JOIN public.couple_stars cs ON cs.catalog_id = cc.id
  LEFT JOIN public.couple_activity_score cas
    ON cas.couple_id = cs.couple_id
   AND (cs.couple_id = v_my_couple_id OR cs.id = ANY (v_friend_star_ids))
  WHERE
    cc.dec BETWEEN min_dec AND max_dec
    AND (
      (min_ra <= max_ra AND cc.ra BETWEEN min_ra AND max_ra)
      OR
      (min_ra > max_ra AND (cc.ra >= min_ra OR cc.ra <= max_ra))
    )
    AND (cc.is_claimed = FALSE OR cs.id IS NOT NULL)
    AND (cs.id IS NOT NULL OR cc.magnitude <= v_mag_limit)
  ORDER BY
    (cs.couple_id = v_my_couple_id) DESC,
    (cs.id IS NOT NULL) DESC,
    cc.magnitude ASC
  LIMIT 300;
END;
$$;


-- ============================================================================
-- 8. GÜVENLİK: RLS VE YETKİLER
-- ============================================================================
ALTER TABLE public.activity_point_rules      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.couple_activity_log       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.couple_daily_activity     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.couple_activity_score     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.star_brightness_job_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "activity_point_rules_read_all" ON public.activity_point_rules;
CREATE POLICY "activity_point_rules_read_all"
  ON public.activity_point_rules FOR SELECT
  USING (true);

-- Çift yalnızca kendi puanlarını görür. Bağlı çiftlerin parlaklığı yalnızca
-- SECURITY DEFINER RPC'ler üzerinden (ham tablolara dokunmadan) okunur.
DROP POLICY IF EXISTS "couple_activity_log_select_own" ON public.couple_activity_log;
CREATE POLICY "couple_activity_log_select_own"
  ON public.couple_activity_log FOR SELECT TO authenticated
  USING (couple_id = (SELECT public.get_my_couple_id()));

DROP POLICY IF EXISTS "couple_daily_activity_select_own" ON public.couple_daily_activity;
CREATE POLICY "couple_daily_activity_select_own"
  ON public.couple_daily_activity FOR SELECT TO authenticated
  USING (couple_id = (SELECT public.get_my_couple_id()));

DROP POLICY IF EXISTS "couple_activity_score_select_own" ON public.couple_activity_score;
CREATE POLICY "couple_activity_score_select_own"
  ON public.couple_activity_score FOR SELECT TO authenticated
  USING (couple_id = (SELECT public.get_my_couple_id()));

-- Puan tablolarına doğrudan yazma yolu yoktur (yazma politikası yok + yetki geri alındı)
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.activity_point_rules  FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.couple_activity_log   FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.couple_daily_activity FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.couple_activity_score FROM anon, authenticated;
REVOKE ALL ON public.star_brightness_job_state FROM anon, authenticated;
REVOKE ALL ON public.couple_activity_log, public.couple_daily_activity, public.couple_activity_score FROM anon;

-- İç fonksiyonlar istemciden çağrılamaz (aksi halde RPC ile puan basılabilirdi)
REVOKE ALL ON FUNCTION public.activity_local_date(TIMESTAMPTZ)                      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.star_brightness_full_score()                          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.calculate_star_brightness(INTEGER)                    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.star_mystery_brightness(BIGINT, INTEGER, DATE)        FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.activity_source_key(TEXT, JSONB, TEXT[])              FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_activity_points(INTEGER, DATE, TEXT, INTEGER)   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.award_couple_activity(INTEGER, UUID, TEXT, TEXT, DATE) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.revoke_couple_activity(TEXT)                          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.award_completed_meetings(INTERVAL)                    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_activity_decay()                                FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.run_star_brightness_nightly()                         FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_couple_activity_score_brightness()                FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_activity_points_row()                             FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_activity_points_medicine()                        FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_activity_points_avatar()                          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_activity_points_meeting()                         FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.get_my_star_brightness()      FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_star_brightness(BIGINT)   FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_star_brightness()    TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_star_brightness(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_stars_in_viewport(NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC)
  TO authenticated, anon;


-- ============================================================================
-- 9. REALTIME: istemci "+2 puan 🌟" bildirimini kendi çiftinin log kayıtlarından alır
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime' AND NOT puballtables)
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'couple_activity_log'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.couple_activity_log;
  END IF;
END;
$$;


-- ============================================================================
-- 10. ZAMANLAMA: her gece 00:05 (Türkiye) = 21:05 UTC
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
DECLARE
  v_job_id BIGINT;
BEGIN
  SELECT jobid INTO v_job_id FROM cron.job WHERE jobname = 'star-brightness-nightly' LIMIT 1;
  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_id);
  END IF;
END;
$$;

SELECT cron.schedule(
  'star-brightness-nightly',
  '5 21 * * *',
  $cron$ SELECT public.run_star_brightness_nightly(); $cron$
);

COMMIT;
