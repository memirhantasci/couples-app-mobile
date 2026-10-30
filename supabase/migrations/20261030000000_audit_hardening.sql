-- ============================================================================
-- Satış öncesi denetim sertleştirmesi
-- ============================================================================
-- 1. SECURITY DEFINER fonksiyonlarda sabit search_path (save_daily_note, log_medicine_dose,
--    toggle_period_log, check_period_log_rules). Gövdeleri nitelendirilmemiş tablo adları kullandığı
--    için boş değil `public, pg_temp` verilir.
-- 2. redeem_promo_code: kullanıcı başına 15 dakikada en fazla 10 deneme (kaba kuvvetle kod bulmayı önler).
--    Deneme kaydı, fonksiyon hata FIRLATIRSA geri alınacağı için başarısız denemeler hata yerine
--    { success: false, error: '<mesaj>' } olarak DÖNER; istemci bunu hata gibi gösterir.
-- 3. client_errors: 30 günden eski satırlar her gece silinir (tablo sınırsız büyümesin).
-- ============================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. search_path sabitleme
-- ────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_sig TEXT;
BEGIN
  FOREACH v_sig IN ARRAY ARRAY[
    'public.save_daily_note(text, text, integer)',
    'public.log_medicine_dose(integer, text, text, text, integer)',
    'public.toggle_period_log(text)',
    'public.check_period_log_rules()'
  ]
  LOOP
    IF to_regprocedure(v_sig) IS NOT NULL THEN
      EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', v_sig);
    END IF;
  END LOOP;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Promosyon kodu deneme sınırı
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
  v_new_expires timestamp with time zone;
  v_current_premium_expires timestamp with time zone;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  -- Her çağrı (başarılı ya da değil) sınıra sayılır; hata fırlatılmadığı için kayıt korunur
  IF NOT public.consume_auth_rate_limit('promo_redeem', v_user_id::text, 10, 15 * 60) THEN
    RETURN json_build_object('success', false, 'error', 'Çok fazla deneme yaptınız. Lütfen biraz sonra tekrar deneyin.');
  END IF;

  SELECT * INTO v_promo
  FROM public.promo_codes
  WHERE code = UPPER(trim(p_code)) AND is_active = true;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Geçersiz veya süresi dolmuş kod');
  END IF;

  IF v_promo.expires_at IS NOT NULL AND v_promo.expires_at < statement_timestamp() THEN
    RETURN json_build_object('success', false, 'error', 'Bu kodun süresi dolmuş');
  END IF;

  IF v_promo.max_uses IS NOT NULL AND v_promo.current_uses >= v_promo.max_uses THEN
    RETURN json_build_object('success', false, 'error', 'Bu kodun kullanım limiti dolmuş');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.promo_code_usages
    WHERE promo_code_id = v_promo.id AND user_id = v_user_id
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Bu kodu zaten kullandınız');
  END IF;

  SELECT couple_id INTO v_couple_id
  FROM public.users
  WHERE id = v_user_id;

  IF v_promo.reward_type = 'premium_days' AND v_couple_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Premium kodunu kullanmak için bir partnerle eşleşmiş olmalısınız.');
  END IF;

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

-- ────────────────────────────────────────────────────────────────────────────
-- 3. client_errors saklama süresi
-- ────────────────────────────────────────────────────────────────────────────
SELECT cron.schedule(
  'purge-client-errors',
  '43 3 * * *',
  $cron$ DELETE FROM public.client_errors WHERE created_at < now() - interval '30 days'; $cron$
);

COMMIT;
