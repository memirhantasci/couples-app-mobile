/// <reference types="jest" />
import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { LETTERS_READ_SOURCE } from "../letterPolicy";

/**
 * Mektup zaman kilidi sunucuda: istemci mektupları public.my_letters görünümünden okur (alıcı için kilitli
 * mektubun başlığı ve içeriği orada boşaltılır). Tabloya doğrudan giden bir okuma kilidi deler ve 2. adımdan
 * (letters_select yalnızca gönderene inince) sonra alıcıda boş döner; bu test onu yakalar.
 */
const SRC = join(__dirname, "../..");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "__tests__" || name === "node_modules" ? [] : sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

describe("mektup okuma kaynağı", () => {
  it("görünümün adı migration 20261113000001 ile aynı", () => {
    expect(LETTERS_READ_SOURCE).toBe("my_letters");
    const migration = readFileSync(
      join(SRC, "../supabase/migrations/20261113000001_my_letters_view.sql"),
      "utf8"
    );
    expect(migration).toMatch(/CREATE OR REPLACE VIEW public\.my_letters/);
  });

  it("hiçbir dosya letters tablosuna doğrudan gitmez", () => {
    const offenders = sourceFiles(SRC).filter((file) => /\.from\(\s*["'`]letters["'`]\s*\)/.test(readFileSync(file, "utf8")));
    expect(offenders.map((file) => file.replace(SRC, ""))).toEqual([]);
  });

  it("okuyan dosyalar ortak sabiti kullanır", () => {
    const readers = sourceFiles(SRC).filter((file) => /\.from\(LETTERS_READ_SOURCE\)/.test(readFileSync(file, "utf8")));
    expect(readers.length).toBeGreaterThanOrEqual(6);
  });
});
