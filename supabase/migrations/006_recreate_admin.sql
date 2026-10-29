-- ============================================================
-- 006: Admin Kullanıcısını Yeniden Oluşturma
-- ============================================================

DO $
BEGIN
    DELETE FROM auth.users WHERE email = 'admin@couples.app';
    DELETE FROM public.users WHERE email = 'admin@couples.app';
END $;
