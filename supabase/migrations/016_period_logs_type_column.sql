-- period_logs tablosuna opsiyonel type sütunu ekleme (opsiyonel sütun uyumluluğu)
ALTER TABLE IF EXISTS public.period_logs ADD COLUMN IF NOT EXISTS type text DEFAULT 'period';
