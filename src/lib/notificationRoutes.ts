/**
 * Bildirime dokunulunca açılacak ekran. Sunucu her bildirimin `data.route` alanında hedef ekranı gönderir;
 * eski ya da eksik yüklerde `data.type` kullanılır. Yalnızca bilinen uygulama içi ekranlara gidilir:
 * yükte ne yazarsa yazsın, listede olmayan bir yol açılmaz.
 */

/** Bildirimle açılabilen ekranlar */
const ALLOWED_ROUTES: ReadonlySet<string> = new Set([
  "/(tabs)/home",
  "/(tabs)/letters",
  "/(tabs)/photos",
  "/(tabs)/memories",
  "/(tabs)/map",
  "/(tabs)/period-tracker",
  "/(tabs)/medicine",
  "/(tabs)/meetings",
  "/(tabs)/calendar",
  "/(tabs)/profile",
  "/our-star",
]);

/** `data.route` yoksa bildirim türünün açacağı ekran (sunucudaki türlerle aynı adlar) */
const TYPE_ROUTES: Readonly<Record<string, string>> = {
  letter: "/(tabs)/letters",
  letter_unlock: "/(tabs)/letters",
  photo: "/(tabs)/photos",
  map: "/(tabs)/map",
  period: "/(tabs)/period-tracker",
  period_reminder: "/(tabs)/period-tracker",
  medicine: "/(tabs)/medicine",
  medicine_reminder: "/(tabs)/medicine",
  meeting: "/(tabs)/meetings",
  meeting_reminder: "/(tabs)/meetings",
  mood: "/(tabs)/home",
  milestone: "/(tabs)/home",
  anniversary_reminder: "/(tabs)/home",
  inactivity_reminder: "/(tabs)/home",
  referral_reward: "/(tabs)/profile",
};

/** Bildirim yükünden (`request.content.data`) güvenle açılabilecek ekranı çözer; yoksa null. */
export function resolveNotificationRoute(data: unknown): string | null {
  if (typeof data !== "object" || data === null) return null;
  const { route, type } = data as { route?: unknown; type?: unknown };

  if (typeof route === "string") {
    const path = route.trim();
    if (ALLOWED_ROUTES.has(path)) return path;
  }
  if (typeof type === "string" && Object.hasOwn(TYPE_ROUTES, type)) return TYPE_ROUTES[type];
  return null;
}
