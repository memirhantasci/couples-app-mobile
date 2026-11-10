/// <reference types="jest" />
/// <reference types="node" />
import { readFileSync } from "fs";
import { join } from "path";

import {
  WISHLIST_SERVER_READY,
  canOpenWishlist,
  isGuideListed,
  isTabReleased,
  isWishlistReleased,
  wishlistDataNotice,
} from "../wishlistAvailability";

const SRC = join(__dirname, "../..");
const read = (file: string) => readFileSync(join(SRC, file), "utf8");

const PROD_OFF = { serverReady: false, isDev: false };
const PROD_ON = { serverReady: true, isDev: false };
const DEV_OFF = { serverReady: false, isDev: true };

describe("ortak liste açılış kapısı", () => {
  it("sunucu henüz canlıda değil: bayrak kapalı", () => {
    // Bu test bilerek kırılır: bayrağı açan kişi migration'ın canlıda olduğunu doğrulamış olmalı
    expect(WISHLIST_SERVER_READY).toBe(false);
  });

  it("üretimde bayrak kapalıyken hiçbir yüzey açılmaz (demo hariç)", () => {
    expect(isWishlistReleased(PROD_OFF)).toBe(false);
    expect(canOpenWishlist(false, PROD_OFF)).toBe(false);
    expect(isTabReleased("wishlist", PROD_OFF)).toBe(false);
    expect(isGuideListed("wishlist", false, PROD_OFF)).toBe(false);
  });

  it("demo modunda ekran açılır ve örnek veri uyarısı çıkar; sekme açılmaz", () => {
    expect(canOpenWishlist(true, PROD_OFF)).toBe(true);
    expect(isGuideListed("wishlist", true, PROD_OFF)).toBe(true);
    expect(isTabReleased("wishlist", PROD_OFF)).toBe(false);
    expect(wishlistDataNotice(true, { serverReady: false })).toBe("demo");
    expect(wishlistDataNotice(true, { serverReady: true })).toBe("demo");
  });

  it("bayrak açılınca tek değişiklikle hepsi açılır, mock uyarısı kalkar", () => {
    expect(isWishlistReleased(PROD_ON)).toBe(true);
    expect(canOpenWishlist(false, PROD_ON)).toBe(true);
    expect(isTabReleased("wishlist", PROD_ON)).toBe(true);
    expect(isGuideListed("wishlist", false, PROD_ON)).toBe(true);
    expect(wishlistDataNotice(false, { serverReady: true })).toBeNull();
  });

  it("geliştirme yapısında mock veriyle açılır ve bunu söyler", () => {
    expect(canOpenWishlist(false, DEV_OFF)).toBe(true);
    expect(isTabReleased("wishlist", DEV_OFF)).toBe(true);
    expect(wishlistDataNotice(false, { serverReady: false })).toBe("mock");
  });

  it("diğer sekme ve rehberler kapıdan etkilenmez", () => {
    expect(isTabReleased("meetings", PROD_OFF)).toBe(true);
    expect(isGuideListed("meetings", false, PROD_OFF)).toBe(true);
  });
});

describe("kapı tek kaynaktan bağlı", () => {
  it("veri katmanı kendi bayrağını tanımlamaz, ortak bayrağı kullanır", () => {
    const data = read("lib/wishlistData.ts");
    expect(data).toMatch(/import \{ WISHLIST_SERVER_READY as SERVER_READY \} from "@\/lib\/wishlistAvailability"/);
    expect(data).not.toMatch(/const SERVER_READY\s*=/);
  });

  it("menü satırı, sekme listesi, rehber listesi, bildirim rotası ve ekran kapıyı kullanır", () => {
    expect(read("app/menu.tsx")).toMatch(/canOpenWishlist\(isDemoMode\) \?/);
    expect(read("app/menu.tsx")).toMatch(/getAllPageGuides\(t, \{ isDemoMode \}\)/);
    expect(read("context/TabBarContext.tsx")).toMatch(/TAB_DEFINITIONS\.filter\(\(def\) => isTabReleased\(def\.key\)\)/);
    expect(read("constants/featureGuides.ts")).toMatch(/isGuideListed\(k, !!options\.isDemoMode\)/);
    expect(read("lib/notificationRoutes.ts")).toMatch(/isWishlistReleased\(\)/);
    expect(read("app/(tabs)/wishlist.tsx")).toMatch(/if \(!canOpenWishlist\(isDemoMode\)\) return <Redirect/);
  });
});

describe("kapı kapalıyken (üretim) davranış", () => {
  const load = (released: boolean) => {
    jest.resetModules();
    jest.doMock("@/lib/wishlistAvailability", () => {
      const actual = jest.requireActual("@/lib/wishlistAvailability");
      const flags = { serverReady: released, isDev: false };
      return {
        ...actual,
        isWishlistReleased: () => actual.isWishlistReleased(flags),
        isGuideListed: (key: string, demo: boolean) => actual.isGuideListed(key, demo, flags),
      };
    });
    return {
      routes: require("../notificationRoutes") as typeof import("../notificationRoutes"),
      guides: require("@/constants/featureGuides") as typeof import("@/constants/featureGuides"),
    };
  };
  afterEach(() => jest.dontMock("@/lib/wishlistAvailability"));

  const t = ((key: string) => key) as never;

  it("bildirim yükündeki ortak liste rotası açılmaz; açılınca açılır", () => {
    expect(load(false).routes.resolveNotificationRoute({ route: "/(tabs)/wishlist" })).toBeNull();
    expect(load(true).routes.resolveNotificationRoute({ route: "/(tabs)/wishlist" })).toBe("/(tabs)/wishlist");
  });

  it("menüdeki rehber listesinde yalnızca yayındayken ya da demoda görünür", () => {
    const closed = load(false).guides;
    expect(closed.getAllPageGuides(t).map((g) => g.pageKey)).not.toContain("wishlist");
    expect(closed.getAllPageGuides(t, { isDemoMode: true }).map((g) => g.pageKey)).toContain("wishlist");
    // Ekranın kendi tur düğmesi (demo) için rehber yine çözülür
    expect(closed.getPageGuide("wishlist", t)).not.toBeNull();
    expect(load(true).guides.getAllPageGuides(t).map((g) => g.pageKey)).toContain("wishlist");
  });
});
