-- ============================================================
-- 004: Validation & Data Integrity Constraints
-- ============================================================

DO $$ 
BEGIN

    -- ======================================================================
    -- 1. USERS TABLE
    -- ======================================================================
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'users') THEN
        
        -- Kullanıcı Adı: Sadece harf, rakam ve alt çizgi. 3 ile 30 karakter arası. Boşluk yok.
        ALTER TABLE public.users DROP CONSTRAINT IF EXISTS check_username_format;
        ALTER TABLE public.users ADD CONSTRAINT check_username_format 
        CHECK (username ~ '^[a-zA-Z0-9_]{3,30}$');

        -- Görünür Ad: Maksimum 50 karakter ve tamamen boş (sadece boşluk) olamaz.
        ALTER TABLE public.users DROP CONSTRAINT IF EXISTS check_display_name_length;
        ALTER TABLE public.users ADD CONSTRAINT check_display_name_length 
        CHECK (display_name IS NULL OR (char_length(trim(display_name)) > 0 AND char_length(display_name) <= 50));
        
    END IF;


    -- ======================================================================
    -- 2. COUPLES TABLE
    -- ======================================================================
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'couples') THEN
        
        -- Eşleşme Kodu: Kesinlikle 6 karakter, sadece büyük harf ve rakam.
        ALTER TABLE public.couples DROP CONSTRAINT IF EXISTS check_pairing_code_format;
        ALTER TABLE public.couples ADD CONSTRAINT check_pairing_code_format 
        CHECK (pairing_code IS NULL OR pairing_code ~ '^[A-Z0-9]{6}$');

    END IF;


    -- ======================================================================
    -- 3. LETTERS TABLE
    -- ======================================================================
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'letters') THEN
        
        -- Başlık: Maksimum 100 karakter, boş olamaz.
        ALTER TABLE public.letters DROP CONSTRAINT IF EXISTS check_letter_title_length;
        ALTER TABLE public.letters ADD CONSTRAINT check_letter_title_length 
        CHECK (title IS NULL OR (char_length(trim(title)) > 0 AND char_length(title) <= 100));

        -- İçerik: Maksimum 5000 karakter, boş olamaz.
        ALTER TABLE public.letters DROP CONSTRAINT IF EXISTS check_letter_content_length;
        ALTER TABLE public.letters ADD CONSTRAINT check_letter_content_length 
        CHECK (content IS NULL OR (char_length(trim(content)) > 0 AND char_length(content) <= 5000));

    END IF;


    -- ======================================================================
    -- 4. DAILY NOTES TABLE
    -- ======================================================================
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'daily_notes') THEN
        
        -- İçerik: Maksimum 3000 karakter, boş olamaz.
        ALTER TABLE public.daily_notes DROP CONSTRAINT IF EXISTS check_daily_note_content_length;
        ALTER TABLE public.daily_notes ADD CONSTRAINT check_daily_note_content_length 
        CHECK (content IS NULL OR (char_length(trim(content)) > 0 AND char_length(content) <= 3000));

    END IF;


    -- ======================================================================
    -- 5. MEMORIES TABLE
    -- ======================================================================
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'memories') THEN
        
        -- Başlık: Maksimum 100 karakter, boş olamaz.
        ALTER TABLE public.memories DROP CONSTRAINT IF EXISTS check_memory_title_length;
        ALTER TABLE public.memories ADD CONSTRAINT check_memory_title_length 
        CHECK (title IS NULL OR (char_length(trim(title)) > 0 AND char_length(title) <= 100));

        -- Açıklama: Maksimum 1000 karakter.
        ALTER TABLE public.memories DROP CONSTRAINT IF EXISTS check_memory_description_length;
        ALTER TABLE public.memories ADD CONSTRAINT check_memory_description_length 
        CHECK (description IS NULL OR char_length(description) <= 1000);

    END IF;


    -- ======================================================================
    -- 6. MEDICINES TABLE
    -- ======================================================================
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'medicines') THEN
        
        -- İlaç Adı: Maksimum 50 karakter, boş olamaz.
        ALTER TABLE public.medicines DROP CONSTRAINT IF EXISTS check_medicine_name_length;
        ALTER TABLE public.medicines ADD CONSTRAINT check_medicine_name_length 
        CHECK (name IS NULL OR (char_length(trim(name)) > 0 AND char_length(name) <= 50));

    END IF;

END $$;
