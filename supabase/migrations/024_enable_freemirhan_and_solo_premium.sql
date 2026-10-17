-- ============================================================
-- 024: Enable FREEMIRHAN cheat code and solo dev premium
-- ============================================================

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

  -- Eğer kullanıcının henüz bir çifti yoksa, test edebilmesi için otomatik çift oluştur
  IF v_couple_id IS NULL THEN
    INSERT INTO public.couples (pairing_code, member_count, is_premium, premium_expires_at)
    VALUES (substring(md5(random()::text) from 1 for 6), 1, p_is_premium, p_expires_at)
    RETURNING id INTO v_couple_id;

    PERFORM set_config('app.allow_couple_change', 'true', true);
    UPDATE public.users SET couple_id = v_couple_id WHERE id = v_user_id;
  ELSE
    PERFORM set_config('app.allow_premium_override', 'true', true);
    UPDATE public.couples
    SET 
      is_premium = p_is_premium,
      premium_expires_at = p_expires_at
    WHERE id = v_couple_id;
  END IF;

  RETURN true;
END;
$$;

-- Authenticated kullanıcılara çalıştırma izni ver
GRANT EXECUTE ON FUNCTION public.set_premium_status(boolean, timestamp with time zone) TO authenticated;

-- FREEMIRHAN promosyon kodunu da garantiye al
INSERT INTO public.promo_codes (code, reward_type, reward_amount, is_active)
VALUES ('FREEMIRHAN', 'premium_days', 3650, true)
ON CONFLICT (code) DO UPDATE SET is_active = true, reward_amount = 3650;
