/// <reference types="jest" />
import { projectHorizontal } from "../projection";

describe("izdüşüm yönü", () => {
  const altitude = 45;
  const r = 0.5;

  it("kuzey üstte: az=0 → (0, −r)", () => {
    const { x, y } = projectHorizontal(altitude, 0);
    expect(x).toBeCloseTo(0, 9);
    expect(y).toBeCloseTo(-r, 9);
  });

  it("doğu solda: az=90 → x < 0", () => {
    const { x, y } = projectHorizontal(altitude, 90);
    expect(x).toBeCloseTo(-r, 9);
    expect(y).toBeCloseTo(0, 9);
  });

  it("güney altta: az=180 → y > 0", () => {
    const { x, y } = projectHorizontal(altitude, 180);
    expect(x).toBeCloseTo(0, 9);
    expect(y).toBeCloseTo(r, 9);
  });

  it("batı sağda: az=270 → x > 0", () => {
    const { x, y } = projectHorizontal(altitude, 270);
    expect(x).toBeCloseTo(r, 9);
    expect(y).toBeCloseTo(0, 9);
  });

  it("tepe noktası merkezdedir", () => {
    const { x, y } = projectHorizontal(90, 123);
    expect(x).toBeCloseTo(0, 12);
    expect(y).toBeCloseTo(0, 12);
  });

  it("ufuk r=1 çemberindedir, her yönde", () => {
    for (const az of [0, 33, 90, 200, 359]) {
      const { x, y } = projectHorizontal(0, az);
      expect(Math.hypot(x, y)).toBeCloseTo(1, 12);
    }
  });

  it("ufkun altı r > 1 olur", () => {
    const { x, y } = projectHorizontal(-9, 40);
    expect(Math.hypot(x, y)).toBeCloseTo(1.1, 9);
  });
});
