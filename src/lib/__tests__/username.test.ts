/// <reference types="jest" />
import { isValidUsername, normalizeUsername } from "../username";

describe("username", () => {
  it("kırpar ve küçük harfe çevirir", () => {
    expect(normalizeUsername("  Ayse_01 ")).toBe("ayse_01");
  });

  it("yalnızca a-z, 0-9 ve _ ile 3-30 karakteri kabul eder", () => {
    expect(isValidUsername("ayse_01")).toBe(true);
    expect(isValidUsername("ab")).toBe(false);
    expect(isValidUsername("a".repeat(31))).toBe(false);
    expect(isValidUsername("ayşe")).toBe(false);
    expect(isValidUsername("Ayse")).toBe(false);
    expect(isValidUsername("a b c")).toBe(false);
  });
});
