-- 011_token_rpcs.sql

CREATE OR REPLACE FUNCTION earn_tokens(p_amount integer, p_reason character varying)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 1. Insert transaction
  INSERT INTO public.token_transactions (user_id, amount, reason)
  VALUES (v_user_id, p_amount, p_reason);

  -- 2. Update user balance
  UPDATE public.users
  SET token_balance = COALESCE(token_balance, 0) + p_amount
  WHERE id = v_user_id;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION spend_tokens(p_amount integer, p_reason character varying)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_current_balance integer;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get current balance
  SELECT COALESCE(token_balance, 0) INTO v_current_balance
  FROM public.users
  WHERE id = v_user_id;

  IF v_current_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient tokens';
  END IF;

  -- 1. Insert transaction (negative amount for spending)
  INSERT INTO public.token_transactions (user_id, amount, reason)
  VALUES (v_user_id, -p_amount, p_reason);

  -- 2. Update user balance
  UPDATE public.users
  SET token_balance = COALESCE(token_balance, 0) - p_amount
  WHERE id = v_user_id;

  RETURN true;
END;
$$;
