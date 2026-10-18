-- ============================================================================
-- save_letter aşırı yükleme (overload) temizliği
-- ============================================================================
-- Sorun: Veritabanında public.save_letter için birden fazla imza kaldığında
--        PostgREST RPC çağrısında PGRST203 ("Could not choose the best candidate
--        function") hatası dönüyor ve mektup kaydedilemiyor.
-- Çözüm: Tüm save_letter versiyonlarını sil, 023 migrasyonundaki güvenli
--        (Premium / 100 Token / partner doğrulamalı) tek versiyonu yeniden oluştur.
-- Bağımlılıklar: public.get_my_couple_id(), public.has_active_premium(integer)
--                (20260914_premium_entitlement_and_gates.sql)
-- ============================================================================

-- 1. public.save_letter'ın TÜM eski/aşırı yüklenmiş versiyonlarını sil
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'save_letter'
  LOOP
    EXECUTE format('DROP FUNCTION public.%I(%s)', r.proname, r.args);
  END LOOP;
END $$;

-- 2. Tek ve güvenli versiyonu yeniden oluştur
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
