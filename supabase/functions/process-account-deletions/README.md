# process-account-deletions

Süresi dolan hesap silme taleplerini işleyen Edge Function. Kurallar:
`docs/HESAP_SILME_VE_PREMIUM_TASARIMI.md`. Veritabanı tarafı:
`supabase/migrations/20261022000000_account_deletion.sql` ve
`supabase/migrations/20261107000003_account_deletion_partner_stays.sql`.

Özet: silenin (A) oluşturduğu her şey silinir, partnerin (B) hesabı ve içeriği kalır. Çiftte A'dan
başka kimse yoksa çiftin tamamı silinir. Hareketsiz eşleşmemiş hesaplar da (`reason = 'inactive'`)
aynı hattan silinir.

## Dağıtım

`supabase db push` ÇALIŞTIRMAYIN (canlıdaki migration geçmişi eksik, her şeyi yeniden dener).
Migration'lar tek tek uygulanır: `supabase db query --linked -f supabase/migrations/<dosya>.sql`.

```bash
supabase functions deploy process-account-deletions --no-verify-jwt
supabase secrets set REVENUECAT_SECRET_KEY=sk_...   # partnerin kendi aboneliğini doğrulamak için (bkz. _shared/revenuecat.ts)
```

`--no-verify-jwt` gereklidir: cron işi kullanıcı JWT'si taşımaz; istek webhook secret ile doğrulanır.
Fonksiyon yalnızca `scheduled_for` zamanı geçmiş talepleri işlediği için dışarıdan çağrılması bir
hesabı erken silemez.

## Kontrol

```sql
-- Bekleyen talepler ve son hatalar
select user_id, reason, requested_at, scheduled_for, last_attempt_at, last_error
from public.account_deletion_requests order by scheduled_for;

-- Cron çalıştırmaları
select status, return_message, start_time
from cron.job_run_details
where jobid = (select jobid from cron.job where jobname = 'process-account-deletions')
order by start_time desc limit 10;
```
