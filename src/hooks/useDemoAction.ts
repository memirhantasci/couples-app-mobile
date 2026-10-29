import { useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useTranslation } from "react-i18next";

export function useDemoAction() {
  const { t } = useTranslation();
  const { isDemoMode } = useAuth();
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState<{
    title?: string;
    description?: string;
  }>({});

  const executeOrIntercept = useCallback(
    (
      action: () => void,
      customTitle?: string,
      customDescription?: string
    ): boolean => {
      if (isDemoMode) {
        setModalConfig({
          title: customTitle || t("demo.prompts.generic.title"),
          description:
            customDescription ||
            t("demo.prompts.generic.description"),
        });
        setIsDemoModalOpen(true);
        return true; // Intercepted by demo mode
      }
      action();
      return false;
    },
    [isDemoMode]
  );

  return {
    isDemoMode,
    executeOrIntercept,
    isDemoModalOpen,
    setIsDemoModalOpen,
    modalConfig,
  };
}
