-- ============================================================================
-- 20261107000001: Kullanılmayan eski RPC aşırı yüklemelerinin istemci erişimini kapat
-- ============================================================================
-- Satış öncesi tarama: eski (integer kullanıcı kimlikli / istemciden tutar alan) sürümler, yeni uuid'li
-- sürümlerin yanında canlıda duruyor ve giriş yapmış herkese açıktı. En kritiği
-- earn_tokens(p_amount integer, p_reason): istemcinin kendi token bakiyesine istediği miktarı yazabilmesine
-- izin veriyordu (güvenli sürüm earn_tokens(p_reason text) sabit 25 token + günlük limit uygular).
-- Uygulama bunların hiçbirini çağırmaz (src/ ve supabase/functions taraması); yalnızca yetki alınır,
-- fonksiyonlar silinmez.
-- ============================================================================

REVOKE ALL ON FUNCTION public.earn_tokens(integer, character varying) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.spend_tokens(integer, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.spend_tokens(integer, character varying) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.generate_couple_for_user(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.join_couple_by_code(text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.verify_device_otp(integer, character varying, character varying) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.toggle_period_log(integer, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_medicine_dose(integer, integer, date, character varying, character varying, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_daily_note(integer, date, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.clean_demo_device_authorizations() FROM PUBLIC, anon, authenticated;
