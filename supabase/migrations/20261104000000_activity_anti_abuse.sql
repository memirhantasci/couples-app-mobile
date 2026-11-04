-- ============================================================================
-- MIGRATION: 20261104000000_activity_anti_abuse.sql
-- Aşk skoru ve yıldız parlaklığı: manipülasyon (ekle-sil-ekle, geçmişe kayıt, sahte buluşma) kapatma
-- ============================================================================
-- Kurallar:
--   1. Silme puanı yalnızca AYNI GÜN geri alır. Bir gün geçtikten sonra kaydı silmek o günün puanını
--      düşürmez ("o gün uygulamayı aktif kullandın"). Aynı gün ekle-sil-ekle zaten günlük limitle
--      (kişi başına tür başına günde 1) tek puandır. Hesap silme gibi sunucu işlemleri (oturum yok)
--      her zaman geri alır.
--   2. Geçmiş tarihli kayıt puan vermez: takvim notu, günlük sayfası, ruh hali ve ilaç dozu kaydı
--      için kayıt tarihi bugünden (Türkiye günü) bir günden fazla eskiyse puan verilmez. Bir günlük
--      tolerans, cihaz saat dilimi ile Türkiye günü arasındaki farktandır. Anı ve fotoğraf gibi
--      olay tarihi doğası gereği geçmiş olabilen kayıtlar için yükleme anı esas alınır (değişmedi).
--   3. Sistemin kendi eklediği kayıtlar puan vermez: varsayılan anılar (is_default) ilişki tarihleri
--      girilince / anılar sayfası ilk açılınca otomatik eklenir.
--   4. Buluşma: puan için buluşmanın en az 3 saat ÖNCE planlanmış olması gerekir. Planlama anı sunucuda
--      tutulur ve buluşma tarihi değiştirilince yenilenir; "uzak tarihli buluşma ekle, sonra yakına çek"
--      hilesi böylece kapanır.
--   5. Aşk skoru artık silinebilir canlı satırlardan değil, sunucudaki puan günlüğünden (couple_activity_log)
--      hesaplanır: get_couple_love_activity(). Böylece silme, geçmişe kayıt ve sahte buluşma skoru
--      oynatamaz; iki partnerde de aynı sonuç görünür.
-- ============================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Silme yalnızca aynı gün geri alır
-- ────────────────────────────────────────────────────────────────────────────
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

    -- Kullanıcı bir önceki günün (ya da daha eskinin) kaydını siliyor: o gün zaten aktif kullanıldı,
    -- puan geri alınmaz. Oturumsuz sunucu işlemleri (hesap silme vb.) bu kuralın dışındadır.
    IF auth.uid() IS NOT NULL AND v_entry.activity_date < public.activity_local_date(NOW()) THEN
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

REVOKE ALL ON FUNCTION public.revoke_couple_activity(TEXT) FROM PUBLIC, anon, authenticated;


-- ────────────────────────────────────────────────────────────────────────────
-- 2. Genel ekleme/silme trigger'ı: geçmiş tarihli ve sistem kayıtları puan vermez
-- ────────────────────────────────────────────────────────────────────────────
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

    -- Sistemin kendi eklediği varsayılan anılar (ilişki / tanışma tarihi) kullanıcı aktivitesi değildir
    IF v_type = 'memory' AND COALESCE((v_row->>'is_default')::boolean, FALSE) THEN
      RETURN NULL;
    END IF;

    -- Geçmiş bir güne yazılan not / günlük / ruh hali puan vermez (1 gün: cihaz saat dilimi toleransı)
    IF v_type IN ('calendar_note', 'diary', 'mood')
       AND NULLIF(v_row->>'date', '') IS NOT NULL
       AND (v_row->>'date')::date < public.activity_local_date(NOW()) - 1 THEN
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


-- ────────────────────────────────────────────────────────────────────────────
-- 3. İlaç: yalnızca bugün / dün-yarın (saat dilimi toleransı) için işaretlenen doz puan verir
-- ────────────────────────────────────────────────────────────────────────────
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

    IF v_new->>'status' = 'DRANK' AND (v_old IS NULL OR v_old->>'status' IS DISTINCT FROM 'DRANK')
       AND (
         NULLIF(v_new->>'date', '') IS NULL
         OR abs((v_new->>'date')::date - public.activity_local_date(NOW())) <= 1
       ) THEN
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


-- ────────────────────────────────────────────────────────────────────────────
-- 4. Buluşma: planlama anı sunucuda tutulur, puan için en az 3 saat önceden planlanmış olmalı
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS activity_planned_at TIMESTAMPTZ;

COMMENT ON COLUMN public.meetings.activity_planned_at IS
  'Buluşmanın (yeniden) planlandığı an; sunucu tarafından yazılır. Puan için buluşmadan en az 3 saat önce olmalıdır.';

-- Mevcut buluşmaların activity_planned_at değeri NULL kalır (toplu UPDATE, meetings üzerindeki bildirim
-- tetikleyicilerini çalıştırırdı); puan hesabı onlar için created_at'e bakar.

CREATE OR REPLACE FUNCTION public.trg_meetings_activity_planned_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.activity_planned_at := NOW();
  ELSIF NEW.meeting_datetime IS DISTINCT FROM OLD.meeting_datetime THEN
    NEW.activity_planned_at := NOW();
  ELSE
    -- İstemci planlama anını değiştiremez
    NEW.activity_planned_at := OLD.activity_planned_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_meetings_activity_planned_at ON public.meetings;
CREATE TRIGGER trg_meetings_activity_planned_at
  BEFORE INSERT OR UPDATE ON public.meetings
  FOR EACH ROW EXECUTE FUNCTION public.trg_meetings_activity_planned_at();

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
       AND COALESCE(m.activity_planned_at, (to_jsonb(m)->>'created_at')::timestamptz, 'infinity'::timestamptz)
             <= m.meeting_datetime - INTERVAL '3 hours'
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

REVOKE ALL ON FUNCTION public.award_completed_meetings(INTERVAL) FROM PUBLIC, anon, authenticated;


-- ────────────────────────────────────────────────────────────────────────────
-- 5. Aşk skoru girdileri: canlı satırlar yerine sunucu puan günlüğü
-- ────────────────────────────────────────────────────────────────────────────
-- Yalnızca sayılar döner (içerik değil); iki partnerde aynı sonucu verir. Günlükte yalnızca 'awarded'
-- kayıtlar sayılır: geçmiş güne yazılan, sistemin eklediği ya da sahte kayıtlar günlüğe hiç girmez.
CREATE OR REPLACE FUNCTION public.get_couple_love_activity()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH me AS (
    SELECT public.get_my_couple_id() AS couple_id, public.activity_local_date(NOW()) AS today
  )
  SELECT jsonb_build_object(
    'mood_authors_today', (
      SELECT count(DISTINCT l.user_id)::integer FROM public.couple_activity_log AS l
       WHERE l.couple_id = me.couple_id AND l.activity_type = 'mood'
         AND l.status = 'awarded' AND l.activity_date = me.today),
    'daily_authors_today', (
      SELECT count(DISTINCT l.user_id)::integer FROM public.couple_activity_log AS l
       WHERE l.couple_id = me.couple_id AND l.activity_type = 'diary'
         AND l.status = 'awarded' AND l.activity_date = me.today),
    'calendar_authors_recent', (
      SELECT count(DISTINCT l.user_id)::integer FROM public.couple_activity_log AS l
       WHERE l.couple_id = me.couple_id AND l.activity_type = 'calendar_note'
         AND l.status = 'awarded' AND l.activity_date >= me.today - 7),
    'completed_meetings_recent', (
      SELECT count(*)::integer FROM public.couple_activity_log AS l
       WHERE l.couple_id = me.couple_id AND l.activity_type = 'meeting'
         AND l.status = 'awarded' AND l.activity_date >= me.today - 30),
    'letter_senders_recent', (
      SELECT count(DISTINCT l.user_id)::integer FROM public.couple_activity_log AS l
       WHERE l.couple_id = me.couple_id AND l.activity_type = 'letter'
         AND l.status = 'awarded' AND l.activity_date >= me.today - 30),
    'photo_recent_7d', (
      SELECT count(*)::integer FROM public.couple_activity_log AS l
       WHERE l.couple_id = me.couple_id AND l.activity_type = 'photo'
         AND l.status = 'awarded' AND l.activity_date >= me.today - 7),
    'photo_recent_30d', (
      SELECT count(*)::integer FROM public.couple_activity_log AS l
       WHERE l.couple_id = me.couple_id AND l.activity_type = 'photo'
         AND l.status = 'awarded' AND l.activity_date >= me.today - 30)
  )
  FROM me
  WHERE me.couple_id IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.get_couple_love_activity() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_couple_love_activity() TO authenticated;

COMMIT;
