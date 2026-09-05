import { useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";

export function useDemoAction() {
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
          title: customTitle || "Bu Özelliği Kullanmak İçin Kayıt Olun 💖",
          description:
            customDescription ||
            "Demo modunda verilerinizi kalıcı olarak kaydetmek, aşk mektupları mühürlemek ve partnerinizle eşleşmek için ücretsiz hesabınızı oluşturun.",
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
