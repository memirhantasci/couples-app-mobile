// Kullanıcı adıyla giriş ve şifre sıfırlama (bkz. src/lib/authGateway.ts).
//
// Eski `get_email_by_username` RPC'si kullanıcı adının e-postasını anonim herkese döndürüyordu;
// eski şifre sıfırlama RPC'si ise doğrulama kodunu doğrudan çağırana veriyordu (kullanıcı adını
// bilen herkes şifreyi değiştirebiliyordu). Burada e-posta yalnızca sunucuda çözülür:
//
//   sign-in         { username, password }        → { access_token, refresh_token }
//   request-reset   { identifier }                → { ok: true }  (hesap var mı belli edilmez)
//   reset-password  { identifier, code, password } → { ok: true }
//
// Kod, Supabase Auth'un "Reset Password" e-postasıyla gelir (şablonda {{ .Token }} olmalı).
// Hatalar { error: "<kod>" } gövdesiyle döner; kodlar istemcideki AuthGatewayErrorCode ile aynı.
// Oturumsuz çağrıldığı için JWT doğrulaması kapalı dağıtılır:
//   supabase functions deploy auth-gateway --no-verify-jwt

import { createClient } from "npm:@supabase/supabase-js@2";

const USERNAME_PATTERN = /^[a-z0-9_]{3,30}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;
const WINDOW_15_MIN = 15 * 60;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Kullanıcı adına açılan oturumlar servis istemcisine karışmasın diye ayrı, istek başına istemci
const AUTH_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? SERVICE_ROLE_KEY;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function reply(status: number, body: Record<string, unknown>): Response {
  return Response.json(body, { status, headers: CORS_HEADERS });
}

const fail = (status: number, error: string, extra: Record<string, unknown> = {}) =>
  reply(status, { error, ...extra });

function clientIp(req: Request): string {
  return (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
}

/** Supabase Auth'a istemcinin IP'siyle gidilir; Auth'un kendi IP sınırları da kişiye uygulanır. */
function authClientFor(ip: string) {
  return createClient(SUPABASE_URL, AUTH_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { "X-Forwarded-For": ip } },
  });
}

/** Sınır aşılmadıysa denemeyi kaydedip true döner. Kayıt yapılamazsa kapalı kalınır (hata). */
async function allow(bucket: string, subject: string, max: number, windowSeconds: number): Promise<boolean> {
  const { data, error } = await admin.rpc("consume_auth_rate_limit", {
    p_bucket: bucket,
    p_subject: subject,
    p_max: max,
    p_window_seconds: windowSeconds,
  });
  if (error) throw new Error(`rate limit: ${error.message}`);
  return data === true;
}

/** Kullanıcı adı ya da e-postadan hesabın e-postasını bulur; yoksa null. */
async function resolveEmail(identifier: string): Promise<string | null> {
  if (identifier.includes("@")) return EMAIL_PATTERN.test(identifier) ? identifier : null;
  if (!USERNAME_PATTERN.test(identifier)) return null;

  const { data: profile, error } = await admin
    .from("users")
    .select("id")
    .eq("username", identifier)
    .maybeSingle();
  if (error) throw new Error(`profil okunamadı: ${error.message}`);
  if (!profile) return null;

  const { data, error: userError } = await admin.auth.admin.getUserById(profile.id);
  if (userError) throw new Error(`hesap okunamadı: ${userError.message}`);
  return data.user?.email ?? null;
}

function readString(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  return typeof value === "string" ? value : "";
}

async function signIn(body: Record<string, unknown>, ip: string): Promise<Response> {
  const username = readString(body, "username").trim().toLowerCase();
  const password = readString(body, "password");
  if (!USERNAME_PATTERN.test(username) || !password) return fail(401, "invalid_credentials");

  // IP başına toplam ve hesap başına deneme sınırı (şifre tahminine karşı)
  if (!(await allow("sign_in_ip", ip, 20, 5 * 60)) || !(await allow("sign_in_user", username, 10, WINDOW_15_MIN))) {
    return fail(429, "too_many_requests");
  }

  const email = await resolveEmail(username);
  if (!email) return fail(401, "invalid_credentials");

  const { data, error } = await authClientFor(ip).auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    // Bu hata yalnızca şifre doğruyken döner: sahibi doğrulama ekranına yönlendirilir
    if (error?.code === "email_not_confirmed" || /email not confirmed/i.test(error?.message ?? "")) {
      return fail(403, "email_not_confirmed", { email });
    }
    if (error?.status === 429) return fail(429, "too_many_requests");
    return fail(401, "invalid_credentials");
  }

  return reply(200, {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
}

async function requestReset(body: Record<string, unknown>, ip: string): Promise<Response> {
  const identifier = readString(body, "identifier").trim().toLowerCase();
  if (!identifier) return reply(200, { ok: true });

  if (!(await allow("reset_request_ip", ip, 5, WINDOW_15_MIN)) || !(await allow("reset_request_id", identifier, 3, WINDOW_15_MIN))) {
    return fail(429, "too_many_requests");
  }

  const email = await resolveEmail(identifier);
  if (email) {
    const { error } = await authClientFor(ip).auth.resetPasswordForEmail(email);
    // Gönderim hatası da dışarıya yansıtılmaz (hesabın varlığını belli ederdi)
    if (error) console.error("[auth-gateway] kurtarma e-postası gönderilemedi:", error.message);
  }
  return reply(200, { ok: true });
}

async function resetPassword(body: Record<string, unknown>, ip: string): Promise<Response> {
  const identifier = readString(body, "identifier").trim().toLowerCase();
  const code = readString(body, "code").trim();
  const password = readString(body, "password");
  if (password.length < MIN_PASSWORD_LENGTH) return fail(400, "weak_password");
  if (!identifier || !/^\d{6,10}$/.test(code)) return fail(400, "invalid_code");

  if (!(await allow("reset_verify_ip", ip, 20, WINDOW_15_MIN)) || !(await allow("reset_verify_id", identifier, 10, WINDOW_15_MIN))) {
    return fail(429, "too_many_requests");
  }

  const email = await resolveEmail(identifier);
  if (!email) return fail(400, "invalid_code");

  const client = authClientFor(ip);
  const { data, error } = await client.auth.verifyOtp({ email, token: code, type: "recovery" });
  if (error || !data.session) return fail(400, "invalid_code");

  const { error: updateError } = await client.auth.updateUser({ password });
  if (updateError) {
    if (updateError.code === "weak_password") return fail(400, "weak_password");
    console.error("[auth-gateway] şifre güncellenemedi:", updateError.message);
    return fail(500, "unavailable");
  }

  // Şifre değişti: hesabın tüm açık oturumları (ör. çalınan bir cihaz) kapatılır
  await client.auth.signOut({ scope: "global" }).catch(() => {});
  return reply(200, { ok: true });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return fail(405, "method_not_allowed");

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail(400, "bad_request");
  }

  const ip = clientIp(req);
  try {
    switch (body.action) {
      case "sign-in":
        return await signIn(body, ip);
      case "request-reset":
        return await requestReset(body, ip);
      case "reset-password":
        return await resetPassword(body, ip);
      default:
        return fail(400, "bad_request");
    }
  } catch (cause) {
    console.error("[auth-gateway]", cause instanceof Error ? cause.message : cause);
    return fail(500, "unavailable");
  }
});
