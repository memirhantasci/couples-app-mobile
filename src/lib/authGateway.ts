import { FunctionsHttpError, type User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

/**
 * Kullanıcı adıyla giriş ve şifre sıfırlama `auth-gateway` Edge Function'ı üzerinden yapılır
 * (bkz. supabase/functions/auth-gateway). Kullanıcı adının e-postası istemciye hiç dönmez ve
 * deneme sınırları sunucuda uygulanır; hesabın var olup olmadığı da yanıtlardan anlaşılmaz.
 */

export type AuthGatewayErrorCode =
  | "invalid_credentials"
  | "email_not_confirmed"
  | "too_many_requests"
  | "invalid_code"
  | "weak_password"
  | "unavailable";

type GatewayFailure = { ok: false; code: AuthGatewayErrorCode; email?: string };

async function callGateway<T>(body: Record<string, string>): Promise<{ ok: true; data: T } | GatewayFailure> {
  const { data, error } = await supabase.functions.invoke("auth-gateway", { body });
  if (!error) return { ok: true, data: data as T };

  if (error instanceof FunctionsHttpError) {
    try {
      const payload = await error.context.json();
      if (typeof payload?.error === "string") {
        return { ok: false, code: payload.error as AuthGatewayErrorCode, email: payload.email };
      }
    } catch {
      // Gövdesi JSON olmayan yanıt: aşağıdaki genel hata
    }
  }
  return { ok: false, code: "unavailable" };
}

/**
 * Kullanıcı adı + şifreyle oturum açar. E-postası doğrulanmamış hesapta (şifre doğruysa)
 * doğrulama ekranına gidebilmek için e-posta da döner.
 */
export async function signInWithUsername(
  username: string,
  password: string
): Promise<{ ok: true; user: User } | GatewayFailure> {
  const result = await callGateway<{ access_token: string; refresh_token: string }>({
    action: "sign-in",
    username,
    password,
  });
  if (!result.ok) return result;

  const { data, error } = await supabase.auth.setSession({
    access_token: result.data.access_token,
    refresh_token: result.data.refresh_token,
  });
  if (error || !data.user) return { ok: false, code: "unavailable" };
  return { ok: true, user: data.user };
}

/** Hesap varsa e-postasına doğrulama kodu gönderilir; yanıt hesabın varlığını belli etmez. */
export async function requestPasswordReset(identifier: string): Promise<{ ok: true } | GatewayFailure> {
  const result = await callGateway<unknown>({ action: "request-reset", identifier });
  return result.ok ? { ok: true } : result;
}

export async function resetPasswordWithCode(
  identifier: string,
  code: string,
  password: string
): Promise<{ ok: true } | GatewayFailure> {
  const result = await callGateway<unknown>({ action: "reset-password", identifier, code, password });
  return result.ok ? { ok: true } : result;
}
