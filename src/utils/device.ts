import { safeStorage } from "@/lib/safeStorage";

function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function getOrCreateDeviceId(): Promise<string> {
  let deviceId = await safeStorage.getItem("device_id");
  if (!deviceId) {
    deviceId = generateUUID();
    await safeStorage.setItem("device_id", deviceId);
  }
  return deviceId;
}
