-- ============================================================
-- 002: Mobil Uygulama — Pairing RPC Adaptasyonu
-- ============================================================
-- Bu migration, web projesindeki mevcut join_couple_by_code
-- fonksiyonunu UUID tabanlı kullanıcı kimliğini destekleyecek
-- şekilde günceller. Mobil uygulamada auth.users.id UUID tipinde,
-- web projesinde ise INTEGER tipindedir.
-- 
-- Web projesinde: join_couple_by_code(p_code TEXT, p_user_id INTEGER)
-- Mobilde: join_couple_by_code_uuid(p_code TEXT, p_user_id UUID)
--
-- Ayrı bir fonksiyon açarak web'deki mevcut fonksiyonu bozmuyoruz.
-- Supabase auth.uid() kullanıldığı için SECURITY DEFINER şarttır.
-- ============================================================

-- Not: Bu migration için couples ve users tablolarının
-- web projesindeki şemada zaten kurulu olduğunu varsayıyoruz.
-- (member_count, is_paired, pairing_code sütunları mevcut)

-- ============================================================
-- 1. RPC: Mobil için UUID tabanlı pairing fonksiyonu
-- ============================================================
-- Tüm güvenlik kontrolleri sırayla:
--   1. Kod var mı? (INVALID_CODE)
--   2. Couple dolu mu? (CODE_ALREADY_USED)
--   3. Kendi kodunu mu girdi? (SELF_CODE)
--   4. FOR UPDATE ile row lock → concurrent race condition önlenir
--   5. Kullanıcıyı yeni couple'a taşı
--   6. Eski boş couple'ı temizle
--   7. Yeni couple_id döndür
-- ============================================================

CREATE OR REPLACE FUNCTION join_couple_by_code_uuid(p_code TEXT, p_user_id UUID)
RETURNS TABLE(result_couple_id INTEGER, result_is_paired BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER  -- Fonksiyon, tablo erişim kısıtlamalarını aşarak çalışır
AS $$
DECLARE
  v_target_couple RECORD;
  v_old_couple_id INTEGER;
BEGIN
  -- Adım 1 & 4: Hedef couple satırını kilitle (FOR UPDATE = race condition önlemi)
  -- Aynı anda iki kişi aynı kodu girerse, ilki lock alır, ikincisi bekler ve
  -- "CODE_ALREADY_USED" hatası alır.
  SELECT * INTO v_target_couple
    FROM couples
   WHERE pairing_code = UPPER(p_code)
     FOR UPDATE;

  -- Adım 1 Kontrol: Kod hiç yok mu?
  IF v_target_couple IS NULL THEN
    RAISE EXCEPTION 'INVALID_CODE: Girdiğiniz eşleşme kodu geçersiz veya kullanım dışıdır.';
  END IF;

  -- Adım 2 Kontrol: Couple zaten dolu mu? (2+ üye)
  IF v_target_couple.member_count >= 2 THEN
    RAISE EXCEPTION 'CODE_ALREADY_USED: Bu eşleşme kodu daha önce kullanılmıştır.';
  END IF;

  -- Adım 3 Kontrol: Kullanıcı kendi kodunu mu girdi?
  -- (Bu kontrol veritabanı seviyesinde yapılıyor, sadece UI'da değil)
  IF EXISTS (
    SELECT 1 FROM users
     WHERE auth_id = p_user_id   -- auth_id = Supabase auth.users.id (UUID)
       AND couple_id = v_target_couple.id
  ) THEN
    RAISE EXCEPTION 'SELF_CODE: Kendi eşleşme kodunuzu kullanamazsınız.';
  END IF;

  -- Adım 5: Kullanıcının mevcut (eski) couple'ını kaydet (temizlemek için)
  SELECT users.couple_id INTO v_old_couple_id
    FROM users
   WHERE auth_id = p_user_id;

  -- Adım 5: Kullanıcıyı yeni couple'a taşı
  -- (trg_update_couple_member_count trigger'ı member_count'u otomatik günceller)
  UPDATE users
     SET couple_id = v_target_couple.id
   WHERE auth_id = p_user_id;

  -- Adım 6: Eski couple artık boşsa sil
  IF v_old_couple_id IS NOT NULL AND v_old_couple_id != v_target_couple.id THEN
    DELETE FROM couples
     WHERE id = v_old_couple_id
       AND NOT EXISTS (
         SELECT 1 FROM users WHERE users.couple_id = v_old_couple_id
       );
  END IF;

  -- Adım 7: Yeni couple_id ve is_paired durumunu döndür
  RETURN QUERY SELECT v_target_couple.id, (v_target_couple.member_count + 1) >= 2;
END;
$$;
