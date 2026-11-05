/// <reference types="jest" />
import dayjs from "dayjs";
import { daysTogether, isDayMilestone, nextDayMilestone } from "../milestoneDays";

describe("daysTogether", () => {
  it("başlangıç gününü 0, ertesi günü 1 sayar", () => {
    expect(daysTogether("2026-01-01", dayjs("2026-01-01T15:00:00"))).toBe(0);
    expect(daysTogether("2026-01-01", dayjs("2026-01-02T00:10:00"))).toBe(1);
    expect(daysTogether("2026-01-01", dayjs("2026-04-11T23:59:00"))).toBe(100);
  });

  it("başlangıç yok, geçersiz ya da gelecekteyse null döner", () => {
    expect(daysTogether(null)).toBeNull();
    expect(daysTogether("")).toBeNull();
    expect(daysTogether("tarih-degil")).toBeNull();
    expect(daysTogether("2027-01-01", dayjs("2026-01-01"))).toBeNull();
  });
});

describe("isDayMilestone", () => {
  it("yalnızca 100'ün katı pozitif günleri kabul eder", () => {
    expect(isDayMilestone(100)).toBe(true);
    expect(isDayMilestone(300)).toBe(true);
    expect(isDayMilestone(1000)).toBe(true);
    expect(isDayMilestone(0)).toBe(false);
    expect(isDayMilestone(99)).toBe(false);
    expect(isDayMilestone(150)).toBe(false);
    expect(isDayMilestone(null)).toBe(false);
  });
});

describe("nextDayMilestone", () => {
  it("yeni başlayan ilişkide ilk dönüm noktası 100. gündür", () => {
    const next = nextDayMilestone("2026-01-01", dayjs("2026-01-01T10:00:00"));
    expect(next?.days).toBe(100);
    expect(next?.date.format("YYYY-MM-DD")).toBe("2026-04-11");
  });

  it("dönüm noktası günü bugünse bugünü döndürür", () => {
    const next = nextDayMilestone("2026-01-01", dayjs("2026-04-11T08:00:00"));
    expect(next?.days).toBe(100);
    expect(next?.date.format("YYYY-MM-DD")).toBe("2026-04-11");
  });

  it("dönüm noktasından sonraki gün bir sonrakini döndürür", () => {
    const next = nextDayMilestone("2026-01-01", dayjs("2026-04-12T08:00:00"));
    expect(next?.days).toBe(200);
    expect(next?.date.format("YYYY-MM-DD")).toBe("2026-07-20");
  });

  it("başlangıç yoksa null döner", () => {
    expect(nextDayMilestone(undefined)).toBeNull();
  });
});
