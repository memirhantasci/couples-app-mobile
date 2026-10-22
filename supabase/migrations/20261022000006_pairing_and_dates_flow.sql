-- ============================================================================
-- MIGRATION: 20261022000006_pairing_and_dates_flow.sql
--
-- Eşleşme:
-- 1. Eşleşme kodu sunucuda üretilir ve birbirine karışan karakterler (0/O, 1/I/L)
--    kullanılmaz. Girilen kod normalize edilir: Türkçe klavyenin büyük harf
--    modunda yazdığı "İ", boşluk, küçük harf ve eski kodlardaki 0/O, 1/I karışıklığı
--    artık "Geçersiz kod" hatasına yol açmaz.
-- 2. get_or_create_my_couple: kullanıcının bekleme çiftini tek ve kilitli bir işlemde
--    getirir ya da oluşturur (istemcideki insert + join yarışı ve yetim çiftler biter).
-- 3. join_couple_by_code_uuid:
--    - Kayıtta girilen kodla zaten o çifte katılmış kullanıcı kodu tekrar girerse
--      SELF_CODE yerine başarı döner.
--    - Eşleşme durumu kayıttaki sayaçtan değil gerçek üye sayısından hesaplanır.
--    - Kimsenin beklemediği (boş) çiftin koduyla katılınamaz.
--    - Kurulmuş (2 kişilik) bir çiftteki kullanıcı başka bir koda geçemez; partnerini
--      tek başına bırakmasın (ör. davet bağlantısına yanlışlıkla dokunma).
--    - Herhangi bir kullanıcıyı parametreyle taşıyabilen eski (p_code, p_user_id)
--      sürümü kaldırılır.
--
-- İlişki tarihleri (yalnızca RPC ile yazılır):
-- 4. set_initial_relationship_dates: kurulumda ilk kaydeden kazanır; partnerin
--    sonradan kaydetmesi ilk tarihi ezmez ve değişiklik hakkı harcamaz.
-- 5. change_relationship_dates: tarihler ilk kaydedildiği andan itibaren ilk 30 günde
--    2, sonraki her 30 günlük dönemde 1 değişiklik hakkı (çift bazlı, devretmez).
--    Tarih hiç kaydedilmemişse (kurulumda atlanmışsa) ilk kayıt hak harcamaz.
--    Mevcut çiftler yeni kurala sıfır kullanım ile başlar; dönem başlangıcı olarak
--    çiftin oluşturulma zamanı kullanılır.
--
-- 6. couples tablosu realtime yayınına eklenir: eşleşme, tarih ve premium
--    değişiklikleri iki telefona anında yansır (AuthContext zaten dinliyordu).
-- ============================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- 0. Oturum bayrağı yardımcısı
-- ────────────────────────────────────────────────────────────────────────────
-- set_config(..., true) ile açılan bayrak, işlem bitince aynı bağlantıda NULL'a değil
-- boş metne döner. Bu yüzden "IS NOT NULL" kontrolü havuzlanmış bağlantılarda korumayı
-- delebilir; bayrak yalnızca açıkça 'true' / 'on' ise açık sayılır.
CREATE OR REPLACE FUNCTION public.app_flag_on(p_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT COALESCE(current_setting(p_name, true), '') IN ('true', 'on');
$$;


-- ────────────────────────────────────────────────────────────────────────────
-- 1. Eşleşme kodu yardımcıları
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.normalize_pairing_code(p_code TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  -- İ / ı / i → I; ardından yalnızca A-Z ve 0-9 kalır (boşluk, tire, birleşik nokta işareti silinir)
  SELECT regexp_replace(upper(translate(COALESCE(p_code, ''), 'İıi', 'III')), '[^A-Z0-9]', '', 'g');
$$;

-- Eski kodlarda 0/O ve 1/I birlikte bulunabilir; gevşek arama bu ifadeyle yapılır
CREATE INDEX IF NOT EXISTS idx_couples_pairing_code_loose
  ON public.couples (translate(pairing_code, '01', 'OI'));

CREATE OR REPLACE FUNCTION public.generate_pairing_code()
RETURNS TEXT
LANGUAGE plpgsql
VOLATILE
SET search_path = public, extensions
AS $$
DECLARE
  -- 0/O, 1/I/L gibi birbirine karışan karakterler yok
  v_alphabet CONSTANT TEXT := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_bytes BYTEA;
  v_code TEXT;
BEGIN
  LOOP
    v_bytes := gen_random_bytes(6);
    v_code := '';
    FOR i IN 0..5 LOOP
      v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, i) % length(v_alphabet)) + 1, 1);
    END LOOP;
    -- Gevşek aramada eski bir kodla çakışmasın
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM couples c WHERE translate(c.pairing_code, '01', 'OI') = v_code
    );
  END LOOP;
  RETURN v_code;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_pairing_code() FROM PUBLIC, anon, authenticated;


-- ────────────────────────────────────────────────────────────────────────────
-- 2. Kullanıcının bekleme çiftini getir / oluştur
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_or_create_my_couple()
RETURNS TABLE(
  result_couple_id INTEGER,
  result_pairing_code TEXT,
  result_member_count INTEGER,
  result_is_paired BOOLEAN,
  result_has_dates BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_couple_id INTEGER;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Kullanıcı satırı kilitlenir: aynı anda gelen iki çağrı iki ayrı çift açamaz
  SELECT u.couple_id INTO v_couple_id FROM users u WHERE u.id = v_uid FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND';
  END IF;

  IF v_couple_id IS NULL THEN
    INSERT INTO couples (pairing_code, member_count)
    VALUES (generate_pairing_code(), 0)
    RETURNING id INTO v_couple_id;

    PERFORM set_config('app.allow_couple_change', 'true', true);
    UPDATE users u SET couple_id = v_couple_id WHERE u.id = v_uid;
    PERFORM set_config('app.allow_couple_change', '', true);
  ELSE
    -- Kodu olmayan eski çiftlere kod verilir
    UPDATE couples c SET pairing_code = generate_pairing_code()
     WHERE c.id = v_couple_id AND c.pairing_code IS NULL;
  END IF;

  RETURN QUERY
    SELECT c.id,
           c.pairing_code::TEXT,
           m.cnt,
           m.cnt >= 2,
           c.relationship_start_date IS NOT NULL
      FROM couples c
     CROSS JOIN LATERAL (
       SELECT count(*)::INTEGER AS cnt FROM users u WHERE u.couple_id = c.id
     ) m
     WHERE c.id = v_couple_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_or_create_my_couple() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_my_couple() TO authenticated;


-- ────────────────────────────────────────────────────────────────────────────
-- 3. Kodla eşleşme
-- ────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.join_couple_by_code_uuid(TEXT, UUID);

CREATE OR REPLACE FUNCTION public.join_couple_by_code_uuid(p_code TEXT)
RETURNS TABLE(result_couple_id INTEGER, result_is_paired BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_code TEXT := normalize_pairing_code(p_code);
  v_target_id INTEGER;
  v_old_couple_id INTEGER;
  v_target_members INTEGER;
  v_old_members INTEGER;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF length(v_code) < 4 THEN
    RAISE EXCEPTION 'INVALID_CODE';
  END IF;

  -- Kilit sırası her yerde aynı: önce kullanıcı satırı, sonra çift satırları (id sırasıyla)
  SELECT u.couple_id INTO v_old_couple_id FROM users u WHERE u.id = v_uid FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND';
  END IF;

  -- Önce birebir eşleşme; yoksa 0/O ve 1/I karışıklığını tolere eden eşleşme (yalnızca tekse)
  SELECT c.id INTO v_target_id FROM couples c WHERE c.pairing_code = v_code;
  IF v_target_id IS NULL THEN
    SELECT min(c.id) INTO v_target_id
      FROM couples c
     WHERE translate(c.pairing_code, '01', 'OI') = translate(v_code, '01', 'OI')
    HAVING count(*) = 1;
  END IF;

  -- İki taraf aynı anda birbirinin kodunu girerse kilitlenme (deadlock) yerine sıraya girer
  PERFORM 1 FROM couples c
   WHERE c.id IN (v_target_id, v_old_couple_id)
   ORDER BY c.id
     FOR UPDATE;

  IF v_old_couple_id IS NOT NULL THEN
    SELECT count(*) INTO v_old_members FROM users u WHERE u.couple_id = v_old_couple_id;
  END IF;

  IF v_old_couple_id IS NOT DISTINCT FROM v_target_id AND v_target_id IS NOT NULL THEN
    -- Kayıtta girilen kodla zaten bu çifte katılmış olabilir: tekrar denemek hata değildir
    IF v_old_members >= 2 THEN
      RETURN QUERY SELECT v_target_id, TRUE;
      RETURN;
    END IF;
    RAISE EXCEPTION 'SELF_CODE';
  END IF;

  IF v_old_members >= 2 THEN
    -- Kurulmuş bir çiftten başka bir koda geçmek partneri tek başına bırakır
    RAISE EXCEPTION 'ALREADY_PAIRED';
  END IF;

  IF v_target_id IS NOT NULL THEN
    SELECT count(*) INTO v_target_members FROM users u WHERE u.couple_id = v_target_id;
  END IF;

  -- Kod yok ya da sahibi artık o çiftte değil (kimse beklemiyor)
  IF v_target_id IS NULL OR COALESCE(v_target_members, 0) = 0 THEN
    RAISE EXCEPTION 'INVALID_CODE';
  END IF;
  IF v_target_members >= 2 THEN
    RAISE EXCEPTION 'CODE_ALREADY_USED';
  END IF;

  PERFORM set_config('app.allow_couple_change', 'true', true);
  UPDATE users u SET couple_id = v_target_id WHERE u.id = v_uid;
  PERFORM set_config('app.allow_couple_change', '', true);

  IF v_old_couple_id IS NOT NULL THEN
    DELETE FROM couples c
     WHERE c.id = v_old_couple_id
       AND NOT EXISTS (SELECT 1 FROM users u WHERE u.couple_id = v_old_couple_id);
  END IF;

  SELECT count(*) INTO v_target_members FROM users u WHERE u.couple_id = v_target_id;
  -- Sayaç tetikleyicisi bir gün kaysa bile member_count (ve is_paired) gerçeği göstersin
  UPDATE couples c SET member_count = v_target_members
   WHERE c.id = v_target_id AND c.member_count IS DISTINCT FROM v_target_members;

  RETURN QUERY SELECT v_target_id, v_target_members >= 2;
END;
$$;

REVOKE ALL ON FUNCTION public.join_couple_by_code_uuid(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_couple_by_code_uuid(TEXT) TO authenticated;


-- ────────────────────────────────────────────────────────────────────────────
-- 4. İlişki tarihleri: değişiklik hakkı kayıtları
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.couples
  ADD COLUMN IF NOT EXISTS dates_set_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS dates_change_period INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS dates_change_count INTEGER NOT NULL DEFAULT 0;

-- Tarihler artık yalnızca aşağıdaki RPC'lerle yazılır; istemcinin doğrudan UPDATE'i
-- (eski uygulama sürümleri dahil) tarihleri ve hak sayaçlarını değiştiremez.
CREATE OR REPLACE FUNCTION public.check_couples_dates_cooldown_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF app_flag_on('app.allow_dates_change') OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.relationship_start_date IS DISTINCT FROM OLD.relationship_start_date
     OR NEW.meet_date IS DISTINCT FROM OLD.meet_date
     OR NEW.dates_last_changed_at IS DISTINCT FROM OLD.dates_last_changed_at
     OR NEW.dates_set_at IS DISTINCT FROM OLD.dates_set_at
     OR NEW.dates_change_period IS DISTINCT FROM OLD.dates_change_period
     OR NEW.dates_change_count IS DISTINCT FROM OLD.dates_change_count THEN
    RAISE EXCEPTION 'DATES_RPC_REQUIRED: İlişki tarihleri yalnızca uygulama üzerinden güncellenebilir.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

-- Dönem: tarihlerin ilk kaydedildiği andan itibaren 30 günlük dilimler.
-- İlk dönemde 2, sonraki her dönemde 1 değişiklik; kullanılmayan hak devretmez.
CREATE OR REPLACE FUNCTION public.relationship_dates_change_status(p_couple_id INTEGER)
RETURNS TABLE(
  has_dates BOOLEAN,
  period_index INTEGER,
  allowance INTEGER,
  used INTEGER,
  remaining INTEGER,
  period_ends_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row couples%ROWTYPE;
  v_anchor TIMESTAMPTZ;
  v_period INTEGER;
  v_allowance INTEGER;
  v_used INTEGER;
BEGIN
  SELECT * INTO v_row FROM couples c WHERE c.id = p_couple_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'COUPLE_NOT_FOUND';
  END IF;

  -- Henüz tarih yok: ilk kayıt hak harcamaz, ardından ilk dönemin 2 hakkı başlar
  IF v_row.relationship_start_date IS NULL THEN
    RETURN QUERY SELECT FALSE, 0, 2, 0, 2, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  v_anchor := COALESCE(v_row.dates_set_at, v_row.created_at, now());
  v_period := GREATEST(0, floor(extract(epoch FROM now() - v_anchor) / (30 * 86400))::INTEGER);
  v_allowance := CASE WHEN v_period = 0 THEN 2 ELSE 1 END;
  v_used := CASE WHEN v_row.dates_change_period = v_period THEN v_row.dates_change_count ELSE 0 END;

  RETURN QUERY SELECT
    TRUE,
    v_period,
    v_allowance,
    v_used,
    GREATEST(0, v_allowance - v_used),
    v_anchor + make_interval(days => 30 * (v_period + 1));
END;
$$;

REVOKE ALL ON FUNCTION public.relationship_dates_change_status(INTEGER) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.validate_relationship_dates(p_relationship_start_date DATE, p_meet_date DATE)
RETURNS VOID
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
BEGIN
  IF p_relationship_start_date IS NULL THEN
    RAISE EXCEPTION 'RELATIONSHIP_DATE_REQUIRED';
  END IF;
  -- Sunucu UTC'dedir; kullanıcının yerel "bugün"ü bir gün ileride olabilir
  IF p_relationship_start_date > current_date + 1 OR p_meet_date > current_date + 1 THEN
    RAISE EXCEPTION 'FUTURE_DATE';
  END IF;
  IF p_meet_date IS NOT NULL AND p_meet_date > p_relationship_start_date THEN
    RAISE EXCEPTION 'MEET_AFTER_RELATIONSHIP';
  END IF;
END;
$$;

-- Hak durumunu ekrana göstermek için
CREATE OR REPLACE FUNCTION public.get_my_dates_change_status()
RETURNS TABLE(
  result_has_dates BOOLEAN,
  result_allowance INTEGER,
  result_used INTEGER,
  result_remaining INTEGER,
  result_period_ends_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_couple_id INTEGER := get_my_couple_id();
BEGIN
  IF v_couple_id IS NULL THEN
    RAISE EXCEPTION 'NOT_PAIRED';
  END IF;

  RETURN QUERY
    SELECT s.has_dates, s.allowance, s.used, s.remaining, s.period_ends_at
      FROM relationship_dates_change_status(v_couple_id) s;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_dates_change_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_dates_change_status() TO authenticated;


-- ────────────────────────────────────────────────────────────────────────────
-- 5. Kurulum ekranı: ilk kaydeden kazanır
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_initial_relationship_dates(
  p_relationship_start_date DATE,
  p_meet_date DATE DEFAULT NULL
)
RETURNS TABLE(
  result_applied BOOLEAN,
  result_relationship_start_date DATE,
  result_meet_date DATE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_couple_id INTEGER := get_my_couple_id();
  v_existing_rel DATE;
  v_existing_meet DATE;
BEGIN
  IF v_couple_id IS NULL THEN
    RAISE EXCEPTION 'NOT_PAIRED';
  END IF;
  PERFORM validate_relationship_dates(p_relationship_start_date, p_meet_date);

  -- Satır kilidi: iki partner aynı saniyede kaydetse bile yalnızca ilki yazılır
  SELECT c.relationship_start_date, c.meet_date
    INTO v_existing_rel, v_existing_meet
    FROM couples c
   WHERE c.id = v_couple_id
     FOR UPDATE;

  IF v_existing_rel IS NOT NULL THEN
    RETURN QUERY SELECT FALSE, v_existing_rel, v_existing_meet;
    RETURN;
  END IF;

  PERFORM set_config('app.allow_dates_change', 'true', true);
  UPDATE couples c
     SET relationship_start_date = p_relationship_start_date,
         meet_date = p_meet_date,
         dates_set_at = now(),
         dates_change_period = NULL,
         dates_change_count = 0
   WHERE c.id = v_couple_id;
  PERFORM set_config('app.allow_dates_change', '', true);

  RETURN QUERY SELECT TRUE, p_relationship_start_date, p_meet_date;
END;
$$;

REVOKE ALL ON FUNCTION public.set_initial_relationship_dates(DATE, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_initial_relationship_dates(DATE, DATE) TO authenticated;


-- ────────────────────────────────────────────────────────────────────────────
-- 6. Profil ekranı: hak sınırlı değişiklik
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.change_relationship_dates(
  p_relationship_start_date DATE,
  p_meet_date DATE DEFAULT NULL
)
RETURNS TABLE(
  result_has_dates BOOLEAN,
  result_allowance INTEGER,
  result_used INTEGER,
  result_remaining INTEGER,
  result_period_ends_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_couple_id INTEGER := get_my_couple_id();
  v_row couples%ROWTYPE;
  v_status RECORD;
BEGIN
  IF v_couple_id IS NULL THEN
    RAISE EXCEPTION 'NOT_PAIRED';
  END IF;
  PERFORM validate_relationship_dates(p_relationship_start_date, p_meet_date);

  SELECT * INTO v_row FROM couples c WHERE c.id = v_couple_id FOR UPDATE;

  IF v_row.relationship_start_date IS NULL THEN
    -- Kurulumda atlanmış: ilk kayıt hak harcamaz
    PERFORM set_config('app.allow_dates_change', 'true', true);
    UPDATE couples c
       SET relationship_start_date = p_relationship_start_date,
           meet_date = p_meet_date,
           dates_set_at = now(),
           dates_change_period = NULL,
           dates_change_count = 0
     WHERE c.id = v_couple_id;
  ELSIF v_row.relationship_start_date IS DISTINCT FROM p_relationship_start_date
     OR v_row.meet_date IS DISTINCT FROM p_meet_date THEN
    SELECT * INTO v_status FROM relationship_dates_change_status(v_couple_id);
    IF v_status.remaining <= 0 THEN
      RAISE EXCEPTION 'DATES_CHANGE_LIMIT';
    END IF;

    PERFORM set_config('app.allow_dates_change', 'true', true);
    UPDATE couples c
       SET relationship_start_date = p_relationship_start_date,
           meet_date = p_meet_date,
           dates_change_period = v_status.period_index,
           dates_change_count = v_status.used + 1,
           dates_last_changed_at = now()
     WHERE c.id = v_couple_id;
  END IF;
  PERFORM set_config('app.allow_dates_change', '', true);

  RETURN QUERY
    SELECT s.has_dates, s.allowance, s.used, s.remaining, s.period_ends_at
      FROM relationship_dates_change_status(v_couple_id) s;
END;
$$;

REVOKE ALL ON FUNCTION public.change_relationship_dates(DATE, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.change_relationship_dates(DATE, DATE) TO authenticated;


-- ────────────────────────────────────────────────────────────────────────────
-- 7. REALTIME: eşleşme / tarih / premium değişiklikleri iki telefona anında
-- ────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime' AND NOT puballtables)
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'couples'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.couples;
  END IF;
END;
$$;

COMMIT;
