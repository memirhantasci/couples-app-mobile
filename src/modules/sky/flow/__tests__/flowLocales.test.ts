/// <reference types="jest" />

// Anahtarlar kodda dinamik üretildiği için (reason/option/warnings/errors) derleyici eksikleri yakalamaz
const tr = require("../../../../locales/tr.json");
const en = require("../../../../locales/en.json");

const leaves = (node: Record<string, unknown>, prefix = ""): string[] =>
  Object.entries(node).flatMap(([key, value]) =>
    typeof value === "object" && value !== null ? leaves(value as Record<string, unknown>, `${prefix}${key}.`) : [`${prefix}${key}`]
  );

const lookup = (root: Record<string, unknown>, path: string): unknown => path.split(".").reduce<unknown>((node, key) => (node as Record<string, unknown> | undefined)?.[key], root);

describe("sky.flow metinleri (TR/EN)", () => {
  it("iki dilin anahtarları aynıdır", () => {
    expect(leaves(tr.sky.flow).sort()).toEqual(leaves(en.sky.flow).sort());
  });

  it.each([["tr", tr], ["en", en]])("%s: tüm metinler dolu", (_lang, strings) => {
    const all = leaves(strings.sky.flow);
    expect(all.length).toBeGreaterThan(40);
    for (const path of all) expect(String(lookup(strings.sky.flow, path)).trim().length).toBeGreaterThan(0);
  });

  it.each([["tr", tr], ["en", en]])("%s: koddaki dinamik anahtarlar var", (_lang, strings) => {
    const flow = strings.sky.flow;
    for (const id of ["meet", "relationship", "custom"]) expect(flow.date.option[id]).toBeTruthy();
    for (const reason of ["missing", "future", "outOfRange"]) expect(flow.date.reason[reason]).toBeTruthy();
    for (const key of ["daylight", "gap", "overlap", "deviceTimeZone"]) expect(flow.warnings[key]).toBeTruthy();
    for (const key of ["invalidDate", "invalidTime", "invalidLocation", "outOfRange", "generic"]) expect(flow.errors[key]).toBeTruthy();
    expect(flow.stepOf).toContain("{{current}}");
    expect(flow.stepOf).toContain("{{total}}");
    expect(flow.time.unknownNote).toContain("{{time}}");
  });

  it("flowLogic'in hata anahtarları çeviride karşılığını bulur", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { skyErrorKey } = require("../flowLogic");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { SkyInputError } = require("../../astronomy");
    for (const code of ["INVALID_DATE", "INVALID_TIME", "INVALID_LOCATION", "OUT_OF_RANGE"]) {
      const key = skyErrorKey(new SkyInputError(code, "x"));
      expect(lookup(tr, key)).toBeTruthy();
      expect(lookup(en, key)).toBeTruthy();
    }
  });

  it.each([["tr", tr], ["en", en]])("%s: paywall metni dolu", (_lang, strings) => {
    for (const field of ["name", "description", "cta"]) expect(String(strings.paywall.copy.nightSky[field]).trim().length).toBeGreaterThan(0);
  });
});
