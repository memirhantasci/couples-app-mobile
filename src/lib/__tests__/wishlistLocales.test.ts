/// <reference types="jest" />
/// <reference types="node" />
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

import { WISHLIST_CATEGORIES, WISHLIST_TITLE_MAX } from "../wishlist";
import { getWishlistIdeas } from "../wishlistIdeas";

const SRC = join(__dirname, "../..");

type Json = { [key: string]: Json | string };
const load = (lang: string): Json => JSON.parse(readFileSync(join(SRC, "locales", `${lang}.json`), "utf8"));

function flatten(node: Json | string, prefix = "", out: Record<string, string> = {}): Record<string, string> {
  if (typeof node === "string") {
    out[prefix] = node;
    return out;
  }
  for (const [key, value] of Object.entries(node)) flatten(value, prefix ? `${prefix}.${key}` : key, out);
  return out;
}

const tr = flatten(load("tr"));
const en = flatten(load("en"));

/** Ortak listeye ait tüm çeviri alanları (ekran, menü, sekme, rehber, paywall, sunucu hatası). */
const WISHLIST_KEY = /^(wishlist\.|menu\.wishlist\.|tabs\.wishlist\.|guides\.pages\.wishlist\.|paywall\.copy\.wishlist\.|serverErrors\.wishlistLimit$)/;
const wishlistKeys = (messages: Record<string, string>) => Object.keys(messages).filter((key) => WISHLIST_KEY.test(key));
const placeholders = (text: string) => [...text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]).sort();

describe("ortak liste çevirileri (TR ↔ EN)", () => {
  it("iki dilde aynı anahtar kümesi var", () => {
    const trKeys = wishlistKeys(tr).sort();
    const enKeys = wishlistKeys(en).sort();
    expect(trKeys.length).toBeGreaterThan(60);
    expect(trKeys.filter((key) => !(key in en))).toEqual([]);
    expect(enKeys.filter((key) => !(key in tr))).toEqual([]);
  });

  it("hiçbir metin boş değil", () => {
    for (const [lang, messages] of [["tr", tr], ["en", en]] as const) {
      for (const key of wishlistKeys(messages)) {
        expect([lang, key, messages[key].trim().length > 0]).toEqual([lang, key, true]);
      }
    }
  });

  it("iki dilde aynı {{değişken}} adları kullanılıyor", () => {
    for (const key of wishlistKeys(tr)) {
      if (!(key in en)) continue;
      expect([key, placeholders(tr[key])]).toEqual([key, placeholders(en[key])]);
    }
  });

  it("çoğul anahtarları (_one/_other) iki dilde de eksiksiz", () => {
    for (const messages of [tr, en]) {
      const bases = new Set(
        wishlistKeys(messages)
          .filter((key) => /_(one|other)$/.test(key))
          .map((key) => key.replace(/_(one|other)$/, ""))
      );
      expect(bases.size).toBeGreaterThan(0);
      for (const base of bases) {
        expect(`${base}_one` in messages).toBe(true);
        expect(`${base}_other` in messages).toBe(true);
      }
    }
  });

  it("ekran başlığı bilerek kısa kalmış", () => {
    expect(tr["wishlist.title"]).toBe("Yapacaklarımız");
    expect(en["wishlist.title"]).toBe("Our Bucket List");
  });
});

describe("kodda kullanılan çeviri anahtarları", () => {
  const sourceFiles: string[] = [];
  (function walk(dir: string) {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) {
        if (name !== "__tests__" && name !== "locales") walk(full);
      } else if (/\.tsx?$/.test(name) && /wishlist/i.test(full.slice(SRC.length))) {
        sourceFiles.push(full);
      }
    }
  })(SRC);
  const source = sourceFiles.map((file) => readFileSync(file, "utf8")).join("\n");
  const used = [...new Set([...source.matchAll(/["'`](wishlist\.[A-Za-z0-9_.]+)["'`]/g)].map((m) => m[1]))];
  const baseOf = (key: string) => key.replace(/_(one|other)$/, "");

  it("ortak liste kaynak dosyaları bulundu", () => {
    expect(sourceFiles.length).toBeGreaterThan(8);
    expect(used.length).toBeGreaterThan(40);
  });

  it("kullanılan her anahtar iki dilde de var", () => {
    const exists = (messages: Record<string, string>, key: string) =>
      key in messages || `${key}_other` in messages;
    expect(used.filter((key) => !exists(tr, key))).toEqual([]);
    expect(used.filter((key) => !exists(en, key))).toEqual([]);
  });

  it("yetim (kullanılmayan) wishlist.* anahtarı yok", () => {
    const usedBases = new Set(used.map(baseOf));
    const orphans = Object.keys(tr)
      .filter((key) => key.startsWith("wishlist."))
      .filter((key) => !usedBases.has(baseOf(key)));
    expect(orphans).toEqual([]);
  });
});

describe("hazır fikirler", () => {
  const trIdeas = getWishlistIdeas("tr");
  const enIdeas = getWishlistIdeas("en");

  it("iki dilde aynı sayıda ve aynı anahtarlarla gelir", () => {
    expect(trIdeas.length).toBe(enIdeas.length);
    expect(trIdeas.map((idea) => idea.key)).toEqual(enIdeas.map((idea) => idea.key));
  });

  it("altı kategorinin hepsini kapsar", () => {
    const covered = new Set(trIdeas.map((idea) => idea.category));
    for (const category of WISHLIST_CATEGORIES) expect(covered.has(category)).toBe(true);
  });

  it("kategoriler dengeli dağılmış (hiçbiri ikiden fazla değil)", () => {
    const counts = new Map<string, number>();
    for (const idea of trIdeas) counts.set(idea.category, (counts.get(idea.category) ?? 0) + 1);
    expect(Math.max(...counts.values())).toBeLessThanOrEqual(2);
  });

  it("anahtarlar ve metinler tekrar etmez", () => {
    for (const ideas of [trIdeas, enIdeas]) {
      expect(new Set(ideas.map((idea) => idea.key)).size).toBe(ideas.length);
      expect(new Set(ideas.map((idea) => idea.title.toLowerCase())).size).toBe(ideas.length);
    }
  });

  it("metinler boş değil, başlık sınırını aşmıyor, iki dilde farklı", () => {
    trIdeas.forEach((idea, index) => {
      const english = enIdeas[index];
      expect(idea.title.trim().length).toBeGreaterThan(0);
      expect(english.title.trim().length).toBeGreaterThan(0);
      expect(idea.title.length).toBeLessThanOrEqual(WISHLIST_TITLE_MAX);
      expect(english.title.length).toBeLessThanOrEqual(WISHLIST_TITLE_MAX);
      expect(idea.title).not.toBe(english.title);
    });
  });

  it("Türkçe dışındaki her dil İngilizce metin alır", () => {
    expect(getWishlistIdeas("de")[0].title).toBe(enIdeas[0].title);
  });
});
