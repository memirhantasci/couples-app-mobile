-- ============================================================================
-- MIGRATION: 20261029000004_star_name_moderation_and_rpc_grants.sql
--
-- 6.5 (1) claim_star_in_sector, claim_random_available_star ve claim_specific_star'ın aksine
--         contains_blocked_word kontrolü yapmıyordu: sektörden sahiplenmede uygunsuz yıldız adı
--         kaydedilebiliyordu. Fonksiyon gövdesini kopyalamak yerine kontrol couple_stars üzerinde
--         bir tetikleyiciyle yapılır (Premium kontrolündeki trg_enforce_premium_star_claim ile aynı
--         yöntem): bugünkü ve ileride eklenecek her sahiplenme yolu için geçerlidir ve ad reddedilirse
--         işlem (katalog yıldızını "alındı" işaretleme dahil) geri alınır. Hata kodu P0006 olduğundan
--         istemcideki moderasyon mesajı değişmeden çalışır. rename_my_star kendi kontrolünü zaten yapar.
--
-- 6.5 (2) Eski 2 parametreli join_couple_by_code_uuid(TEXT, UUID) (auth.uid() kontrolsüz,
--         başkasının kullanıcı kimliğini bir çifte bağlayabilen sürüm) 20261022000006'da kaldırılmıştı;
--         canlı veritabanında kalmış olma ihtimaline karşı burada yinelenir.
--
-- 6.5 (3) 20260916 bu fonksiyonları DROP + CREATE ile yeniden oluşturduğundan, 20260914'te PUBLIC'ten
--         alınan yetkiler yeni imzalarda yeniden varsayılana (PUBLIC) dönmüştü. Yetki yalnızca
--         giriş yapmış kullanıcıya verilir.
--         Not: search_celestial_universe bilerek anon'dan alınmadı; oturumsuz (demo) arama yalnızca
--         herkese açık katalog verisini görür, çift verisi dalları gerçek oturum ister (bkz. 20261029000002).
-- ============================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Yıldız adı moderasyonu: her sahiplenme / yeniden adlandırma yolu için
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_star_name_moderation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF public.contains_blocked_word(NEW.custom_name) THEN
    RAISE EXCEPTION 'Yıldız ismi topluluk kurallarına aykırı kelimeler içeremez.'
      USING ERRCODE = 'P0006';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_star_name_moderation() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_enforce_star_name_moderation ON public.couple_stars;
CREATE TRIGGER trg_enforce_star_name_moderation
  BEFORE INSERT OR UPDATE OF custom_name ON public.couple_stars
  FOR EACH ROW EXECUTE FUNCTION public.enforce_star_name_moderation();


-- ────────────────────────────────────────────────────────────────────────────
-- 2. Eski, güvensiz eşleşme fonksiyonu
-- ────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.join_couple_by_code_uuid(TEXT, UUID);


-- ────────────────────────────────────────────────────────────────────────────
-- 3. Yıldız RPC'lerinin yetkileri
-- ────────────────────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.claim_random_available_star(INTEGER, VARCHAR, NUMERIC, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.claim_specific_star(INTEGER, BIGINT, VARCHAR, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.claim_star_in_sector(INTEGER, VARCHAR, VARCHAR, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.search_star_by_name(TEXT) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.claim_random_available_star(INTEGER, VARCHAR, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_specific_star(INTEGER, BIGINT, VARCHAR, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_star_in_sector(INTEGER, VARCHAR, VARCHAR, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_star_by_name(TEXT) TO authenticated;

COMMIT;
