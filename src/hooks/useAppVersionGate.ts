import { useEffect, useEffectEvent, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import * as Application from "expo-application";
import { supabase } from "@/lib/supabase";
import { safeStorage } from "@/lib/safeStorage";
import {
  GATE_CACHE_KEY,
  asGatePlatform,
  decideGate,
  fetchRequirement,
  readGateCache,
  resolveRequirement,
  serializeGateCache,
  shouldCheck,
  type GateDecision,
  type RequirementRpc,
  type VersionRequirement,
} from "@/lib/appVersionGate";

/** supabase-js'in sorgu kurucusu bir thenable'dır; karar modülü yalnızca `{ data, error }` bekler. */
const rpc: RequirementRpc = (fn, args) => supabase.rpc(fn, args);

/**
 * Zorunlu güncelleme kapısı: açılışta ve uygulama öne geldiğinde (en sık GATE_CHECK_INTERVAL_MS, kapalıyken
 * GATE_LOCKED_CHECK_INTERVAL_MS) sunucudaki asgari sürümü sorar. Son başarılı yanıt saklanır; sorgu başarısızsa
 * saklanan (geçerli ve 30 günden yeni) yanıt kullanılır, o da yoksa kapı açıktır.
 * Karar mantığı src/lib/appVersionGate.ts'tedir; bu kanca yalnızca zamanlama ve depolamayı yapar.
 */
export function useAppVersionGate(isDemoMode: boolean): GateDecision {
  const platform = asGatePlatform(Platform.OS);
  /** Saklanan son yanıt; undefined = yok / henüz okunmadı / kullanılamaz */
  const [cached, setCached] = useState<{ requirement: VersionRequirement | null } | undefined>(undefined);
  /** Bu oturumdaki son başarılı sunucu yanıtı; undefined = henüz yok */
  const [latest, setLatest] = useState<VersionRequirement | null | undefined>(undefined);

  const decision = decideGate({
    platform: Platform.OS,
    isDemoMode,
    deviceVersion: Application.nativeApplicationVersion,
    deviceBuild: Application.nativeBuildVersion,
    requirement: resolveRequirement(latest, cached),
  });

  const lastAttemptRef = useRef<number | null>(null);
  const inFlightRef = useRef(false);

  const check = useEffectEvent(async () => {
    if (!platform || inFlightRef.current) return;
    const now = Date.now();
    if (!shouldCheck(lastAttemptRef.current, now, decision.locked)) return;
    lastAttemptRef.current = now;
    inFlightRef.current = true;
    try {
      const outcome = await fetchRequirement(rpc, platform);
      if (outcome.kind !== "ok") return; // hata: önbellek / açık kapı geçerli kalır
      setLatest(outcome.requirement);
      await safeStorage.setItem(GATE_CACHE_KEY, serializeGateCache(platform, outcome.requirement, Date.now()));
    } catch {
      // fetchRequirement fırlatmaz; depolama hatası kapıyı etkilemez
    } finally {
      inFlightRef.current = false;
    }
  });

  useEffect(() => {
    if (!platform) return;
    let alive = true;
    safeStorage
      .getItem(GATE_CACHE_KEY)
      .then((raw) => {
        if (!alive) return;
        const record = readGateCache(raw, platform, Date.now());
        setCached(record);
        // Bozuk / eski kayıt bir dahaki açılışta yeniden okunmasın
        if (!record && raw) safeStorage.removeItem(GATE_CACHE_KEY).catch(() => {});
      })
      .catch(() => {})
      // İlk soru önbellek okunduktan sonra (birkaç ms): sunucu yanıtı her zaman önbellekten yeni sayılır
      .finally(() => {
        if (alive) check();
      });
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") check();
    });
    return () => {
      alive = false;
      subscription.remove();
    };
  }, [platform]);

  return decision;
}
