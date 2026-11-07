-- ============================================================================
-- Güvenlik sıkılaştırma ve performans temizliği (canlı veritabanı taraması bulguları)
-- ----------------------------------------------------------------------------
-- 1. Eski, gevşek RLS politikaları kaldırılır. İzin veren (PERMISSIVE) politikalar "VEYA" ile birleştiği için
--    eski `user_id = auth.uid()` politikaları, yeni sıkı politikaları (couple_id = benim çiftim, Premium)
--    etkisiz bırakıyordu: kullanıcı başka çiftin couple_id'sine kayıt ekleyebiliyordu.
--    Mektup SELECT politikası bilerek DEĞİŞMEDİ (uygulama kilitli mektubu "mühürlü" olarak listeler).
-- 2. Kalan politikalarda auth.uid() / get_my_couple_id() sorgu başına bir kez hesaplanır (initplan).
-- 3. users.created_at, users.last_seen_at (yalnızca RPC) ve couples.member_count istemciden değiştirilemez.
-- 4. couple-memories deposuna dosya boyutu ve tür sınırı.
-- 5. Sabit search_path olmayan 14 fonksiyon.
-- 6. letters tablosundaki kopya indeks.
-- Uygulama: `supabase db query --linked -f` (db push YASAK: canlı migration geçmişi elle yönetiliyor).
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. GEVŞEK / KOPYA POLİTİKALAR
-- ============================================================================
-- takvim notu: couple_id kontrolsüzdü
DROP POLICY IF EXISTS calendar_notes_insert ON public.calendar_notes;

-- günlük: üç ekleme politikasından yalnızca sarılmış sıkı olan kalır; güncelleme couple_id'yi değiştirebiliyordu
DROP POLICY IF EXISTS daily_notes_insert ON public.daily_notes;
DROP POLICY IF EXISTS "Insert own couple daily notes" ON public.daily_notes;
DROP POLICY IF EXISTS daily_notes_update ON public.daily_notes;

-- ilaç kayıtları
DROP POLICY IF EXISTS medicine_logs_insert ON public.medicine_logs;
DROP POLICY IF EXISTS medicine_logs_update ON public.medicine_logs;

-- ilaçlar: "Insert own couple medicines" (partnere ilaç ekleme) ve "Insert own data" kalır
DROP POLICY IF EXISTS medicines_insert ON public.medicines;
DROP POLICY IF EXISTS medicines_update ON public.medicines;

-- buluşmalar: user_id kontrolsüz ekleme
DROP POLICY IF EXISTS meetings_insert ON public.meetings;

-- anılar: iki ekleme politikası aynı şeyi yapıyordu
DROP POLICY IF EXISTS memories_insert_couple ON public.memories;

-- ruh hali
DROP POLICY IF EXISTS moods_insert ON public.moods;
DROP POLICY IF EXISTS moods_update ON public.moods;

-- fotoğraf arşivi: Premium ve couple_id kontrolünü atlatıyordu
DROP POLICY IF EXISTS photo_archive_insert ON public.photo_archive;
DROP POLICY IF EXISTS "Delete own uploaded photos" ON public.photo_archive; -- photo_archive_delete (user_id = ben) zaten daha geniş

-- push token: "Users can manage own push tokens" (ALL) dört ayrı politikayı kapsıyor
DROP POLICY IF EXISTS "Delete own data" ON public.push_tokens;
DROP POLICY IF EXISTS "Insert own data" ON public.push_tokens;
DROP POLICY IF EXISTS "View own data" ON public.push_tokens;
DROP POLICY IF EXISTS "Update own data" ON public.push_tokens;

-- mektup SELECT: "View letters involved in", letters_select'in alt kümesi (VEYA ile zaten aynı sonuç). Kopya uyarısı gider,
-- davranış değişmez. Kilitli mektubun alıcıya "mühürlü" görünmesi uygulamanın tasarımıdır.
DROP POLICY IF EXISTS "View letters involved in" ON public.letters;


-- ============================================================================
-- 2. POLİTİKALARDA SORGU BAŞINA BİR KEZ HESAPLAMA
-- ============================================================================
DO $$
DECLARE
  r        RECORD;
  v_q      TEXT;
  v_w      TEXT;
  v_sql    TEXT;
  v_fixed  INTEGER := 0;
  v_fn     TEXT[] := ARRAY['auth.uid()', 'auth.role()', 'auth.jwt()'];
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, qual, with_check
      FROM pg_policies
     WHERE schemaname IN ('public', 'storage')
       AND (qual ~ '(auth\.(uid|role|jwt)\(\)|get_my_couple_id\(\)|has_my_active_premium\(\))'
         OR with_check ~ '(auth\.(uid|role|jwt)\(\)|get_my_couple_id\(\)|has_my_active_premium\(\))')
  LOOP
    v_q := r.qual;
    v_w := r.with_check;
    -- zaten "SELECT " ile sarılmış çağrılar atlanır
    v_q := regexp_replace(v_q, '(?<!SELECT )auth\.uid\(\)', '( SELECT auth.uid() AS uid)', 'g');
    v_q := regexp_replace(v_q, '(?<!SELECT )auth\.role\(\)', '( SELECT auth.role() AS role)', 'g');
    v_q := regexp_replace(v_q, '(?<!SELECT )auth\.jwt\(\)', '( SELECT auth.jwt() AS jwt)', 'g');
    v_q := regexp_replace(v_q, '(?<!SELECT )get_my_couple_id\(\)', '( SELECT get_my_couple_id() AS get_my_couple_id)', 'g');
    v_q := regexp_replace(v_q, '(?<!SELECT )has_my_active_premium\(\)', '( SELECT has_my_active_premium() AS has_my_active_premium)', 'g');
    v_w := regexp_replace(v_w, '(?<!SELECT )auth\.uid\(\)', '( SELECT auth.uid() AS uid)', 'g');
    v_w := regexp_replace(v_w, '(?<!SELECT )auth\.role\(\)', '( SELECT auth.role() AS role)', 'g');
    v_w := regexp_replace(v_w, '(?<!SELECT )auth\.jwt\(\)', '( SELECT auth.jwt() AS jwt)', 'g');
    v_w := regexp_replace(v_w, '(?<!SELECT )get_my_couple_id\(\)', '( SELECT get_my_couple_id() AS get_my_couple_id)', 'g');
    v_w := regexp_replace(v_w, '(?<!SELECT )has_my_active_premium\(\)', '( SELECT has_my_active_premium() AS has_my_active_premium)', 'g');

    IF v_q IS NOT DISTINCT FROM r.qual AND v_w IS NOT DISTINCT FROM r.with_check THEN
      CONTINUE;
    END IF;

    v_sql := format('ALTER POLICY %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
    IF v_q IS NOT NULL THEN v_sql := v_sql || ' USING (' || v_q || ')'; END IF;
    IF v_w IS NOT NULL THEN v_sql := v_sql || ' WITH CHECK (' || v_w || ')'; END IF;
    EXECUTE v_sql;
    v_fixed := v_fixed + 1;
  END LOOP;
  RAISE NOTICE 'Sarılan politika sayısı: %', v_fixed;
END;
$$;


-- ============================================================================
-- 3. İSTEMCİDEN DEĞİŞTİRİLEMEYEN SÜTUNLAR
-- ============================================================================
CREATE OR REPLACE FUNCTION public.check_users_update_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- couple_id doğrudan UPDATE ile değiştirilemez (Sadece join_couple_by_code_uuid gibi RPC ile)
  IF (NEW.couple_id IS DISTINCT FROM OLD.couple_id) THEN
    IF NOT app_flag_on('app.allow_couple_change') AND auth.role() <> 'service_role' THEN
      RAISE EXCEPTION 'couple_id doğrudan değiştirilemez. Lütfen eşleşme kodunu kullanın.';
    END IF;
  END IF;

  -- token_balance doğrudan UPDATE ile değiştirilemez (Sadece spend_tokens / promo RPC ile)
  IF (NEW.token_balance IS DISTINCT FROM OLD.token_balance) THEN
    IF NOT app_flag_on('app.allow_token_change') AND auth.role() <> 'service_role' THEN
      RAISE EXCEPTION 'token_balance doğrudan değiştirilemez.';
    END IF;
  END IF;

  -- Temizlik muafiyeti yalnızca yönetici (service_role / SQL) tarafından verilir
  IF (NEW.protected_from_cleanup IS DISTINCT FROM OLD.protected_from_cleanup) THEN
    IF auth.role() <> 'service_role' THEN
      RAISE EXCEPTION 'protected_from_cleanup doğrudan değiştirilemez.' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Kayıt tarihi hiçbir zaman istemciden değişmez
  IF (NEW.created_at IS DISTINCT FROM OLD.created_at) THEN
    IF auth.role() <> 'service_role' THEN
      RAISE EXCEPTION 'created_at doğrudan değiştirilemez.' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Son kullanım zamanı yalnızca touch_last_seen / cancel_account_deletion ile yazılır (hareketsizlik temizliği buna dayanır)
  IF (NEW.last_seen_at IS DISTINCT FROM OLD.last_seen_at) THEN
    IF NOT app_flag_on('app.allow_last_seen') AND auth.role() <> 'service_role' THEN
      RAISE EXCEPTION 'last_seen_at doğrudan değiştirilemez.' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_couples_update_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Eğer is_premium veya premium_expires_at değiştirilmeye çalışılıyorsa ve sistem bayrağı yoksa engelle
  IF (NEW.is_premium IS DISTINCT FROM OLD.is_premium OR NEW.premium_expires_at IS DISTINCT FROM OLD.premium_expires_at) THEN
    -- Sadece servis rolü (admin) veya internal güvenli RPC izin verir
    IF NOT app_flag_on('app.allow_premium_override') AND auth.role() <> 'service_role' THEN
      RAISE EXCEPTION 'Premium durumu kullanıcı tarafından doğrudan güncellenemez.';
    END IF;
  END IF;

  IF NEW.premium_owner_id IS DISTINCT FROM OLD.premium_owner_id THEN
    IF NOT app_flag_on('app.allow_premium_override') AND auth.role() <> 'service_role' THEN
      RAISE EXCEPTION 'Premium sahibi doğrudan değiştirilemez.' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NEW.paired_at IS DISTINCT FROM OLD.paired_at THEN
    IF NOT app_flag_on('app.allow_couple_change') AND auth.role() <> 'service_role' THEN
      RAISE EXCEPTION 'Eşleşme anı doğrudan değiştirilemez.' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Üye sayacı yalnızca users tetikleyicisinden (iç içe tetikleyici), eşleşme RPC'lerinden ya da servis rolünden değişir
  IF NEW.member_count IS DISTINCT FROM OLD.member_count THEN
    IF NOT app_flag_on('app.allow_couple_change') AND auth.role() <> 'service_role' AND pg_trigger_depth() < 2 THEN
      RAISE EXCEPTION 'member_count doğrudan değiştirilemez.' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

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
  PERFORM set_config('app.allow_last_seen', 'on', true);
  UPDATE public.users AS u
     SET last_seen_at = NOW()
   WHERE u.id = auth.uid()
     AND (u.last_seen_at IS NULL OR u.last_seen_at < NOW() - INTERVAL '6 hours');
  PERFORM set_config('app.allow_last_seen', 'off', true);
END;
$$;

REVOKE ALL ON FUNCTION public.touch_last_seen() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.touch_last_seen() TO authenticated;

-- Uygulama, bekleyen talebi olan hesapla açılınca bunu kendiliğinden çağırır (otomatik iptal)
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

  PERFORM set_config('app.allow_last_seen', 'on', true);
  UPDATE public.users AS u SET last_seen_at = NOW() WHERE u.id = v_uid;
  PERFORM set_config('app.allow_last_seen', 'off', true);

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

REVOKE ALL ON FUNCTION public.cancel_account_deletion() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_account_deletion() TO authenticated;


-- ============================================================================
-- 4. couple-memories DEPOSU: boyut ve tür sınırı (diğer depolarla aynı)
-- ============================================================================
UPDATE storage.buckets
   SET file_size_limit = 5242880,
       allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/gif']
 WHERE id = 'couple-memories';


-- ============================================================================
-- 5. SABİT search_path
-- ============================================================================
-- Saf (tablo okumayan) fonksiyonlar
ALTER FUNCTION public.contains_blocked_word(text) SET search_path = '';
ALTER FUNCTION public.normalize_search_text(text) SET search_path = '';
-- Tablo adlarını şema belirtmeden kullananlar: public + pg_temp (pg_temp en sonda)
ALTER FUNCTION public.clean_demo_device_authorizations() SET search_path = public, pg_temp;
ALTER FUNCTION public.earn_tokens(integer, character varying) SET search_path = public, pg_temp;
ALTER FUNCTION public.generate_couple_for_user(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_active_medicine_reminders(text) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_letter_unlock_reminders(text) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_upcoming_meeting_reminders(text, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.join_couple_by_code(text, integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.log_medicine_dose(integer, integer, date, character varying, character varying, integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.save_daily_note(integer, date, text, integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.spend_tokens(integer, character varying) SET search_path = public, pg_temp;
ALTER FUNCTION public.toggle_period_log(integer, date) SET search_path = public, pg_temp;
ALTER FUNCTION public.verify_device_otp(integer, character varying, character varying) SET search_path = public, pg_temp;


-- ============================================================================
-- 6. KOPYA İNDEKS
-- ============================================================================
DROP INDEX IF EXISTS public.idx_letters_sender;

COMMIT;
