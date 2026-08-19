-- ============================================================
-- 007: Kullanıcı Adı Kısıtlamasını Esnetme (Türkçe Karakter Desteği)
-- ============================================================

DO $$
BEGIN
    -- 1. Eski katı kısıtlamayı kaldır
    ALTER TABLE public.users DROP CONSTRAINT IF EXISTS check_username_format;
    
    -- 2. Türkçe karakterleri de destekleyen yeni kısıtlamayı ekle
    -- Artık ç, ğ, ı, ö, ş, ü harfleri ve büyük halleri de kullanılabilir.
    -- Sadece boşluk ve özel semboller yasaklıdır.
    ALTER TABLE public.users ADD CONSTRAINT check_username_format 
    CHECK (username ~ '^[a-zA-Z0-9_çğışöüÇĞIŞÖÜ]{3,30}$');
    
END $$;
