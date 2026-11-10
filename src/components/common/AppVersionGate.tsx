import type { ReactNode } from "react";
import * as Application from "expo-application";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/context/AuthContext";
import { useAppVersionGate } from "@/hooks/useAppVersionGate";
import { pickGateMessage } from "@/lib/appVersionGate";
import { ForceUpdateScreen } from "./ForceUpdateScreen";

/**
 * Zorunlu güncelleme kapısı. Açıkken çocukları olduğu gibi çizer; kapalıyken uygulamanın yerine (navigator,
 * ekranlar, modallar ve onların sorguları hiç kurulmaz) güncelleme ekranını çizer. Açılış perdesi bu kapının
 * dışında kalır ki kapı kapanıp açılınca yeniden oynamasın.
 * Kurallar ve "kapı hangi durumda kapanır": src/lib/appVersionGate.ts, docs/ZORUNLU_GUNCELLEME.md.
 */
export function AppVersionGate({ children }: { children: ReactNode }) {
  const { isDemoMode } = useAuth();
  const { i18n } = useTranslation();
  const decision = useAppVersionGate(isDemoMode);

  if (!decision.locked) return <>{children}</>;

  return (
    <ForceUpdateScreen
      storeUrl={decision.storeUrl}
      serverMessage={pickGateMessage(decision, i18n.language)}
      installedVersion={Application.nativeApplicationVersion}
    />
  );
}
