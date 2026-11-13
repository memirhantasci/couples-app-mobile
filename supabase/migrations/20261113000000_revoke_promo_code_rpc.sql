-- ============================================================================
-- Promosyon kodu kalıntısı: redeem_promo_code istemciden çağrılamaz
-- ----------------------------------------------------------------------------
-- Promosyon kodu girişi uygulamadan 2026-11-07'de kaldırıldı (K-1) ve promo_codes boş. Fonksiyon SECURITY DEFINER
-- olarak authenticated rolüne açık kalmıştı: max_uses kontrolü kilitsiz olduğundan, ileride tabloya bir kod
-- eklenirse eşzamanlı çağrılarla sınır aşılabilirdi.
--
-- Eski sürüm uyumu: mağazaya çıkan build'lerin (iOS 17, 18, 20; Android 9, 11, 12) hiçbiri bu RPC'yi çağırmıyor
-- (git grep ile doğrulandı). Çağıran son build iOS 15'ti (yalnızca TestFlight).
--
-- Yalnızca yetki alınır; fonksiyon ve tablolar (promo_codes, promo_redemptions, promo_code_usages) durur.
-- Geri alma: GRANT EXECUTE ON FUNCTION public.redeem_promo_code(character varying) TO authenticated;
-- ============================================================================

BEGIN;

REVOKE ALL ON FUNCTION public.redeem_promo_code(character varying) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_promo_code(character varying) TO service_role;

COMMIT;
