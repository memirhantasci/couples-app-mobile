-- Aşk Skoru'nun regl bileşeni, okuyanın RLS yetkisine bağlıydı: ücretsiz erkek partner period_logs
-- okuyamadığı için bileşeni hiç görmüyor, kadın partner görüyordu ve iki taraf farklı skor görüyordu.
-- Bu fonksiyon yalnızca iki bayrak döndürür (ayrıntı değil), böylece skor iki partnerde de aynı hesaplanır.
BEGIN;

CREATE OR REPLACE FUNCTION public.get_couple_period_activity(p_since date, p_month_start date)
RETURNS TABLE (has_recent boolean, has_this_month boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    COALESCE(bool_or(pl.date >= p_since), false),
    COALESCE(bool_or(pl.date >= p_month_start), false)
  FROM public.period_logs AS pl
  WHERE pl.couple_id = public.get_my_couple_id();
$$;

REVOKE ALL ON FUNCTION public.get_couple_period_activity(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_couple_period_activity(date, date) TO authenticated;

COMMIT;
