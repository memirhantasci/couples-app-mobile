-- ─── push_tokens tablosu ─────────────────────────────────────────────────────
-- Expo push token'larını kullanıcı başına platformla birlikte saklar.
-- Aynı user + platform için upsert yapılacak (tekrar kayıtta duplicate olmaz).

create table if not exists public.push_tokens (
  id           bigserial primary key,
  user_id      uuid        not null references auth.users(id) on delete cascade,
  token        text        not null,
  platform     text        not null check (platform in ('ios', 'android')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- Bir kullanıcının her platform için tek token'ı olsun
  unique (user_id, platform)
);

-- RLS: Yalnızca kendi token'ına erişebilir
alter table public.push_tokens enable row level security;

create policy "Users can manage own push tokens"
  on public.push_tokens
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
