import * as Linking from "expo-linking";

/**
 * Kök layout'un (handleDeepLink) kendisi işlediği uygulama bağlantıları:
 * - couplesapp://verify?token_hash=...&type=...   (e-posta doğrulama)
 * - couplesapp://invite?code=... / pair?code=...  (eşleşme daveti)
 * - couplesapp://refer?code=...                    (arkadaş çift daveti, bkz. lib/referral)
 * - couplesapp://reset-password?token_hash=...     (şifre sıfırlama)
 *
 * +native-intent aynı ayrıştırıcıyla bu bağlantıları router'dan alır; aksi halde router `/verify`'ı
 * ikinci kez açıyor (tek kullanımlık belirteç ikinci ekranda "geçersiz" çıkıyordu), `/invite` için
 * ise eşleşmeyen rota gösteriyordu.
 */
/**
 * Doğrulama bağlantısında kabul edilen türler: uygulamanın e-posta doğrulaması yalnızca bunları kullanır
 * (kayıt onayı ve yeniden gönderim). Serbest bir tür (magiclink, recovery, invite...) kabul edilseydi
 * hazırlanmış bir bağlantı, kullanıcıyı haberi olmadan başkasının hesabına sokabilirdi.
 */
export const VERIFY_LINK_TYPES = ["email", "signup"] as const;
export type VerifyLinkType = (typeof VERIFY_LINK_TYPES)[number];

export function isVerifyLinkType(value: unknown): value is VerifyLinkType {
  return typeof value === "string" && (VERIFY_LINK_TYPES as readonly string[]).includes(value);
}

export type AppLink =
  | { readonly kind: "verify"; readonly tokenHash: string; readonly type: VerifyLinkType }
  | { readonly kind: "invite"; readonly code: string }
  | { readonly kind: "refer"; readonly code: string }
  | { readonly kind: "reset-password"; readonly tokenHash: string };

export function parseAppLink(url: string): AppLink | null {
  const { hostname, queryParams } = Linking.parse(url);
  const param = (key: string) => {
    const value = queryParams?.[key];
    return typeof value === "string" && value ? value : null;
  };

  if (hostname === "verify") {
    const tokenHash = param("token_hash");
    const type = param("type") ?? "email";
    return tokenHash && isVerifyLinkType(type) ? { kind: "verify", tokenHash, type } : null;
  }
  if (hostname === "invite" || hostname === "pair") {
    const code = param("code");
    return code ? { kind: "invite", code } : null;
  }
  if (hostname === "refer") {
    const code = param("code");
    return code ? { kind: "refer", code } : null;
  }
  if (hostname === "reset-password") {
    const tokenHash = param("token_hash");
    return tokenHash ? { kind: "reset-password", tokenHash } : null;
  }
  return null;
}
