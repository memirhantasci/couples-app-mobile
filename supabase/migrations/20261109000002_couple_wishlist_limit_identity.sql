-- ============================================================================
-- Ortak liste: sınır tetikleyicisinde kimlik kontrolü (gözden geçirme bulgusu 2)
-- ----------------------------------------------------------------------------
-- Sorun: BEFORE INSERT tetikleyicileri RLS'in WITH CHECK denetiminden ÖNCE çalışır. İstemci başka bir çiftin
-- couple_id'siyle ekleme denediğinde trg_wishlist_limit o çiftin açık madde sayısını ve Premium durumunu
-- değerlendiriyor, sonuca göre P0022 (dolu) ya da RLS reddi (42501, dolu değil) dönüyordu. Böylece başka bir
-- çiftin listesinin dolu olup olmadığı ve Premium'u (16+ açık maddede) dışarıdan okunabiliyordu.
--
-- Çözüm: tetikleyici EN BAŞTA eklenen satırın çağıranın kendisine ve kendi çiftine ait olduğunu doğrular;
-- değilse RLS ihlaliyle birebir aynı hatayı (42501, aynı metin) verir. Sayım ve Premium kontrolü yalnızca
-- çağıranın kendi çifti için yapılır.
--
-- Oturumsuz çağrı (servis rolü / bakım, auth.uid() boş) RLS'i zaten atlar; trg_solo_write_guard ile aynı
-- uzlaşımla kimlik eşleşmesi aranmaz, sınır NEW.couple_id için uygulanmaya devam eder. anon rolünün tabloya
-- INSERT yetkisi yoktur.
-- Test: supabase/tests/couple_wishlist_test.sql (bölüm 8).
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.trg_wishlist_enforce_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_couple INTEGER;
BEGIN
  IF v_uid IS NOT NULL THEN
    v_couple := public.get_my_couple_id();
    -- RLS (couple_wishlist_items_insert_own) ile aynı koşul ve aynı hata: reddin nedeni bilgi sızdırmaz
    IF v_couple IS NULL
       OR NEW.couple_id IS DISTINCT FROM v_couple
       OR NEW.created_by IS DISTINCT FROM v_uid THEN
      RAISE EXCEPTION 'new row violates row-level security policy for table "couple_wishlist_items"'
        USING ERRCODE = '42501';
    END IF;
  ELSE
    v_couple := NEW.couple_id;
  END IF;

  IF NEW.status = 'open' THEN
    PERFORM public.wishlist_assert_capacity(v_couple, NEW.created_by);
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.trg_wishlist_enforce_limit() FROM PUBLIC, anon, authenticated;

COMMIT;
