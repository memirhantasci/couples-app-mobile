-- 012_premium_sync.sql

-- Bu fonksiyon RevenueCat üzerinden satın alma işlemi gerçekleştiğinde veya doğrulandığında
-- kullanıcının çiftinin (couple) premium durumunu veritabanında güncellemek için kullanılır.
CREATE OR REPLACE FUNCTION set_premium_status(p_is_premium boolean, p_expires_at timestamp with time zone)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_couple_id integer;
BEGIN
  -- 1. Kullanıcı ID'sini al
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 2. Kullanıcının couple_id'sini bul
  SELECT couple_id INTO v_couple_id
  FROM public.users
  WHERE id = v_user_id;

  IF v_couple_id IS NULL THEN
    RAISE EXCEPTION 'User does not belong to a couple';
  END IF;

  -- 3. Couples tablosunu güncelle
  UPDATE public.couples
  SET 
    is_premium = p_is_premium,
    premium_expires_at = p_expires_at
  WHERE id = v_couple_id;

  RETURN true;
END;
$$;
