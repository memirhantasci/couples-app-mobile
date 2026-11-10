/// <reference types="jest" />
/// <reference types="node" />
import { readFileSync } from "fs";
import { join } from "path";

import { classifyWishlistError, WISHLIST_ERROR_KEYS, WISHLIST_WRITE_DENIED } from "../wishlistErrors";

jest.mock("@/lib/i18n", () => ({ __esModule: true, default: { language: "tr", t: (key: string) => `T[${key}]` } }));

const RLS = 'new row violates row-level security policy for table "couple_wishlist_items"';
const check = (name: string) => ({
  code: "23514",
  message: `new row for relation "couple_wishlist_items" violates check constraint "${name}"`,
});

describe("classifyWishlistError", () => {
  it.each([
    [{ code: "P0022", message: "WISHLIST_LIMIT" }, "limit"],
    [new Error("WISHLIST_LIMIT"), "limit"],
    [{ code: "P0020", message: "PARTNER_REQUIRED: Bu özellik için bir partnerle eşleşmen gerekiyor." }, "partnerRequired"],
    [{ code: "P0021", message: "SOLO_PREMIUM_REQUIRED: Partnerin olmadan kayıt eklemek için Premium gerekir." }, "soloPremium"],
    [{ code: "42501", message: RLS }, "denied"],
    [{ code: "42501", message: "Madde bulunamadı veya yetkiniz yok." }, "denied"],
    [{ code: "42501", message: "permission denied for table couple_wishlist_items" }, "denied"],
    [new Error(WISHLIST_WRITE_DENIED), "denied"],
    [check("couple_wishlist_items_title_check"), "invalidTitle"],
    [check("couple_wishlist_items_note_check"), "invalidNote"],
    [check("couple_wishlist_items_category_check"), "invalidCategory"],
    [check("couple_wishlist_items_location_name_check"), "invalidLocation"],
    [check("couple_wishlist_items_coordinates_check"), "invalidLocation"],
    [{ code: "23514", message: "violates check constraint \"x\"" }, "invalid"],
    [{ code: "22023", message: "Geçersiz istek." }, "invalid"],
    [{ code: "", message: "TypeError: Network request failed" }, "network"],
    [new TypeError("Failed to fetch"), "network"],
    [{ code: "57014", message: "canceling statement due to statement timeout" }, "timeout"],
    [{ name: "AbortError", message: "Aborted" }, "timeout"],
    [{ code: "", message: "AbortError: The operation was aborted." }, "timeout"],
    [new Error("beklenmeyen"), "unknown"],
    [null, "unknown"],
  ])("%j → %s", (error, kind) => {
    expect(classifyWishlistError(error)).toBe(kind);
  });

  it("sınır kodu, mesajda başka ifade olsa da sınırdır (paywall'a gider)", () => {
    expect(classifyWishlistError({ code: "P0022", message: "x" })).toBe("limit");
  });
});

describe("hata metinleri iki dilde", () => {
  type Json = { [key: string]: Json | string };
  const load = (lang: string): Json =>
    JSON.parse(readFileSync(join(__dirname, "../../locales", `${lang}.json`), "utf8"));
  const lookup = (messages: Json, key: string) =>
    key.split(".").reduce<Json | string | undefined>((node, part) => (typeof node === "object" ? node[part] : undefined), messages);

  it.each(["tr", "en"])("%s: her türün metni var ve boş değil", (lang) => {
    const messages = load(lang);
    for (const key of [...Object.values(WISHLIST_ERROR_KEYS), "serverErrors.network", "serverErrors.timeout"]) {
      const value = lookup(messages, key);
      expect(typeof value === "string" && value.trim().length > 0 ? key : `EKSİK ${key}`).toBe(key);
    }
  });

  it("ağ, zaman aşımı, yetki ve geçersiz veri metinleri birbirinden ayrı", () => {
    const tr = load("tr");
    const texts = ["network", "timeout", "denied", "invalid", "generic"].map((k) => lookup(tr, `wishlist.errors.${k}`));
    expect(new Set(texts).size).toBe(texts.length);
  });
});
