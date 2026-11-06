-- ============================================================================
-- 20261107000000: Premium arka kapısını kapat (satış öncesi K-1)
-- ============================================================================
-- set_premium_status, giriş yapmış HERKESE açıktı: istemci kendi çiftinin Premium'unu istediği süreye
-- ayarlayabiliyordu (test için bilinçli bırakılmıştı). Premium'u yalnızca revenuecat-webhook (service_role)
-- ve redeem_promo_code yazar. Bu migration çalıştırma yetkisini yalnızca service_role'e bırakır ve
-- FREEMIRHAN promosyon kodunu pasifleştirir.
-- ============================================================================

REVOKE ALL ON FUNCTION public.set_premium_status(boolean, timestamp with time zone) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_premium_status(boolean, timestamp with time zone) TO service_role;

UPDATE public.promo_codes SET is_active = false WHERE upper(code) IN ('FREEMIRHAN', 'DELETEMIRHAN');
