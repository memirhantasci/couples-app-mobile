-- pg_cron uzantısını aktifleştir
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
DECLARE
  v_job_id bigint;
BEGIN
  -- Aynı isimli eski bir job varsa (duplicate schedule oluşmaması için) bul
  SELECT jobid
  INTO v_job_id
  FROM cron.job
  WHERE jobname = 'process-due-auto-exoplanets'
  LIMIT 1;

  -- Varsa iptal et
  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_id);
  END IF;
END;
$$;

-- Saatte bir çalışacak job'ı kur
SELECT cron.schedule(
  'process-due-auto-exoplanets',
  '0 * * * *',
  $cron$
    SELECT public.process_due_auto_exoplanets(50);
  $cron$
);