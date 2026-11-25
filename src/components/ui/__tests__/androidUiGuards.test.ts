/// <reference types="jest" />
/// <reference types="node" />
import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";

const SRC = join(__dirname, "../../..");

function collectNativeTsx(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name !== "__tests__") collectNativeTsx(full, out);
    } else if (/\.tsx$/.test(name) && !/\.web\.tsx$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

const files = collectNativeTsx(SRC);

describe("Android UI kuralları (Modal, BlurView, multiline TextInput)", () => {
  it("tüm yerel <Modal> bileşenleri statusBarTranslucent ve navigationBarTranslucent taşır", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, "utf8");
      const lines = content.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        // Yorum satırlarını atla
        if (/^\s*(\/\/|\*)/.test(lines[i])) continue;
        if (!/<Modal\b/.test(lines[i])) continue;
        let tag = "";
        for (let j = i; j < Math.min(lines.length, i + 14); j++) {
          tag += " " + lines[j];
          if (lines[j].includes(">")) break;
        }
        const hasSB = /\bstatusBarTranslucent\b/.test(tag);
        const hasNB = /\bnavigationBarTranslucent\b/.test(tag);
        if (!hasSB || !hasNB) {
          offenders.push(`${relative(SRC, file)}:${i + 1} (SB=${hasSB}, NB=${hasNB})`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("PlatformBlurView.tsx dışında doğrudan expo-blur BlurView içe aktarımı yok", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const rel = relative(SRC, file).replace(/\\/g, "/");
      if (rel === "components/ui/PlatformBlurView.tsx") continue;
      const content = readFileSync(file, "utf8");
      if (/from\s+["']expo-blur["']/.test(content)) {
        offenders.push(rel);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("tüm çok satırlı (multiline) TextInput alanları Android için textAlignVertical='top' taşır", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, "utf8");
      const lines = content.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        if (/^\s*(\/\/|\*)/.test(lines[i])) continue;
        if (!/<TextInput\b/.test(lines[i])) continue;
        let tag = "";
        for (let j = i; j < Math.min(lines.length, i + 30); j++) {
          tag += " " + lines[j];
          if (/\/>/.test(lines[j])) break;
        }
        if (/\bmultiline\b/.test(tag) && !/textAlignVertical\s*=/.test(tag)) {
          offenders.push(`${relative(SRC, file)}:${i + 1}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
