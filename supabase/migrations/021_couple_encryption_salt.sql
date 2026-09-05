-- ============================================================
-- 021: Çifte Özel Şifreleme Salt Eklentisi (Per-Couple Encryption)
-- ============================================================
-- Bu migration, couples tablosuna her çift için rastgele
-- 256-bit benzersiz bir şifreleme tuzu (salt) ekler.
-- İstemci bu salt ve couple_id'yi harmanlayarak (PBKDF2)
-- o çifte özel dinamik bir AES-256 anahtarı türetecektir.
-- ============================================================

ALTER TABLE public.couples 
  ADD COLUMN IF NOT EXISTS encryption_salt TEXT DEFAULT gen_random_uuid()::text;

-- Güvenlik Notu:
-- encryption_salt kolonu sadece auth.uid() veya o çiftin üyesi 
-- tarafından okunabilir olmalıdır. "View couple data" isimli mevcut RLS 
-- politikası, sadece kullanıcının kendi çiftine bakmasına izin verdiği için 
-- ekstra bir okuma güvenliği yapmaya gerek yoktur.
