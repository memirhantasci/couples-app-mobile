-- ============================================================================
-- Yıldız parlaklığı yalnızca tanımlı etkinliklerle değişir
-- ============================================================================
-- Sorun: couple_stars üzerinde "couple_stars_update_own" RLS politikası ve anon/authenticated
-- yazma yetkileri vardı. Uygulamayı çözen bir kullanıcı kendi yıldızının luminosity_level,
-- resonance_until, last_spark_at gibi alanlarını doğrudan güncelleyebiliyordu. star_sparks'a da
-- RPC'yi atlayarak doğrudan kıvılcım satırı eklenebiliyordu.
--
-- Düzeltme: bu iki tabloya istemciden doğrudan yazma tamamen kapatılır. Tüm yazmalar zaten
-- SECURITY DEFINER (sahibi postgres) fonksiyonlarla yapılıyor ve bu değişiklikten etkilenmez:
--   • claim_random_available_star / claim_specific_star / claim_star_in_sector (tescil)
--   • rename_my_star (30 günde bir isim)
--   • send_star_spark (günlük kıvılcım, 20 saat bekleme)
-- Etkinlik puanları (couple_activity_*) zaten yalnızca SECURITY DEFINER tetikleyicilerle yazılıyor
-- ve istemcinin bu tablolara yazma yetkisi yok.
-- Uygulama bu tabloları yalnızca okur (select + realtime); okuma politikaları değişmez.
-- ============================================================================

BEGIN;

DROP POLICY IF EXISTS couple_stars_update_own ON public.couple_stars;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.couple_stars FROM anon, authenticated;

DROP POLICY IF EXISTS star_sparks_insert_own ON public.star_sparks;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.star_sparks FROM anon, authenticated;

COMMIT;
