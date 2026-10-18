-- ============================================================
-- Fix: Password reset never touched Supabase Auth
--
-- forgot-password.tsx inserted into public.otp_codes and
-- reset-password.tsx updated public.users.password — but
-- 003_supabase_auth_refactor.sql dropped users.password long ago
-- and otp_codes never existed, so the whole flow silently failed
-- (or, if it had "worked", would never have changed the password
-- auth.signInWithPassword actually checks in auth.users).
--
-- This migration adds the missing table and two SECURITY DEFINER
-- RPCs that: (1) issue a bcrypt-hashed OTP for a username, callable
-- by anonymous clients like get_email_by_username already is, and
-- (2) verify that OTP and update auth.users.encrypted_password
-- directly, so a reset password actually works at the next login.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'password_reset',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tablo önceden farklı sütunlarla (purpose/code_hash olmadan) oluşturulmuşsa sütunları ekle:
ALTER TABLE public.otp_codes ADD COLUMN IF NOT EXISTS code_hash TEXT;
ALTER TABLE public.otp_codes ADD COLUMN IF NOT EXISTS purpose TEXT NOT NULL DEFAULT 'password_reset';

CREATE INDEX IF NOT EXISTS otp_codes_user_id_idx ON public.otp_codes(user_id);

-- RLS is enabled with no policies: only the SECURITY DEFINER functions
-- below (which bypass RLS) may ever read or write a row here.
ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;

-- Issues a password-reset OTP for a username. Rate-limited by IP the
-- same way get_email_by_username is. Only the bcrypt hash is stored;
-- the plaintext code is returned to the caller so the (pre-auth) screen
-- can act on it — the app still also logs it to the console while this
-- feature has no real SMS/e-mail delivery wired up.
CREATE OR REPLACE FUNCTION public.request_password_reset_otp(p_username TEXT)
RETURNS TABLE(result_user_id UUID, result_otp TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_user_id UUID;
  v_ip TEXT;
  v_count INT;
  v_otp TEXT;
BEGIN
  v_ip := current_setting('request.headers', true)::json->>'x-forwarded-for';
  v_ip := split_part(v_ip, ',', 1);
  IF v_ip IS NULL OR v_ip = '' THEN
    v_ip := COALESCE(inet_client_addr()::text, 'unknown');
  END IF;

  DELETE FROM public.login_attempts
  WHERE ip_address = v_ip AND attempt_time < now() - interval '5 minutes';

  SELECT count(*) INTO v_count FROM public.login_attempts WHERE ip_address = v_ip;
  IF v_count >= 10 THEN
    RAISE EXCEPTION 'TOO_MANY_REQUESTS';
  END IF;
  INSERT INTO public.login_attempts (ip_address) VALUES (v_ip);

  SELECT id INTO v_user_id FROM public.users WHERE username = p_username;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'USER_NOT_FOUND';
  END IF;

  v_otp := lpad(floor(random() * 1000000)::numeric::text, 6, '0');

  DELETE FROM public.otp_codes WHERE user_id = v_user_id AND purpose = 'password_reset';
  INSERT INTO public.otp_codes (user_id, code_hash, purpose, expires_at)
  VALUES (v_user_id, crypt(v_otp, gen_salt('bf')), 'password_reset', now() + interval '10 minutes');

  RETURN QUERY SELECT v_user_id, v_otp;
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_password_reset_otp(TEXT) TO anon, authenticated;

-- Verifies the OTP and updates the REAL Supabase Auth password
-- (auth.users.encrypted_password) — not a legacy public.users column —
-- so the new password actually works with auth.signInWithPassword.
CREATE OR REPLACE FUNCTION public.reset_password_with_otp(p_user_id UUID, p_otp TEXT, p_new_password TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_row RECORD;
BEGIN
  IF length(p_new_password) < 6 THEN
    RAISE EXCEPTION 'WEAK_PASSWORD';
  END IF;

  SELECT * INTO v_row
  FROM public.otp_codes
  WHERE user_id = p_user_id AND purpose = 'password_reset'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_row IS NULL OR v_row.code_hash <> crypt(p_otp, v_row.code_hash) THEN
    RAISE EXCEPTION 'INVALID_CODE';
  END IF;

  IF v_row.expires_at < now() THEN
    RAISE EXCEPTION 'EXPIRED_CODE';
  END IF;

  UPDATE auth.users
  SET encrypted_password = crypt(p_new_password, gen_salt('bf')),
      updated_at = now()
  WHERE id = p_user_id;

  DELETE FROM public.otp_codes WHERE user_id = p_user_id AND purpose = 'password_reset';
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_password_with_otp(UUID, TEXT, TEXT) TO anon, authenticated;
