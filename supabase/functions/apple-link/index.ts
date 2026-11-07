// Sign in with Apple girişinden sonra uygulama bunu çağırır: authorizationCode Apple'a gönderilip refresh token'a
// çevrilir ve apple_auth_tokens tablosunda saklanır. Token yalnızca hesap silinirken Apple bağlantısını iptal etmek
// için kullanılır (bkz. process-account-deletions, migrations/20261108000000_apple_auth_tokens.sql).
//
// Dağıtım (kullanıcı JWT'si zorunlu):
//   supabase functions deploy apple-link
// Secret'lar tanımlı değilse (_shared/apple.ts) çağrı sessizce atlanır ve giriş etkilenmez.

import { createClient } from "npm:@supabase/supabase-js@2";
import { exchangeAppleCode, isAppleConfigured } from "../_shared/apple.ts";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return new Response("Unauthorized", { status: 401 });
  const { data: auth, error: authError } = await admin.auth.getUser(token);
  const user = auth?.user;
  if (authError || !user) return new Response("Unauthorized", { status: 401 });

  // Yalnızca Apple ile giriş yapmış hesaplar için anlamlı
  const hasApple = (user.identities ?? []).some((identity) => identity.provider === "apple");
  if (!hasApple) return Response.json({ ok: false, reason: "not_apple_user" }, { status: 400 });

  if (!isAppleConfigured()) return Response.json({ ok: false, reason: "not_configured" });

  const { data: allowed } = await admin.rpc("consume_auth_rate_limit", {
    p_bucket: "apple_link",
    p_subject: user.id,
    p_max: 10,
    p_window_seconds: 3600,
  });
  if (allowed === false) return Response.json({ ok: false, reason: "rate_limited" }, { status: 429 });

  const body = await req.json().catch(() => ({}));
  const code = typeof body?.authorizationCode === "string" ? body.authorizationCode : "";
  if (!code || code.length > 2048) return Response.json({ ok: false, reason: "bad_request" }, { status: 400 });

  try {
    const refreshToken = await exchangeAppleCode(code);
    const { error } = await admin
      .from("apple_auth_tokens")
      .upsert({ user_id: user.id, refresh_token: refreshToken, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return Response.json({ ok: true });
  } catch (cause) {
    console.error("[apple-link]", cause instanceof Error ? cause.message : cause);
    return Response.json({ ok: false, reason: "exchange_failed" }, { status: 502 });
  }
});
