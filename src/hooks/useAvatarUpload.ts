import { useCallback, useState } from "react";
import { Platform } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { useDemoAction } from "@/hooks/useDemoAction";
import { COUPLE_AVATARS_QUERY_KEY } from "@/hooks/useCoupleAvatars";
import {
  AvatarPermissionError,
  isPremiumRejection,
  pickAvatarImage,
  processAvatarImage,
  removeAvatar as removeAvatarRequest,
  uploadAvatar as uploadAvatarRequest,
  type AvatarSource,
} from "@/lib/avatar";
import { showPermissionDeniedDialog } from "@/lib/permissions";
import { toast } from "@/lib/toast";
import { logger } from "@/utils/logger";
import { useTranslation } from "react-i18next";

// iOS, kapanmakta olan bir Modal'ın üstüne picker açamaz: alt menü kapandıktan sonra açılır
const SHEET_DISMISS_DELAY_MS = Platform.OS === "ios" ? 400 : 150;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function useAvatarUpload() {
  const { t } = useTranslation();
  const { session, profile, isDemoMode } = useAuth();
  const queryClient = useQueryClient();
  const { executeOrIntercept, isDemoModalOpen, setIsDemoModalOpen, modalConfig } = useDemoAction();

  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const userId = session?.user?.id ?? null;
  const isPremium = !!profile?.isPremium;

  const refreshAvatars = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: [COUPLE_AVATARS_QUERY_KEY] });
  }, [queryClient]);

  /** Avatar dairesine dokunulunca: demo → kayıt daveti, ücretsiz → paywall, premium → işlem menüsü */
  const openAvatarMenu = useCallback(() => {
    if (executeOrIntercept(
      () => {},
      t("demo.prompts.avatar.title"),
      t("demo.prompts.avatar.description")
    )) {
      return;
    }
    if (!isPremium) {
      setShowPaywall(true);
      return;
    }
    setIsSheetOpen(true);
  }, [executeOrIntercept, isPremium]);

  const uploadAvatar = useCallback(async (source: AvatarSource) => {
    setIsSheetOpen(false);
    // Sert kalkan: menü dışından tetiklense bile izin/picker'a hiç ulaşılmaz
    if (isDemoMode || !userId) return;
    if (!isPremium) {
      setShowPaywall(true);
      return;
    }

    try {
      await wait(SHEET_DISMISS_DELAY_MS);
      const asset = await pickAvatarImage(source);
      if (!asset) return;

      setIsUploading(true);
      const base64 = await processAvatarImage(asset);
      await uploadAvatarRequest({ userId, isPremium, base64 });
      await refreshAvatars();
      toast.success(t("profile.avatar.updated"));
    } catch (error) {
      if (error instanceof AvatarPermissionError) {
        showPermissionDeniedDialog(
          t("permissions.requiredTitle"),
          error.source === "camera"
            ? t("permissions.cameraDenied")
            : t("permissions.galleryDenied")
        );
      } else if (isPremiumRejection(error)) {
        setShowPaywall(true);
      } else {
        logger.error("Avatar upload error:", error);
        toast.error(t("profile.avatar.uploadFailed"));
      }
    } finally {
      setIsUploading(false);
    }
  }, [isDemoMode, userId, isPremium, refreshAvatars]);

  const removeAvatar = useCallback(async () => {
    setIsSheetOpen(false);
    if (isDemoMode || !userId) return;

    setIsUploading(true);
    try {
      await removeAvatarRequest(userId);
      await refreshAvatars();
      toast.success(t("profile.avatar.removed"));
    } catch (error) {
      logger.error("Avatar remove error:", error);
      toast.error(t("profile.avatar.removeFailed"));
    } finally {
      setIsUploading(false);
    }
  }, [isDemoMode, userId, refreshAvatars]);

  return {
    openAvatarMenu,
    uploadAvatar,
    removeAvatar,
    isUploading,
    isSheetOpen,
    closeSheet: () => setIsSheetOpen(false),
    showPaywall,
    closePaywall: () => setShowPaywall(false),
    isDemoModalOpen,
    setIsDemoModalOpen,
    modalConfig,
  };
}
