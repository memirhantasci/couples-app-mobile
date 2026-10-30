/// <reference types="jest" />
import { applyOtpInput } from "../otp";

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
