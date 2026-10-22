/**
 * Kullanıcı adları düz metin olarak saklanır: küçük harf, 3-30 karakter, yalnızca a-z, 0-9 ve _.
 * Veritabanındaki `check_username_format` kısıtı ve auth-gateway Edge Function'ı aynı kuralı uygular.
 */
export const USERNAME_MAX_LENGTH = 30;

const USERNAME_PATTERN = /^[a-z0-9_]{3,30}$/;

export function normalizeUsername(input: string): string {
  return input.trim().toLowerCase();
}

export function isValidUsername(username: string): boolean {
  return USERNAME_PATTERN.test(username);
}
