/// <reference types="jest" />
import { resolveNotificationRoute } from "../notificationRoutes";

describe("resolveNotificationRoute", () => {
  it("bilinen bir route'u olduğu gibi döndürür", () => {
    expect(resolveNotificationRoute({ route: "/(tabs)/letters", type: "letter" })).toBe("/(tabs)/letters");
    expect(resolveNotificationRoute({ route: "/(tabs)/memories", type: "photo" })).toBe("/(tabs)/memories");
    expect(resolveNotificationRoute({ route: "/our-star" })).toBe("/our-star");
    expect(resolveNotificationRoute({ route: "/(tabs)/profile", type: "referral_reward" })).toBe("/(tabs)/profile");
  });

  it("ortak liste ekranı yayındayken izin listesinde (jest geliştirme yapısıdır; üretim kapısı wishlistAvailability.test.ts)", () => {
    expect(resolveNotificationRoute({ route: "/(tabs)/wishlist" })).toBe("/(tabs)/wishlist");
  });

  it("route yoksa türden çözer", () => {
    expect(resolveNotificationRoute({ type: "letter" })).toBe("/(tabs)/letters");
    expect(resolveNotificationRoute({ type: "photo" })).toBe("/(tabs)/photos");
    expect(resolveNotificationRoute({ type: "map" })).toBe("/(tabs)/map");
    expect(resolveNotificationRoute({ type: "period" })).toBe("/(tabs)/period-tracker");
    expect(resolveNotificationRoute({ type: "meeting_reminder" })).toBe("/(tabs)/meetings");
    expect(resolveNotificationRoute({ type: "referral_reward" })).toBe("/(tabs)/profile");
    expect(resolveNotificationRoute({ type: "vault_expiry_reminder" })).toBe("/premium");
    expect(resolveNotificationRoute({ route: "/premium", type: "vault_expiry_reminder" })).toBe("/premium");
  });

  it("listede olmayan route'u açmaz; türe düşer", () => {
    expect(resolveNotificationRoute({ route: "/(auth)/login", type: "letter" })).toBe("/(tabs)/letters");
    expect(resolveNotificationRoute({ route: "/(tabs)/add-memory?id=1" })).toBeNull();
    expect(resolveNotificationRoute({ route: "https://example.com", type: "unknown" })).toBeNull();
    expect(resolveNotificationRoute({ route: "//evil" })).toBeNull();
  });

  it("geçersiz yükte null döner", () => {
    expect(resolveNotificationRoute(undefined)).toBeNull();
    expect(resolveNotificationRoute(null)).toBeNull();
    expect(resolveNotificationRoute("letter")).toBeNull();
    expect(resolveNotificationRoute({ route: 42, type: {} })).toBeNull();
    expect(resolveNotificationRoute({ type: "constructor" })).toBeNull();
    expect(resolveNotificationRoute({ type: "toString" })).toBeNull();
  });
});
