import { useRef, useState, type ReactNode, type RefObject } from "react";
import { ActivityIndicator, Modal, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Share2, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { DialogHost } from "@/components/ui/DialogHost";
import { appAlert } from "@/lib/dialog";
import { shareStoryImage } from "@/lib/storyShare";
import { logger } from "@/utils/logger";
import { STORY_ASPECT } from "./StoryCard";
import { GOLD } from "./storyDecor";

// Önizlemenin üstündeki kapat satırı, altındaki paylaş butonu ve aralıkları
const TOP_BAR_HEIGHT = 52;
const SHARE_BUTTON_HEIGHT = 52;
const SHARE_BUTTON_GAP = 18;
const VERTICAL_BREATHING = 32;

interface StorySharePreviewProps {
  visible: boolean;
  onClose: () => void;
  /** Sistem paylaşım menüsünün başlığı. */
  dialogTitle: string;
  /** Paylaşım menüsü yoksa görselle birlikte gönderilen metin. */
  fallbackMessage: string;
  /** Paylaş butonunun etiketi. */
  shareLabel: string;
  /** Verilen genişlikte hikâye kartını çizer; `cardRef` kartın StoryCard'ına verilmelidir. */
  renderCard: (width: number, cardRef: RefObject<View | null>) => ReactNode;
}

/**
 * Bir modalın içinden açılan 9:16 hikâye önizlemesi: kullanıcı paylaşacağı kartı görür, altın butonla
 * Instagram hikâyesine (sistem paylaşım menüsü) gönderir. Paylaşılan görsel tam ekrandaki karttır.
 */
export function StorySharePreview({ visible, ...rest }: StorySharePreviewProps) {
  if (!visible) return null;
  return <PreviewSheet {...rest} />;
}

function PreviewSheet({ onClose, dialogTitle, fallbackMessage, shareLabel, renderCard }: Omit<StorySharePreviewProps, "visible">) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const cardRef = useRef<View>(null);
  const [isSharing, setIsSharing] = useState(false);

  // Kart ekrana sığan en büyük 9:16 boyda çizilir
  const heightBudget =
    windowHeight - insets.top - insets.bottom - TOP_BAR_HEIGHT - SHARE_BUTTON_HEIGHT - SHARE_BUTTON_GAP - VERTICAL_BREATHING;
  const cardWidth = Math.floor(Math.min(windowWidth - 48, heightBudget * STORY_ASPECT));

  const handleShare = async () => {
    try {
      setIsSharing(true);
      await shareStoryImage(cardRef, { dialogTitle, fallbackMessage });
    } catch (error) {
      logger.warn("Story share error:", error);
      appAlert(t("common.error"), t("wrapped.shareError"));
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <Modal visible transparent statusBarTranslucent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.backdrop, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={[styles.topBar, { width: cardWidth }]}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t("a11y.close")}
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.closeBtn}
          >
            <X size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {renderCard(cardWidth, cardRef)}

        <TouchableOpacity
          onPress={handleShare}
          disabled={isSharing}
          activeOpacity={0.85}
          accessibilityRole="button"
          style={[styles.shareBtn, { width: cardWidth }]}
        >
          <LinearGradient colors={[GOLD.light, GOLD.base, GOLD.deep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.shareGradient}>
            {isSharing ? (
              <ActivityIndicator color="#2A1A08" size="small" />
            ) : (
              <>
                <Share2 size={18} color="#2A1A08" />
                <Text style={styles.shareText}>{shareLabel}</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
      {/* Paylaşım hatası bu pencerenin içinde gösterilir (kök diyalog katmanı modalların arkasında kalır) */}
      <DialogHost embedded visible />
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(6, 4, 9, 0.94)",
  },
  topBar: {
    height: TOP_BAR_HEIGHT,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  shareBtn: {
    marginTop: SHARE_BUTTON_GAP,
    height: SHARE_BUTTON_HEIGHT,
    borderRadius: SHARE_BUTTON_HEIGHT / 2,
    overflow: "hidden",
  },
  shareGradient: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  shareText: {
    color: "#2A1A08",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
});
