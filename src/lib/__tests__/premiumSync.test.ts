/// <reference types="jest" />
import { waitForServerPremium } from "../premiumSync";

describe("waitForServerPremium", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("Premium görünür görünmez true döner", async () => {
    const refresh = jest.fn().mockResolvedValue({ isPremium: true });
    await expect(waitForServerPremium(refresh)).resolves.toBe(true);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("webhook gecikirse yeniden dener", async () => {
    const refresh = jest
      .fn()
      .mockResolvedValueOnce({ isPremium: false })
      .mockResolvedValueOnce({ isPremium: false })
      .mockResolvedValue({ isPremium: true });
    const promise = waitForServerPremium(refresh);
    await jest.advanceTimersByTimeAsync(5000);
    await expect(promise).resolves.toBe(true);
    expect(refresh).toHaveBeenCalledTimes(3);
  });

  it("süre dolarsa hata fırlatmadan false döner", async () => {
    const refresh = jest.fn().mockRejectedValue(new Error("ağ"));
    const promise = waitForServerPremium(refresh);
    await jest.advanceTimersByTimeAsync(20000);
    await expect(promise).resolves.toBe(false);
    expect(refresh).toHaveBeenCalledTimes(8);
  });
});
