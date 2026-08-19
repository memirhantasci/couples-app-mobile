-- ============================================================
-- 009: Eşleşme Kodu Oluştururken (INSERT+SELECT) Çıkan RLS Hatasının Çözümü
-- ============================================================

DO $$
BEGIN
    -- Eski politikayı sil (Varsa)
    DROP POLICY IF EXISTS "Couples can be viewed by their members" ON public.couples;
    
    -- Yeni politikayı ekle: Çift tablosu sadece kendi üyeleri veya HENÜZ ÜYESİ OLMAYAN (Boş) durumdaysa görüntülenebilir.
    -- Bu sayede INSERT yapıldıktan hemen sonra okuma (SELECT) yapıldığında RLS kalkanına takılmaz ve döngü tamamlanır.
    CREATE POLICY "Couples can be viewed by their members or if empty" 
    ON public.couples 
    FOR SELECT 
    USING (id = get_my_couple_id() OR member_count = 0);
END $$;
