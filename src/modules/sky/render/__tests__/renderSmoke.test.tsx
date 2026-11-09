/// <reference types="jest" />
import { createRef } from "react";
import { Text, type View } from "react-native";
import { Path } from "react-native-svg";

import { computeSky } from "../../astronomy";
import { NightSkyPrintLayout } from "../NightSkyPrintLayout";
import { NightSkyStoryCard } from "../NightSkyStoryCard";
import { SkyChart } from "../SkyChart";

jest.mock("lucide-react-native", () => ({ Heart: () => null }));
jest.mock("@/lib/textCase", () => ({ caseLocale: () => "tr" }));
jest.mock("@/lib/storageImages", () => ({ useStorageImage: () => null }));
jest.mock("@/components/memories/WashiTape", () => ({ WashiTape: () => null, WASHI_COLORS: {} }));
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: "tr" } }) }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const TestRenderer = require("react-test-renderer");

const sky = computeSky({ latitude: 41.0082, longitude: 28.9784, date: "2025-02-14", time: "22:00" });
const LABELS = { N: "K", E: "D", S: "G", W: "B" };

function render(element: React.ReactElement) {
  let tree: { root: { findAllByType: (type: unknown) => { props: Record<string, any> }[] } };
  TestRenderer.act(() => {
    tree = TestRenderer.create(element);
  });
  return tree!.root;
}

const textsOf = (root: ReturnType<typeof render>) => root.findAllByType(Text).map((node) => String(node.props.children));

describe("render duman testi", () => {
  it("SkyChart gerçek gökyüzüyle çizilir, Path sayısı küçüktür", () => {
    const root = render(<SkyChart sky={sky} size={260} labels={LABELS} />);
    const paths = root.findAllByType(Path).length;
    expect(paths).toBeLessThanOrEqual(20);
    expect(textsOf(root)).toEqual(expect.arrayContaining(["K", "D", "G", "B", "Sirius"]));
  });

  it("highlight altın halka ekler, görünmeyen yıldızda hata vermez", () => {
    const root = render(<SkyChart sky={sky} size={260} labels={LABELS} highlight={{ hip: sky.stars[0].hip, label: "Bizim" }} />);
    expect(textsOf(root)).toContain("Bizim");
    expect(() => render(<SkyChart sky={sky} size={260} labels={LABELS} highlight={{ hip: 999999 }} />)).not.toThrow();
  });

  it("hikâye kartı çizilir; boş isim ve yer satırı yoktur", () => {
    const full = textsOf(render(<NightSkyStoryCard width={300} cardRef={createRef<View>()} sky={sky} dateLine="14 Şubat 2025 · 22:00" placeName="İstanbul" names="Ada & Can" />));
    expect(full).toEqual(expect.arrayContaining(["İstanbul", "Ada & Can", "sky.poster.defaultTitle", "sky.poster.realSkyNote"]));
    const empty = render(<NightSkyStoryCard width={300} cardRef={createRef<View>()} sky={sky} dateLine="x" placeName="" names="   " />);
    expect(textsOf(empty)).not.toContain("   ");
    expect(textsOf(empty)).toHaveLength(full.length - 2);
  });

  it("uzun metinler tek satırda küçülür", () => {
    const longName = "Llanfairpwllgwyngyllgogerychwyrndrobwllllantysiliogogogoch, Galler, Birleşik Krallık";
    const root = render(<NightSkyStoryCard width={300} cardRef={createRef<View>()} sky={sky} dateLine="x" placeName={longName} />);
    const node = root.findAllByType(Text).find((item) => item.props.children === longName)!;
    expect(node.props.numberOfLines).toBe(1);
    expect(node.props.adjustsFontSizeToFit).toBe(true);
    expect(node.props.minimumFontScale).toBeGreaterThan(0);
  });

  it("baskı düzeni çizilir: atıf var, indirme çağrısı yok", () => {
    const texts = textsOf(render(<NightSkyPrintLayout width={360} cardRef={createRef<View>()} sky={sky} dateLine="x" placeName="İstanbul" subtitle="Alt yazı" />));
    expect(texts).toContain("sky.poster.attribution");
    expect(texts).toContain("Alt yazı");
    expect(texts.some((text) => text.includes("App Store"))).toBe(false);
  });
});
