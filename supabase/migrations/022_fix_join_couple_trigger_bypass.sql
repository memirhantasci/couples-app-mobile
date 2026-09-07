-- ============================================================
-- 022: Fix join_couple_by_code_uuid trigger bypass
-- ============================================================
-- Migration 018 added check_users_update_integrity() trigger on public.users,
-- which blocks changes to couple_id unless current_setting('app.allow_couple_change', true) is NOT NULL.
-- However, join_couple_by_code_uuid was never updated to set this config,
-- causing every call to join_couple_by_code_uuid to fail with:
-- "couple_id doğrudan değiştirilemez. Lütfen eşleşme kodunu kullanın."
--
-- This migration updates join_couple_by_code_uuid to set the session config flag
-- before updating users.couple_id, allowing pairing to succeed seamlessly.

CREATE OR REPLACE FUNCTION join_couple_by_code_uuid(p_code TEXT)
RETURNS TABLE(result_couple_id INTEGER, result_is_paired BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_target_couple RECORD;
  v_old_couple_id INTEGER;
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_target_couple
    FROM couples
   WHERE pairing_code = UPPER(p_code)
     FOR UPDATE;

  IF v_target_couple IS NULL THEN
    RAISE EXCEPTION 'INVALID_CODE';
  END IF;

  IF v_target_couple.member_count >= 2 THEN
    RAISE EXCEPTION 'CODE_ALREADY_USED';
  END IF;

  IF EXISTS (
    SELECT 1 FROM users
     WHERE id = v_uid
       AND couple_id = v_target_couple.id
  ) THEN
    RAISE EXCEPTION 'SELF_CODE';
  END IF;

  SELECT couple_id INTO v_old_couple_id
    FROM users
   WHERE id = v_uid;

  -- Set session configuration flag so check_users_update_integrity allows couple_id update
  PERFORM set_config('app.allow_couple_change', 'true', true);

  UPDATE users
     SET couple_id = v_target_couple.id
   WHERE id = v_uid;

  IF v_old_couple_id IS NOT NULL AND v_old_couple_id != v_target_couple.id THEN
    DELETE FROM couples
     WHERE id = v_old_couple_id
       AND NOT EXISTS (
         SELECT 1 FROM users WHERE users.couple_id = v_old_couple_id
       );
  END IF;

  RETURN QUERY SELECT v_target_couple.id, (v_target_couple.member_count + 1) >= 2;
END;
$$;

CREATE OR REPLACE FUNCTION join_couple_by_code_uuid(p_code TEXT, p_user_id UUID)
RETURNS TABLE(result_couple_id INTEGER, result_is_paired BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_target_couple RECORD;
  v_old_couple_id INTEGER;
BEGIN
  SELECT * INTO v_target_couple
    FROM couples
   WHERE pairing_code = UPPER(p_code)
     FOR UPDATE;

  IF v_target_couple IS NULL THEN
    RAISE EXCEPTION 'INVALID_CODE';
  END IF;

  IF v_target_couple.member_count >= 2 THEN
    RAISE EXCEPTION 'CODE_ALREADY_USED';
  END IF;

  IF EXISTS (
    SELECT 1 FROM users
     WHERE (id = p_user_id OR auth_id = p_user_id)
       AND couple_id = v_target_couple.id
  ) THEN
    RAISE EXCEPTION 'SELF_CODE';
  END IF;

  SELECT users.couple_id INTO v_old_couple_id
    FROM users
   WHERE (id = p_user_id OR auth_id = p_user_id);

  -- Set session configuration flag so check_users_update_integrity allows couple_id update
  PERFORM set_config('app.allow_couple_change', 'true', true);

  UPDATE users
     SET couple_id = v_target_couple.id
   WHERE (id = p_user_id OR auth_id = p_user_id);

  IF v_old_couple_id IS NOT NULL AND v_old_couple_id != v_target_couple.id THEN
    DELETE FROM couples
     WHERE id = v_old_couple_id
       AND NOT EXISTS (
         SELECT 1 FROM users WHERE users.couple_id = v_old_couple_id
       );
  END IF;

  RETURN QUERY SELECT v_target_couple.id, (v_target_couple.member_count + 1) >= 2;
END;
$$;
