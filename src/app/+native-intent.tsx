/**
 * Sosyal giriş (Google OAuth) dönüş URL'i (couplesapp://auth/callback#access_token=...)
 * bir ekran değildir; token'ları login ekranı `openAuthSessionAsync` sonucundan kendisi okur.
 * Android'de bu URL uygulamayı intent ile açar ve router "Unmatched Route" gösterirdi.
 * null döndürmek, router'ın yönlendirme yapmayıp mevcut ekranda kalmasını sağlar.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    if (path.includes("auth/callback")) return null;
  } catch {
    // path beklenmedik bir biçimdeyse olduğu gibi bırak
  }
  return path;
}
