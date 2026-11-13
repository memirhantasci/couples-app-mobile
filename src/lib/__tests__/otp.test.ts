/// <reference types="jest" />
import { applyOtpInput, remainingCooldownSeconds } from "../otp";

const empty = ["", "", "", "", "", ""];

describe("applyOtpInput", () => {
  it("tek rakam yazınca sonraki kutuya geçer", () => {
    const result = applyOtpInput(empty, 0, "4", 6);
    expect(result.digits[0]).toBe("4");
    expect(result.focusIndex).toBe(1);
    expect(result.complete).toBe(false);
  });

  it("6 haneli kodu yapıştırınca baştan dağıtır ve tamamlanır", () => {
    const result = applyOtpInput(empty, 3, "123456", 6);
    expect(result.digits.join("")).toBe("123456");
    expect(result.complete).toBe(true);
    expect(result.focusIndex).toBe(5);
  });

  it("rakam olmayan karakterleri yok sayar", () => {
    const result = applyOtpInput(empty, 0, "a", 6);
    expect(result.digits[0]).toBe("");
    expect(result.focusIndex).toBe(0);
  });
});

describe("remainingCooldownSeconds", () => {
  const start = 1_000_000;

  it("bitiş anına kalan saniyeyi yukarı yuvarlar", () => {
    expect(remainingCooldownSeconds(start + 60_000, start)).toBe(60);
    expect(remainingCooldownSeconds(start + 60_000, start + 1)).toBe(60);
    expect(remainingCooldownSeconds(start + 60_000, start + 59_001)).toBe(1);
  });

  it("arka planda geçen süre sayılır: 45 sn sonra dönünce 15 kalır, 2 dk sonra 0", () => {
    expect(remainingCooldownSeconds(start + 60_000, start + 45_000)).toBe(15);
    expect(remainingCooldownSeconds(start + 60_000, start + 120_000)).toBe(0);
  });

  it("sayaç başlamadıysa ya da değer bozuksa 0", () => {
    expect(remainingCooldownSeconds(0, start)).toBe(0);
    expect(remainingCooldownSeconds(start + 60_000, start + 60_000)).toBe(0);
    expect(remainingCooldownSeconds(Number.NaN, start)).toBe(0);
  });
});
