/**
 * Helper to identify official review and demo accounts (App Store Review & Google Play Review).
 * These accounts must NEVER require new-device OTP or email verification so automated
 * and manual app review testers on different devices are never blocked.
 */
export const DEMO_USER_IDS = [
  "7ddd0c70-cd45-4236-93cd-bd5925a38b54", // demo@couplesky.app
  "b9be438f-7b12-49f5-9237-f3e40f223c70", // partner@couplesky.app
];

export function isDemoOrReviewerAccount(emailOrUserId?: string | null): boolean {
  if (!emailOrUserId) return false;
  const val = emailOrUserId.trim().toLowerCase();
  if (DEMO_USER_IDS.includes(emailOrUserId)) return true;
  return (
    val === "demo@couplesky.app" ||
    val === "partner@couplesky.app" ||
    val.endsWith("@couplesky.app")
  );
}
