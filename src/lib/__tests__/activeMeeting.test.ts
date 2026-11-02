/// <reference types="jest" />
jest.mock("@react-native-async-storage/async-storage", () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

import {
  pickActiveMeeting,
  nextMeetingBoundary,
  isMeetingCelebrationSeen,
  markMeetingCelebrationSeen,
  MEETING_CELEBRATION_HOURS,
  CELEBRATION_MS,
  type MeetingLike,
} from "@/lib/activeMeeting";
/// <reference types="jest" />
jest.mock("@react-native-async-storage/async-storage", () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

import { safeStorage } from "@/lib/safeStorage";

describe("activeMeeting: pickActiveMeeting & celebration seen storage", () => {
  beforeEach(async () => {
    await safeStorage.clear();
  });

  const now = new Date("2026-11-03T15:00:00.000Z").getTime();

  it("gelecekte planlı bir buluşma varsa, geçmiş buluşmaya bakılmaksızın gelecekteki buluşmayı döner", () => {
    const pastMeeting: MeetingLike = {
      id: 101,
      meeting_datetime: new Date(now - 2 * 60 * 60 * 1000).toISOString(), // 2 saat önce
    };
    const futureMeeting: MeetingLike = {
      id: 102,
      meeting_datetime: new Date(now + 24 * 60 * 60 * 1000).toISOString(), // 1 gün sonra
    };

    const active = pickActiveMeeting([pastMeeting, futureMeeting], now);
    expect(active).not.toBeNull();
    expect(active?.id).toBe(102);
  });

  it("birden fazla gelecek buluşma varsa, tarihi en yakın olanı seçer", () => {
    const m1: MeetingLike = {
      id: 1,
      meeting_datetime: new Date(now + 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 gün sonra
    };
    const m2: MeetingLike = {
      id: 2,
      meeting_datetime: new Date(now + 3 * 60 * 60 * 1000).toISOString(), // 3 saat sonra
    };

    const active = pickActiveMeeting([m1, m2], now);
    expect(active?.id).toBe(2);
  });

  it("gelecekte buluşma yoksa, son 24 saat içinde gerçekleşmiş ve görülmemiş geçmiş buluşmayı döner", () => {
    const pastMeeting: MeetingLike = {
      id: 201,
      meeting_datetime: new Date(now - 3 * 60 * 60 * 1000).toISOString(), // 3 saat önce
    };

    const active = pickActiveMeeting([pastMeeting], now, new Set());
    expect(active).not.toBeNull();
    expect(active?.id).toBe(201);
  });

  it("kullanıcı kutlamayı gördüyse (seenMeetingIds içinde varsa), kart gösterilmez (null)", () => {
    const pastMeeting: MeetingLike = {
      id: 201,
      meeting_datetime: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
    };

    const seenIds = new Set([201]);
    const active = pickActiveMeeting([pastMeeting], now, seenIds);
    expect(active).toBeNull();
  });

  it("geçmiş buluşmanın üzerinden 24 saatten fazla geçtiyse kart gösterilmez (null)", () => {
    const oldMeeting: MeetingLike = {
      id: 301,
      meeting_datetime: new Date(now - (MEETING_CELEBRATION_HOURS + 1) * 60 * 60 * 1000).toISOString(), // 25 saat önce
    };

    const active = pickActiveMeeting([oldMeeting], now, new Set());
    expect(active).toBeNull();
  });

  it("KRİTİK UX: Gerçekleşmiş ve henüz görülmemiş buluşma varken yeni bir buluşma planlanırsa, en yeni planlanan buluşma öne geçer", () => {
    const pastMeeting: MeetingLike = {
      id: 401,
      meeting_datetime: new Date(now - 4 * 60 * 60 * 1000).toISOString(), // 4 saat önce tamamlandı
    };

    // İlk durumda: Henüz yeni buluşma yok, kutlama kartı bekliyor
    const initialActive = pickActiveMeeting([pastMeeting], now, new Set());
    expect(initialActive?.id).toBe(401);

    // Kullanıcı veya partneri yeni bir buluşma planladı:
    const newlyPlannedMeeting: MeetingLike = {
      id: 402,
      meeting_datetime: new Date(now + 48 * 60 * 60 * 1000).toISOString(), // 2 gün sonraya yeni buluşma
    };

    // İkinci durumda: Yeni buluşma hemen öne geçer, geçmiş kutlama geri sayımı engellemez
    const updatedActive = pickActiveMeeting([pastMeeting, newlyPlannedMeeting], now, new Set());
    expect(updatedActive?.id).toBe(402);
  });

  it("AsyncStorage hafızası: isMeetingCelebrationSeen ve markMeetingCelebrationSeen doğru çalışır", async () => {
    const meetingId = 999;

    expect(await isMeetingCelebrationSeen(meetingId)).toBe(false);

    await markMeetingCelebrationSeen(meetingId);

    expect(await isMeetingCelebrationSeen(meetingId)).toBe(true);
    expect(await isMeetingCelebrationSeen(888)).toBe(false); // Başka buluşmayı etkilemez
  });

  it("nextMeetingBoundary bir sonraki buluşma anını ve 24 saatlik kutlama bitiş anını doğru hesaplar", () => {
    const futureTime = now + 5000;
    const m: MeetingLike = {
      id: 50,
      meeting_datetime: new Date(futureTime).toISOString(),
    };

    const boundary = nextMeetingBoundary([m], now);
    expect(boundary).toBe(futureTime);

    // Buluşma anı geçtikten sonra sınır 24 saatlik kutlama bitiş anı olmalıdır
    const afterStart = futureTime + 1000;
    const endBoundary = nextMeetingBoundary([m], afterStart);
    expect(endBoundary).toBe(futureTime + CELEBRATION_MS);
  });
});

