-- 013_redeem_promo.sql

CREATE TABLE IF NOT EXISTS public.promo_code_usages (
    id serial PRIMARY KEY,
    promo_code_id integer REFERENCES public.promo_codes(id) ON DELETE CASCADE,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    used_at timestamp with time zone DEFAULT now(),
    UNIQUE(promo_code_id, user_id)
);

-- RLS
ALTER TABLE public.promo_code_usages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can see their own promo usages" ON public.promo_code_usages FOR SELECT USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION redeem_promo_code(p_code character varying)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_couple_id integer;
  v_promo record;
  v_already_used boolean;
  v_new_expires timestamp with time zone;
  v_current_premium_expires timestamp with time zone;
BEGIN
  -- 1. Check auth
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 2. Find Promo Code
  SELECT * INTO v_promo
  FROM public.promo_codes
  WHERE code = p_code AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Geçersiz veya süresi dolmuş kod';
  END IF;

  -- 3. Check expiration and uses
  IF v_promo.expires_at IS NOT NULL AND v_promo.expires_at < now() THEN
    RAISE EXCEPTION 'Bu kodun süresi dolmuş';
  END IF;

  IF v_promo.max_uses IS NOT NULL AND v_promo.current_uses >= v_promo.max_uses THEN
    RAISE EXCEPTION 'Bu kodun kullanım limiti dolmuş';
  END IF;

  -- 4. Check if user already used this code
  SELECT EXISTS(
    SELECT 1 FROM public.promo_code_usages 
    WHERE promo_code_id = v_promo.id AND user_id = v_user_id
  ) INTO v_already_used;

  IF v_already_used THEN
    RAISE EXCEPTION 'Bu kodu zaten kullandınız';
  END IF;

  -- 5. Get user's couple_id
  SELECT couple_id INTO v_couple_id
  FROM public.users
  WHERE id = v_user_id;

  -- 6. Apply Reward
  IF v_promo.reward_type = 'tokens' THEN
    -- Give tokens
    UPDATE public.users
    SET token_balance = COALESCE(token_balance, 0) + v_promo.reward_amount
    WHERE id = v_user_id;
    
    -- Log token transaction
    INSERT INTO public.token_transactions (user_id, amount, reason)
    VALUES (v_user_id, v_promo.reward_amount, 'promo_code_' || p_code);

  ELSIF v_promo.reward_type = 'premium_days' THEN
    IF v_couple_id IS NULL THEN
      RAISE EXCEPTION 'Premium kodunu kullanmak için bir partnerle eşleşmiş olmalısın';
    END IF;

    -- Calculate new expiration
    SELECT premium_expires_at INTO v_current_premium_expires
    FROM public.couples
    WHERE id = v_couple_id;

    IF v_current_premium_expires IS NULL OR v_current_premium_expires < now() THEN
      v_new_expires := now() + (v_promo.reward_amount || ' days')::interval;
    ELSE
      v_new_expires := v_current_premium_expires + (v_promo.reward_amount || ' days')::interval;
    END IF;

    -- Update couple
    UPDATE public.couples
    SET is_premium = true, premium_expires_at = v_new_expires
    WHERE id = v_couple_id;
  ELSE
    RAISE EXCEPTION 'Bilinmeyen ödül tipi';
  END IF;

  -- 7. Record Usage
  INSERT INTO public.promo_code_usages (promo_code_id, user_id)
  VALUES (v_promo.id, v_user_id);

  UPDATE public.promo_codes
  SET current_uses = current_uses + 1
  WHERE id = v_promo.id;

  RETURN json_build_object('success', true, 'reward_type', v_promo.reward_type, 'reward_amount', v_promo.reward_amount);
END;
$$;
