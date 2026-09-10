-- ============================================================================
-- 023: Premium Güvenlik Açıkları, RLS Sıkılaştırma ve Token RPC Paketi
-- ============================================================================
-- 1. set_premium_status: İstemciden (authenticated) yetkisiz doğrudan çağrılmasını engeller,
--    yalnızca service_role (admin/webhook) erişimine açar ve trigger bayrağını set eder.
-- 2. save_letter: Mektup gönderiminde Premium ve Token (100) kontrolünü atomik olarak
--    sunucu tarafında zorunlu kılar. Bakiye yetersizse işlemi engeller.
-- 3. spend_tokens & earn_tokens: Eksik token RPC'lerini güvenli şekilde tanımlar.
--    earn_tokens miktarını sunucuda sabitler, istemciden manipüle edilemez.
-- 4. photo_archive & photos bucket: RLS seviyesinde aktif Premium üyeliği şart koşar.
-- 5. period_logs: Erkek partnerin döngü verilerini okumasını Premium şartına bağlar.
-- 6. redeem_promo_code: Migration 018 trigger çakışmasını giderir (allow bayraklarını set eder).
-- ============================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. set_premium_status Sıkılaştırması
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_premium_status(p_is_premium boolean, p_expires_at timestamp with time zone)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_couple_id integer;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT couple_id INTO v_couple_id
  FROM public.users
  WHERE id = v_user_id;

  IF v_couple_id IS NULL THEN
    RAISE EXCEPTION 'Kullanıcı bir çifte bağlı değil' USING ERRCODE = '42501';
  END IF;

  -- Migration 018 trigger'ının engellememesi için session bayrağını aç
  PERFORM set_config('app.allow_premium_override', 'true', true);

  UPDATE public.couples
  SET 
    is_premium = p_is_premium,
    premium_expires_at = p_expires_at
  WHERE id = v_couple_id;

  RETURN true;
END;
$$;

-- İstemcilerden doğrudan çağrıyı engelle, yalnızca service_role'e izin ver
REVOKE ALL ON FUNCTION public.set_premium_status(boolean, timestamp with time zone) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_premium_status(boolean, timestamp with time zone) TO service_role;


-- ────────────────────────────────────────────────────────────────────────────
-- 2. Token RPC'leri (earn_tokens & spend_tokens)
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.earn_tokens(p_reason text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_amount integer;
  v_new_balance integer;
  v_today_count integer;
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  -- Güvenlik: Ödül miktarı sunucuda sabittir, istemciden parametre alınmaz!
  IF p_reason = 'ad_reward' THEN
    v_amount := 25;

    -- Günlük maksimum 25 reklam izleme limiti (spam / bot engeli)
    SELECT COUNT(*) INTO v_today_count
    FROM public.token_transactions
    WHERE user_id = v_user_id
      AND reason = 'ad_reward'
      AND created_at >= (statement_timestamp() - interval '24 hours');

    IF v_today_count >= 25 THEN
      RAISE EXCEPTION 'Günlük reklam izleme sınırına ulaştınız. Lütfen daha sonra tekrar deneyin.'
        USING ERRCODE = 'P0003';
    END IF;
  ELSE
    RAISE EXCEPTION 'Geçersiz ödül sebebi' USING ERRCODE = '22023';
  END IF;

  -- Migration 018 trigger'ı için bayrağı set et
  PERFORM set_config('app.allow_token_change', 'true', true);

  UPDATE public.users
  SET token_balance = COALESCE(token_balance, 0) + v_amount
  WHERE id = v_user_id
  RETURNING token_balance INTO v_new_balance;

  INSERT INTO public.token_transactions (user_id, amount, reason)
  VALUES (v_user_id, v_amount, p_reason);

  RETURN v_new_balance;
END;
$$;

CREATE OR REPLACE FUNCTION public.spend_tokens(p_amount integer, p_reason text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_balance integer;
  v_new_balance integer;
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Geçersiz harcama miktarı' USING ERRCODE = '22023';
  END IF;

  SELECT token_balance INTO v_balance
  FROM public.users
  WHERE id = v_user_id
  FOR UPDATE;

  IF COALESCE(v_balance, 0) < p_amount THEN
    RAISE EXCEPTION 'Yetersiz token bakiyesi.' USING ERRCODE = 'P0002';
  END IF;

  -- Migration 018 trigger'ı için bayrağı set et
  PERFORM set_config('app.allow_token_change', 'true', true);

  UPDATE public.users
  SET token_balance = v_balance - p_amount
  WHERE id = v_user_id
  RETURNING token_balance INTO v_new_balance;

  INSERT INTO public.token_transactions (user_id, amount, reason)
  VALUES (v_user_id, -p_amount, COALESCE(p_reason, 'spend'));

  RETURN v_new_balance;
END;
$$;

REVOKE ALL ON FUNCTION public.earn_tokens(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.earn_tokens(text) TO authenticated;

REVOKE ALL ON FUNCTION public.spend_tokens(integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.spend_tokens(integer, text) TO authenticated;


-- ────────────────────────────────────────────────────────────────────────────
-- 3. save_letter Sunucu Taraflı Token & Premium Koruması
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.save_letter(
  p_receiver_id UUID,
  p_title TEXT,
  p_content TEXT,
  p_unlock_date DATE,
  p_couple_id INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_couple_id INTEGER;
  v_user_id UUID;
  v_token_balance INTEGER;
  v_is_premium BOOLEAN;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  v_caller_couple_id := public.get_my_couple_id();
  IF v_caller_couple_id IS NULL OR (p_couple_id IS NOT NULL AND v_caller_couple_id != p_couple_id) THEN
    RAISE EXCEPTION 'Yetkisiz çift işlemi' USING ERRCODE = '42501';
  END IF;

  -- Alıcının aynı çifte ait partner olduğunu doğrula
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = p_receiver_id AND couple_id = v_caller_couple_id AND id != v_user_id
  ) THEN
    RAISE EXCEPTION 'Mektup yalnızca eşleştiğiniz partnere gönderilebilir.' USING ERRCODE = '42501';
  END IF;

  -- Aktif Premium denetimi
  v_is_premium := public.has_active_premium(v_caller_couple_id);

  IF NOT v_is_premium THEN
    -- Premium değilse 100 token bakiye kontrolü yap
    SELECT token_balance INTO v_token_balance
    FROM public.users
    WHERE id = v_user_id
    FOR UPDATE;

    IF COALESCE(v_token_balance, 0) < 100 THEN
      RAISE EXCEPTION 'Mektup mühürlemek için en az 100 Token veya aktif Premium üyelik gereklidir.'
        USING ERRCODE = 'P0002';
    END IF;

    -- Atomik olarak 100 token düş
    PERFORM set_config('app.allow_token_change', 'true', true);

    UPDATE public.users
    SET token_balance = v_token_balance - 100
    WHERE id = v_user_id;

    INSERT INTO public.token_transactions (user_id, amount, reason)
    VALUES (v_user_id, -100, 'letter_spend');
  END IF;

  -- Mektubu kaydet
  INSERT INTO public.letters (sender_id, receiver_id, title, content, unlock_date, couple_id)
  VALUES (v_user_id, p_receiver_id, p_title, p_content, p_unlock_date, v_caller_couple_id);
END;
$$;

REVOKE ALL ON FUNCTION public.save_letter(UUID, TEXT, TEXT, DATE, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_letter(UUID, TEXT, TEXT, DATE, INTEGER) TO authenticated;


-- ────────────────────────────────────────────────────────────────────────────
-- 4. photo_archive & photos Storage RLS Premium Sıkılaştırması
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.photo_archive ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Insert own data" ON public.photo_archive;
DROP POLICY IF EXISTS "Insert own couple photos" ON public.photo_archive;
CREATE POLICY "Insert own couple photos" ON public.photo_archive
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() 
    AND couple_id = public.get_my_couple_id()
    AND public.has_my_active_premium()
  );

DROP POLICY IF EXISTS "View own couple photos" ON public.photo_archive;
DROP POLICY IF EXISTS "View photos" ON public.photo_archive;
DROP POLICY IF EXISTS "Select own couple photos" ON public.photo_archive;
CREATE POLICY "View own couple photos" ON public.photo_archive
  FOR SELECT TO authenticated
  USING (
    couple_id = public.get_my_couple_id()
    AND public.has_my_active_premium()
  );

DROP POLICY IF EXISTS "Delete own couple photos" ON public.photo_archive;
CREATE POLICY "Delete own couple photos" ON public.photo_archive
  FOR DELETE TO authenticated
  USING (
    couple_id = public.get_my_couple_id()
    AND (user_id = auth.uid() OR public.has_my_active_premium())
  );

-- Storage bucket 'photos' erişim politikası
DROP POLICY IF EXISTS "photos_bucket_access_policy" ON storage.objects;
DROP POLICY IF EXISTS "photos_bucket_premium_policy" ON storage.objects;
CREATE POLICY "photos_bucket_premium_policy" ON storage.objects
FOR ALL TO authenticated
USING (
  bucket_id = 'photos'
  AND (storage.foldername(name))[1] = public.get_my_couple_id()::text
  AND public.has_my_active_premium()
)
WITH CHECK (
  bucket_id = 'photos'
  AND (storage.foldername(name))[1] = public.get_my_couple_id()::text
  AND public.has_my_active_premium()
);


-- ────────────────────────────────────────────────────────────────────────────
-- 5. period_logs Erkek Partner DB Seviyesinde RLS Sıkılaştırması
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.period_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View period logs" ON public.period_logs;
DROP POLICY IF EXISTS "View own couple period logs" ON public.period_logs;
CREATE POLICY "View own couple period logs" ON public.period_logs
  FOR SELECT TO authenticated
  USING (
    couple_id = public.get_my_couple_id()
    AND (
      user_id = auth.uid()
      OR public.has_my_active_premium()
    )
  );


-- ────────────────────────────────────────────────────────────────────────────
-- 6. redeem_promo_code Trigger Çakışması Düzeltmesi
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.redeem_promo_code(p_code character varying)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_couple_id integer;
  v_promo record;
  v_already_used boolean;
  v_new_expires timestamp with time zone;
  v_current_premium_expires timestamp with time zone;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_promo
  FROM public.promo_codes
  WHERE code = UPPER(trim(p_code)) AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Geçersiz veya süresi dolmuş kod';
  END IF;

  IF v_promo.expires_at IS NOT NULL AND v_promo.expires_at < statement_timestamp() THEN
    RAISE EXCEPTION 'Bu kodun süresi dolmuş';
  END IF;

  IF v_promo.max_uses IS NOT NULL AND v_promo.current_uses >= v_promo.max_uses THEN
    RAISE EXCEPTION 'Bu kodun kullanım limiti dolmuş';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.promo_code_usages 
    WHERE promo_code_id = v_promo.id AND user_id = v_user_id
  ) INTO v_already_used;

  IF v_already_used THEN
    RAISE EXCEPTION 'Bu kodu zaten kullandınız';
  END IF;

  SELECT couple_id INTO v_couple_id
  FROM public.users
  WHERE id = v_user_id;

  -- Migration 018 trigger kontrollerini aşmak için session bayraklarını aç
  PERFORM set_config('app.allow_token_change', 'true', true);
  PERFORM set_config('app.allow_premium_override', 'true', true);

  IF v_promo.reward_type = 'tokens' THEN
    UPDATE public.users
    SET token_balance = COALESCE(token_balance, 0) + v_promo.reward_amount
    WHERE id = v_user_id;

    INSERT INTO public.token_transactions (user_id, amount, reason)
    VALUES (v_user_id, v_promo.reward_amount, 'promo_code_' || v_promo.code);

  ELSIF v_promo.reward_type = 'premium_days' THEN
    IF v_couple_id IS NULL THEN
      RAISE EXCEPTION 'Premium kodunu kullanmak için bir partnerle eşleşmiş olmalısınız.';
    END IF;

    SELECT premium_expires_at INTO v_current_premium_expires
    FROM public.couples
    WHERE id = v_couple_id;

    IF v_current_premium_expires IS NULL OR v_current_premium_expires < statement_timestamp() THEN
      v_new_expires := statement_timestamp() + (v_promo.reward_amount || ' days')::interval;
    ELSE
      v_new_expires := v_current_premium_expires + (v_promo.reward_amount || ' days')::interval;
    END IF;

    UPDATE public.couples
    SET is_premium = true, premium_expires_at = v_new_expires
    WHERE id = v_couple_id;
  ELSE
    RAISE EXCEPTION 'Bilinmeyen promosyon ödül tipi';
  END IF;

  INSERT INTO public.promo_code_usages (promo_code_id, user_id)
  VALUES (v_promo.id, v_user_id);

  UPDATE public.promo_codes
  SET current_uses = current_uses + 1
  WHERE id = v_promo.id;

  RETURN json_build_object(
    'success', true, 
    'reward_type', v_promo.reward_type, 
    'reward_amount', v_promo.reward_amount
  );
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_promo_code(character varying) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_promo_code(character varying) TO authenticated;

COMMIT;
