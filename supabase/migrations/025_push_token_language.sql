-- ─── push_tokens.language ────────────────────────────────────────────────────
-- Uygulamanın seçili dilini (tr | en) token ile birlikte saklar. send-push edge fonksiyonu
-- hatırlatıcıları ve partner bildirimlerini alıcının dilinde gönderir. İstemci, token kaydederken ve
-- dil değiştirildiğinde bu sütunu günceller (src/lib/notifications.ts → syncPushTokenLanguage).
-- Sütun yokken hem istemci hem edge fonksiyonu Türkçe varsayılanıyla çalışmaya devam eder.

alter table public.push_tokens
  add column if not exists language text not null default 'tr';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'push_tokens_language_check'
  ) then
    alter table public.push_tokens
      add constraint push_tokens_language_check check (language in ('tr', 'en'));
  end if;
end $$;
