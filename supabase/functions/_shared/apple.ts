// Sign in with Apple: authorizationCode takası ve hesap silinirken token iptali (revoke).
// Apple REST: https://developer.apple.com/documentation/sign_in_with_apple/generate_and_validate_tokens
//                                                       /revoke_tokens
//
// Gerekli Edge Function secret'ları (Apple Developer > Keys > "Sign in with Apple" etkin bir anahtar):
//   APPLE_TEAM_ID      10 karakterli Team ID
//   APPLE_KEY_ID       anahtarın Key ID'si
//   APPLE_PRIVATE_KEY  .p8 dosyasının içeriği (PEM; satır sonları \n ile de verilebilir)
//   APPLE_CLIENT_ID    (isteğe bağlı) uygulamanın bundle kimliği; varsayılan app.couplesky.mobile
// Secret'lar tanımlı değilse hiçbir şey yapılmaz: `isAppleConfigured()` false döner.

const APPLE_AUD = "https://appleid.apple.com";
const DEFAULT_CLIENT_ID = "app.couplesky.mobile";

export function isAppleConfigured(): boolean {
  return !!(Deno.env.get("APPLE_TEAM_ID") && Deno.env.get("APPLE_KEY_ID") && Deno.env.get("APPLE_PRIVATE_KEY"));
}

export function appleClientId(): string {
  return Deno.env.get("APPLE_CLIENT_ID") || DEFAULT_CLIENT_ID;
}

function b64url(data: Uint8Array | string): string {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToDer(pem: string): Uint8Array {
  const body = pem
    .replace(/\\n/g, "\n")
    .replace(/-----BEGIN [A-Z ]+-----/g, "")
    .replace(/-----END [A-Z ]+-----/g, "")
    .replace(/\s+/g, "");
  const bin = atob(body);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Apple'ın client_secret'ı: .p8 anahtarıyla ES256 imzalı, kısa ömürlü JWT. */
export async function createAppleClientSecret(): Promise<string> {
  const teamId = Deno.env.get("APPLE_TEAM_ID")!;
  const keyId = Deno.env.get("APPLE_KEY_ID")!;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToDer(Deno.env.get("APPLE_PRIVATE_KEY")!),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "ES256", kid: keyId, typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({ iss: teamId, iat: now, exp: now + 300, aud: APPLE_AUD, sub: appleClientId() }),
  );
  // Web Crypto ECDSA imzası zaten ham r||s biçimindedir (JWS ES256 için gereken)
  const sig = new Uint8Array(
    await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(`${header}.${payload}`)),
  );
  return `${header}.${payload}.${b64url(sig)}`;
}

/** Uygulamanın girişte aldığı authorizationCode'u (tek kullanımlık, ~5 dk) refresh token'a çevirir. */
export async function exchangeAppleCode(code: string): Promise<string> {
  const res = await fetch(`${APPLE_AUD}/auth/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: appleClientId(),
      client_secret: await createAppleClientSecret(),
      code,
      grant_type: "authorization_code",
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.refresh_token) {
    throw new Error(`Apple token takası başarısız (${res.status}): ${json.error ?? "bilinmiyor"}`);
  }
  return json.refresh_token as string;
}

/**
 * Kullanıcının Apple bağlantısını iptal eder. Zaten iptal edilmiş / geçersiz token (invalid_grant) başarı sayılır;
 * başka bir hatada fırlatır (silme hattı bir sonraki saatte yeniden dener).
 */
export async function revokeAppleToken(refreshToken: string): Promise<void> {
  const res = await fetch(`${APPLE_AUD}/auth/revoke`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: appleClientId(),
      client_secret: await createAppleClientSecret(),
      token: refreshToken,
      token_type_hint: "refresh_token",
    }),
  });
  if (res.ok) return;
  const json = await res.json().catch(() => ({}));
  if (json?.error === "invalid_grant") return;
  throw new Error(`Apple token iptali başarısız (${res.status}): ${json?.error ?? "bilinmiyor"}`);
}
