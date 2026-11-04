/**
 * iOS widget verisi App Group UserDefaults'a yazılır; orası yalnızca plist türlerini saklar ve `null` bir
 * değer kaydı sessizce yazdırmaz: widget eski hesabın verisiyle kalırdı (çıkış / kilit / boş alanlı hesap
 * verisinde null alanlar vardır). Boş alanlar hiç gönderilmez; widget eksik alanı boş sayar.
 */
export function withoutNulls<T extends object>(payload: T): T {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== null && value !== undefined)) as T;
}
