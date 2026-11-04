/// <reference types="jest" />
// Widget fonksiyonu derlenirken bir METNE dönüşür ve izole bir çalışma zamanında çalışır (bkz. widgets-plugin).
// Bu testler o metni gerçekten çalıştırır: kaynak kodda doğru görünen ama dönüşümde bozulan şeyleri yakalar.
/* eslint-disable @typescript-eslint/no-require-imports */

// Projede Node tipleri (@types/node) yok: yalnızca bu test için gereken kadarı elle tanımlanır
declare const __dirname: string;
const fs = require("fs") as { readFileSync: (file: string, encoding: string) => string };
const path = require("path") as { join: (...parts: string[]) => string };

jest.mock("expo-widgets", () => ({ createWidget: () => ({}) }));
jest.mock("@expo/ui/swift-ui", () => ({}));
jest.mock("@expo/ui/swift-ui/modifiers", () => ({}));

type Tree = unknown;

/** Widget çalışma zamanının sağladığı bileşenler/değiştiriciler yerine geçen kuklalarla widget metnini çalıştırır. */
function renderWidget(props: Record<string, unknown>, env: Record<string, unknown>): string[] {
  const source: string = require("../CoupleWidget").CoupleWidgetView;
  expect(typeof source).toBe("string");

  const element = (type: unknown, elementProps: Record<string, unknown>) => ({ type, props: elementProps });
  // Hem çağrılabilen hem her özelliğe (shapes.capsule gibi) yanıt veren kukla
  const stub: unknown = new Proxy(function () {}, { get: () => stub, apply: () => ({}) });
  const scope = new Proxy(
    {},
    {
      // Yalnızca serbest (tanımsız) isimler kukla olur; String, Date gibi gerçek globaller olduğu gibi kalır
      has: (_target, key) => typeof key === "string" && !(key in globalThis),
      // Symbol.unscopables gibi sembol anahtarları undefined dönmeli; yoksa `with` her ismi engeller
      get: (_target, key) => (typeof key !== "string" ? undefined : key === "_jsx" || key === "_jsxs" ? element : stub),
    }
  );
  const widget = new Function("scope", `with (scope) { return (${source}); }`)(scope) as (
    p: unknown,
    e: unknown
  ) => Tree;

  const texts: string[] = [];
  const collect = (node: unknown): void => {
    if (typeof node === "string") texts.push(node);
    else if (typeof node === "number") texts.push(String(node));
    else if (Array.isArray(node)) node.forEach(collect);
    else if (node && typeof node === "object" && "props" in node) {
      collect((node as { props: { children?: unknown } }).props?.children);
    }
  };
  collect(widget(props, env));
  return texts;
}

const TR_STRINGS = {
  togetherNames: "birlikte ♥ {names}",
  moodTitle: "{name} bugün",
  milestoneToDayOther: "✨ {target}. güne {days} gün",
  milestoneToDayOne: "✨ {target}. güne {days} gün",
  togetherOther: "{days} gündür birlikte",
  thousandsSeparator: ".",
};

// 4 Kasım 2026, öğle: 30 Ekim 2025'ten beri tam 370 gün (ekran görüntüsündeki widget)
const NOW = new Date(2026, 10, 4, 12, 0, 0);
const ENV = (family: string) => ({
  widgetFamily: family,
  widgetRenderingMode: "fullColor",
  colorScheme: "dark",
  date: NOW,
});

const READY = {
  state: "ready",
  myName: "Emirhan",
  partnerName: "Esra",
  startDate: "2025-10-30",
  partnerMoodEmoji: "😍",
  partnerMoodLabel: "Çok Mutlu",
  moodDate: "2026-11-04",
  unreadCount: 0,
  language: "tr",
  strings: TR_STRINGS,
};

const hasPlaceholder = (text: string) => /\{\w+\}/.test(text);

describe("CoupleWidget: yer tutucular dönüşümden sonra da dolar", () => {
  it("büyük widget: isimler, ruh hali başlığı ve dönüm noktası doldurulur", () => {
    const texts = renderWidget(READY, ENV("systemLarge"));

    expect(texts).toContain("370");
    expect(texts).toContain("birlikte ♥ Emirhan & Esra");
    expect(texts).toContain("Esra bugün");
    expect(texts).toContain("✨ 400. güne 30 gün");
    expect(texts.filter(hasPlaceholder)).toEqual([]);
  });

  it("orta widget: isimler ve ruh hali satırı doldurulur", () => {
    const texts = renderWidget(READY, ENV("systemMedium"));

    expect(texts).toContain("birlikte ♥ Emirhan & Esra");
    expect(texts.filter(hasPlaceholder)).toEqual([]);
  });

  it("metinler gelmese bile Türkçe varsayılanlar doldurulur", () => {
    const texts = renderWidget({ ...READY, strings: undefined }, ENV("systemLarge"));

    expect(texts).toContain("birlikte ♥ Emirhan & Esra");
    expect(texts).toContain("Esra bugün");
    expect(texts.filter(hasPlaceholder)).toEqual([]);
  });

  it("binlik ayırıcı uygulanır (1.235 gün, 1.300. güne 65 gün)", () => {
    const start = new Date(2023, 5, 18);
    const today = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate());
    const days = Math.round((today.getTime() - start.getTime()) / 86400000);
    const next100 = (Math.floor(days / 100) + 1) * 100;
    const grouped = (n: number) => n.toLocaleString("de-DE");

    const texts = renderWidget({ ...READY, startDate: "2023-06-18" }, ENV("systemLarge"));

    expect(days).toBeGreaterThan(999);
    expect(texts).toContain(grouped(days));
    expect(texts).toContain(`✨ ${grouped(next100)}. güne ${next100 - days} gün`);
    expect(texts.filter(hasPlaceholder)).toEqual([]);
  });
});

describe("CoupleWidget: kaynak kuralı", () => {
  it("widget dosyasında ters eğik çizgi karakteri yok (şablon dizesine gömülürken bozulur)", () => {
    const file = fs.readFileSync(path.join(__dirname, "..", "CoupleWidget.tsx"), "utf8");
    expect(file.includes(String.fromCharCode(92))).toBe(false);
  });
});
