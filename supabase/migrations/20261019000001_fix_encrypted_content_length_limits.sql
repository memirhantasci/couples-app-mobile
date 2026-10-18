-- ============================================================================
-- Şifreli sütunlar için uzunluk kısıtlarını gerçek saklama boyutuna göre düzelt
-- ============================================================================
-- Sorun: 004 migrasyonu daily_notes.content (3000), letters.content (5000) ve
--        users.display_name (50) için DÜZ METİN uzunluğuna göre CHECK koydu. Oysa
--        istemci bu sütunlara "enc:IV_HEX:CIPHERTEXT_HEX" formatında şifreli veri
--        yazıyor (src/utils/crypto.ts). Hex gösterimi bayt sayısını 2'ye katlar:
--
--          saklanan uzunluk = 37 (enc:+IV+:) + 2 * (UTF-8 bayt sayısı, 16'ya yukarı yuvarlı + 16)
--
--        Ölçüm: 2000 ASCII harflik günlük = 4069 karakter, 4000 harflik mektup = 8069,
--        2000 "ş" harfi = 8069. Yani editörün izin verdiği uzunluktaki notlar
--        "violates check constraint" (23514) ile reddediliyordu.
--
-- Çözüm: Sınırları UI'ın izin verdiği en uzun girdinin (4500 UTF-16 birimi, en kötü
--        durumda birim başına 3 UTF-8 bayt) şifreli boyutunu karşılayacak şekilde
--        yükselt: 4500 * 3 = 13500 bayt -> 13504 -> 27008 hex + 37 = 27045 < 30000.
--        Boş içerik engeli korunur. Mevcut satırlar eski (daha sıkı) sınırı zaten
--        sağladığı için yeni kısıt eklenirken doğrulama hatası oluşmaz.
-- ============================================================================

DO $$
BEGIN

    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'daily_notes') THEN
        ALTER TABLE public.daily_notes DROP CONSTRAINT IF EXISTS check_daily_note_content_length;
        ALTER TABLE public.daily_notes ADD CONSTRAINT check_daily_note_content_length
        CHECK (content IS NULL OR (char_length(trim(content)) > 0 AND char_length(content) <= 30000));
    END IF;

    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'letters') THEN
        ALTER TABLE public.letters DROP CONSTRAINT IF EXISTS check_letter_content_length;
        ALTER TABLE public.letters ADD CONSTRAINT check_letter_content_length
        CHECK (content IS NULL OR (char_length(trim(content)) > 0 AND char_length(content) <= 30000));
    END IF;

    -- display_name: 50 düz metin karakter (en kötü durumda 150 bayt) şifrelenince ~357 karakter olur.
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'users') THEN
        ALTER TABLE public.users DROP CONSTRAINT IF EXISTS check_display_name_length;
        ALTER TABLE public.users ADD CONSTRAINT check_display_name_length
        CHECK (display_name IS NULL OR (char_length(trim(display_name)) > 0 AND char_length(display_name) <= 500));
    END IF;

END $$;
