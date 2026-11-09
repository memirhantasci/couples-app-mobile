/* global describe, it, expect */
const B = require("../skyDataBuilder");

describe("skyDataBuilder", () => {
  it("tırnaklı CSV alanını ayrıştırır", () => {
    expect(B.parseCsvLine('1,"a,b","he said ""hi""",')).toEqual(["1", "a,b", 'he said "hi"', ""]);
  });

  it("saati dereceye çevirir ve aralık dışını reddeder", () => {
    expect(B.hoursToDegrees("6")).toBe(90);
    expect(B.hoursToDegrees("0")).toBe(0);
    expect(B.hoursToDegrees("24")).toBeNull();
    expect(B.hoursToDegrees("")).toBeNull();
    expect(B.hoursToDegrees("abc")).toBeNull();
  });

  it("yıldız adını doğrular", () => {
    expect(B.cleanStarName("Alpha Centauri")).toBe("Alpha Centauri");
    expect(B.cleanStarName("Kaus Australis")).toBe("Kaus Australis");
    expect(B.cleanStarName("Thuban’s-Star")).toBe("Thuban's-Star");
    expect(B.cleanStarName("Şaula")).toBe("Şaula");
    expect(B.cleanStarName("Ignore'; DROP TABLE x;--")).toBeNull();
    expect(B.cleanStarName("<b>x</b>")).toBeNull();
    expect(B.cleanStarName("Star 2")).toBeNull();
    expect(B.cleanStarName("")).toBeNull();
  });

  it("geçersiz HIP'leri reddeder", () => {
    expect(B.parseHip("32349")).toBe(32349);
    expect(B.parseHip(11767)).toBe(11767);
    for (const bad of ["0", "-5", "1.5", "abc", "", "1e3", 0, -1, 2.5, null, undefined, NaN]) {
      expect(B.parseHip(bad)).toBeNull();
    }
  });

  it("takımyıldızı çizgilerini ardışık çiftlere böler, kötü veriyi eler ve sayar", () => {
    const { constellations, report } = B.parseConstellations({
      constellations: [
        {
          iau: "Tst",
          common_name: { english: "Test" },
          lines: [[1, 2, 3], ["thin", 3, 3, 4], [2, 1], [5, -1, 6], [7, "x", 8]],
        },
        { iau: "toolong", lines: [] },
      ],
    });
    expect(constellations).toHaveLength(1);
    expect(constellations[0].name).toBe("Test");
    expect(constellations[0].segments).toEqual([[1, 2], [2, 3], [3, 4], [5, 6], [7, 8]]);
    expect(report.styleMarkers).toBe(1);
    expect(report.selfEdges).toBe(1);
    expect(report.duplicateEdges).toBe(1);
    expect(report.badHip).toHaveLength(2);
    expect(report.badConstellations).toEqual(["toolong"]);
  });

  it("seçim: sönük çizgi ucunu ekler, eksik uçlu kenarı çıkarır, Güneş ve HIP'sizi atlar", () => {
    const csv = [
      "id,hip,proper,ra,dec,mag,ci,comp",
      "0,,Sol,0.0,0.0,-26.7,0.656,1",
      "1,10,Aaa,6,10,1.0,0.5,1",
      "2,11,,12,-20,9.0,,1",
      "3,12,,18,30,9.5,0.1,1",
      "4,,,1,1,2,0.1,1",
    ].join("\n");
    const { rows } = B.parseHyg(csv);
    expect(rows.map((r) => r.hip)).toEqual([10, 11, 12]);
    expect(rows[0].ra).toBe(90);
    const cons = [{ iau: "Tst", name: "Test", segments: [[10, 11], [11, 999]] }];
    const out = B.selectData(B.dedupeByHip(rows), cons);
    expect(out.stars.map((s) => s[0])).toEqual([10, 11]); // 12 sönük ve çizgide değil
    expect(out.stars[1][4]).toBeNull();
    expect(out.stats.missingLineHips).toEqual([999]);
    expect(out.stats.droppedEdges).toBe(1);
    expect(out.constellations[0].segments).toEqual([[10, 11]]);
    expect(out.names).toEqual({ 10: "Aaa" });
  });
});
