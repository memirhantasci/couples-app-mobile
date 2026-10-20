import React from "react";
import { TouchableOpacity, View, StyleSheet } from "react-native";
import { Camera, Crown } from "lucide-react-native";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { useAvatarUpload } from "@/hooks/useAvatarUpload";
import { useCoupleAvatars } from "@/hooks/useCoupleAvatars";
import { UserAvatar } from "./UserAvatar";
import { AvatarActionSheet } from "./AvatarActionSheet";
import { PremiumPaywall } from "@/components/ui/PremiumPaywall";
import { DemoActionModal } from "@/components/demo/DemoActionModal";

interface EditableAvatarProps {
  name?: string | null;
  size?: number;
}

/**
 * Kullanıcının kendi avatarı — dokununca demo daveti / Premium paywall / fotoğraf menüsü açar.
 * Menü ve Ayarlar ekranındaki profil kartlarında kullanılır.
 */
export function EditableAvatar({ name, size = 50 }: EditableAvatarProps) {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const { myAvatarUrl, hasStoredAvatar } = useCoupleAvatars();
  const avatar = useAvatarUpload();
  const isPremium = !!profile?.isPremium;
  const badgeSize = Math.max(18, Math.round(size * 0.4));

  return (
    <>
      <TouchableOpacity
        onPress={avatar.openAvatarMenu}
        disabled={avatar.isUploading}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Profil fotoğrafını değiştir"
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        <UserAvatar
          uri={myAvatarUrl}
          name={name}
          size={size}
          loading={avatar.isUploading}
          badge={
            <View
              style={[
                styles.badge,
                {
                  width: badgeSize,
                  height: badgeSize,
                  borderRadius: badgeSize / 2,
                  backgroundColor: isPremium ? theme.accent : "#D4A017",
                  borderColor: theme.cardBg,
                },
              ]}
            >
              {isPremium ? (
                <Camera size={Math.round(badgeSize * 0.55)} color="#FFFFFF" />
              ) : (
                <Crown size={Math.round(badgeSize * 0.55)} color="#FFFFFF" />
              )}
            </View>
          }
        />
      </TouchableOpacity>

      {avatar.isSheetOpen && (
        <AvatarActionSheet
          visible={avatar.isSheetOpen}
          onClose={avatar.closeSheet}
          onPick={avatar.uploadAvatar}
          onRemove={avatar.removeAvatar}
          canRemove={hasStoredAvatar}
        />
      )}

      {avatar.showPaywall && (
        <PremiumPaywall
          visible={avatar.showPaywall}
          onClose={avatar.closePaywall}
          featureSource="avatar"
          gender={profile?.gender}
        />
      )}

      {avatar.isDemoModalOpen && (
        <DemoActionModal
          visible={avatar.isDemoModalOpen}
          onClose={() => avatar.setIsDemoModalOpen(false)}
          title={avatar.modalConfig.title}
          description={avatar.modalConfig.description}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
});
