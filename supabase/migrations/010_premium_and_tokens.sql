-- ============================================================================
-- 010_premium_and_tokens.sql
-- Premium abonelik sistemi ve Token (Reklam Kredisi) altyapısı
-- ============================================================================

-- 1. couples tablosuna premium sütunları ekle
ALTER TABLE public.couples
  ADD COLUMN IF NOT EXISTS is_premium boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS premium_expires_at timestamp with time zone;

-- 2. users tablosuna token bakiyesi ekle (reklam izleyerek kazanılan jeton)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS token_balance integer DEFAULT 0;

-- 3. Promosyon kodları tablosu
CREATE TABLE IF NOT EXISTS public.promo_codes (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code character varying NOT NULL UNIQUE,
  discount_percent integer NOT NULL DEFAULT 100, -- 100 = bedava, 50 = %50 indirim
  max_uses integer DEFAULT 1,                     -- Kaç kez kullanılabilir
  used_count integer DEFAULT 0,
  is_active boolean DEFAULT true,
  expires_at timestamp with time zone,            -- Opsiyonel: son kullanma tarihi
  created_at timestamp with time zone DEFAULT now()
);

-- 4. Promosyon kodu kullanım geçmişi
CREATE TABLE IF NOT EXISTS public.promo_redemptions (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  promo_code_id integer REFERENCES public.promo_codes(id),
  couple_id integer REFERENCES public.couples(id),
  redeemed_at timestamp with time zone DEFAULT now()
);

-- 5. Token işlem geçmişi (reklam izleme, harcama takibi)
CREATE TABLE IF NOT EXISTS public.token_transactions (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL,
  amount integer NOT NULL,          -- Pozitif: kazanım, Negatif: harcama
  reason character varying NOT NULL, -- 'ad_reward', 'letter_spend', 'promo_bonus'
  created_at timestamp with time zone DEFAULT now()
);

-- 6. RLS politikaları
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_transactions ENABLE ROW LEVEL SECURITY;

-- Promo kodları herkes okuyabilir (kod geçerliliği kontrol etmek için)
CREATE POLICY "promo_codes_read" ON public.promo_codes
  FOR SELECT TO authenticated USING (true);

-- Promo redemptions: Kullanıcı sadece kendi çiftinin kullanımlarını görebilir
CREATE POLICY "promo_redemptions_select" ON public.promo_redemptions
  FOR SELECT TO authenticated
  USING (couple_id IN (SELECT couple_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "promo_redemptions_insert" ON public.promo_redemptions
  FOR INSERT TO authenticated
  WITH CHECK (couple_id IN (SELECT couple_id FROM public.users WHERE id = auth.uid()));

-- Token transactions: Kullanıcı sadece kendi işlemlerini görebilir
CREATE POLICY "token_transactions_select" ON public.token_transactions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "token_transactions_insert" ON public.token_transactions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
