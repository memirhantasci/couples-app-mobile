import * as Linking from "expo-linking";

/**
 * Kök layout'un (handleDeepLink) kendisi işlediği uygulama bağlantıları:
 * - couplesapp://verify?token_hash=...&type=...   (e-posta doğrulama)
 * - couplesapp://invite?code=... / pair?code=...  (eşleşme daveti)
 * - couplesapp://reset-password?token_hash=...     (şifre sıfırlama)
 *
 * +native-intent aynı ayrıştırıcıyla bu bağlantıları router'dan alır; aksi halde router `/verify`'ı
 * ikinci kez açıyor (tek kullanımlık belirteç ikinci ekranda "geçersiz" çıkıyordu), `/invite` için
 * ise eşleşmeyen rota gösteriyordu.
 */
export type AppLink =
  | { readonly kind: "verify"; readonly tokenHash: string; readonly type: string }
  | { readonly kind: "invite"; readonly code: string }
  | { readonly kind: "reset-password"; readonly tokenHash: string };

export function parseAppLink(url: string): AppLink | null {
  const { hostname, queryParams } = Linking.parse(url);
  const param = (key: string) => {
    const value = queryParams?.[key];
    return typeof value === "string" && value ? value : null;
  };

  if (hostname === "verify") {
    const tokenHash = param("token_hash");
    return tokenHash ? { kind: "verify", tokenHash, type: param("type") ?? "email" } : null;
  }
  if (hostname === "invite" || hostname === "pair") {
    const code = param("code");
    return code ? { kind: "invite", code } : null;
  }
  if (hostname === "reset-password") {
    const tokenHash = param("token_hash");
    return tokenHash ? { kind: "reset-password", tokenHash } : null;
  }
  return null;
}
