# process-account-deletions

Süresi dolan hesap silme taleplerini işleyen Edge Function. Talep akışı ve veritabanı tarafı:
`supabase/migrations/20261022000000_account_deletion.sql`.

## Dağıtım (bir kez)

```bash
supabase db push                                            # migration'ı uygular (cron işi dahil)
supabase functions deploy process-account-deletions --no-verify-jwt
```

`--no-verify-jwt` gereklidir: cron işi anahtar taşımaz. Fonksiyon yalnızca `scheduled_for` zamanı
geçmiş talepleri işlediği için dışarıdan çağrılması bir hesabı erken silemez.

## Kontrol

```sql
-- Bekleyen talepler ve son hatalar
select user_id, requested_at, scheduled_for, last_attempt_at, last_error
from public.account_deletion_requests order by scheduled_for;

-- Cron çalıştırmaları
select status, return_message, start_time
from cron.job_run_details
where jobid = (select jobid from cron.job where jobname = 'process-account-deletions')
order by start_time desc limit 10;
```

Elle tetiklemek için: `curl -X POST https://<proje>.supabase.co/functions/v1/process-account-deletions`
