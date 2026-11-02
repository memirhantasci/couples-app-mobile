/// <reference types="jest" />
import i18n from "@/lib/i18n";
import { formatMessagingStyleNotification } from "../notifications";
import { GENTLE_CARE_FEELINGS, gentleCarePaywallRoute, isGentleCareFeeling } from "../gentleCare";

jest.mock("@/lib/supabase", () => ({ supabase: { rpc: jest.fn(), from: jest.fn() } }));
jest.mock("expo-notifications", () => ({ setNotificationHandler: jest.fn() }));
jest.mock("@react-native-async-storage/async-storage", () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

// Premium olmayan partnere döngü sezdirilmez: kilitli bildirimde bu sözcüklerin hiçbiri geçemez
const CYCLE_WORDS = /döngü|regl|periyot|hassas|period|cycle/i;
const SENDER = "Ayşe";

describe("gentle care bildirimi", () => {
  for (const language of ["tr", "en"] as const) {
    describe(language, () => {
      beforeAll(() => i18n.changeLanguage(language));

      it.each(GENTLE_CARE_FEELINGS)("kilitli bildirim ne döngüyü ne hissi ne de adı ele verir (%s)", (feeling) => {
        const payload = formatMessagingStyleNotification(SENDER, "", "", { type: "gentle_care", locked: true, feeling });
        const visible = `${payload.title} ${payload.subtitle ?? ""} ${payload.body}`;

        expect(visible).not.toMatch(CYCLE_WORDS);
        expect(visible).not.toContain(SENDER);
        expect(payload.title).toBe(i18n.t("notifications.push.gentleCare.lockedTitle"));
        expect(payload.body).toBe(i18n.t("notifications.push.gentleCare.lockedBody"));
      });

      it.each(GENTLE_CARE_FEELINGS)("Premium partnere hissi açıkça söyler, döngüden yine söz etmez (%s)", (feeling) => {
        const payload = formatMessagingStyleNotification(SENDER, "", "", { type: "gentle_care", locked: false, feeling });

        expect(payload.title).toContain(SENDER);
        expect(payload.body).toBe(i18n.t(`notifications.push.gentleCare.feelings.${feeling}`));
        expect(`${payload.title} ${payload.body}`).not.toMatch(CYCLE_WORDS);
      });

      it("kilitli bildirimden açılan paywall metinleri döngüden söz etmez", () => {
        for (const key of ["paywall.feeling.subtitle", "paywall.feeling.revealTitle", "paywall.features.feelings"] as const) {
          expect(i18n.t(key)).not.toMatch(CYCLE_WORDS);
        }
      });
    });
  }

  it("paywall rotası yalnızca bağlamı ve his anahtarını taşır", () => {
    expect(gentleCarePaywallRoute("emotional")).toBe("/paywall?context=feeling&feeling=emotional");
  });

  it("yalnızca tanımlı hisleri kabul eder", () => {
    expect(isGentleCareFeeling("resting")).toBe(true);
    expect(isGentleCareFeeling("period")).toBe(false);
    expect(isGentleCareFeeling(undefined)).toBe(false);
  });
});
