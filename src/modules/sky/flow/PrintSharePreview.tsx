import { useRef, useState, type ComponentProps } from "react";
import { ActivityIndicator, Modal, PixelRatio, Platform, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Share2, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import Constants from "expo-constants";
import { File } from "expo-file-system";
import { GOLD } from "@/components/share/storyDecor";
import { safeStorage } from "@/lib/safeStorage";
import { captureImage, shareCapturedImage } from "@/lib/storyShare";
import { logger } from "@/utils/logger";
import { NightSkyPrintLayout } from "../render";
import { isPlausibleCapture, printSizesFor, PRINT_SIZES, PrintLayoutTimeoutError, runPrintExport, waitForLayout, type PrintSize } from "./printExport";

const TRAIL_KEY = "@night_sky_print_attempt";
const LAYOUT_TIMEOUT_MS = 1500;
const CHROME_HEIGHT = 190;
const PREVIEW_SIZE = PRINT_SIZES[PRINT_SIZES.length - 1];

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

type LayoutProps = Omit<ComponentProps<typeof NightSkyPrintLayout>, "width" | "cardRef">;

interface PrintSharePreviewProps {
  visible: boolean;
  onClose: () => void;
  layout: LayoutProps;
}

export function PrintSharePreview({ visible, ...rest }: PrintSharePreviewProps) {
  if (!visible) return null;
  return <PreviewSheet {...rest} />;
}

/**
 * 3:4 baskı dosyası. view-shot Android'de görünümün kendi boyunda bitmap alır ve width/height ile yalnızca
 * ölçekler; bu yüzden düzen gerçekten hedef piksel boyunda kurulur, ekranda sarmalayıcı küçültür (StoryCard'la aynı).
 * Önizleme en küçük boyutta durur; büyük boyut yalnızca paylaşırken ve kısa süreliğine belleğe girer.
 */
function PreviewSheet({ onClose, layout }: Omit<PrintSharePreviewProps, "visible">) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const cardRef = useRef<View>(null);
  const [renderSize, setRenderSize] = useState<PrintSize>(PREVIEW_SIZE);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const layoutDone = useRef<(() => void) | null>(null);
  const renderedWidth = useRef(PREVIEW_SIZE.width);
  // Bu ekranda geçici nedenle (zaman aşımı, boş çıktı) başarısız sayılan genişlikler; ekran kapanınca unutulur
  const sessionFailed = useRef(new Set<number>());

  const ratio = PixelRatio.get();
  const displayWidth = Math.floor(Math.min(windowWidth - 48, ((windowHeight - insets.top - insets.bottom - CHROME_HEIGHT) * 3) / 4));
  const renderWidth = renderSize.width / ratio;
  const renderHeight = renderSize.height / ratio;

  /** Düzen istenen boya gelene kadar bekler; onLayout süresinde gelmezse deneme başarısızdır, yarım düzen yakalanmaz. */
  const renderAt = async (size: PrintSize) => {
    if (renderedWidth.current !== size.width) {
      const laidOut = await waitForLayout((onLaidOut) => {
        layoutDone.current = onLaidOut;
        renderedWidth.current = size.width;
        setRenderSize(size);
      }, LAYOUT_TIMEOUT_MS);
      if (!laidOut) {
        layoutDone.current = null;
        throw new PrintLayoutTimeoutError();
      }
    }
    await nextFrame();
    await nextFrame();
  };

  /** Yakalama bittikten sonra önizlemeye dönüş: başarılı sonucu bu adımın zaman aşımı boşa çıkarmamalı. */
  const restorePreview = async () => {
    try {
      await renderAt(PREVIEW_SIZE);
    } catch {
      // önizleme büyük boyutta kalsa da akış sürer
    }
  };

  const handleShare = async () => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      // Kalıcı iz yalnızca süreç ölümünü kaydeder; zaman aşımı ve boş çıktı bu ekranın bellekteki kümesine girer
      const { result, timedOut } = await runPrintExport({
        readTrail: () => safeStorage.getItem(TRAIL_KEY),
        writeTrail: (raw) => safeStorage.setItem(TRAIL_KEY, raw),
        context: { now: Date.now(), version: Constants.expoConfig?.version ?? "unknown" },
        sizes: printSizesFor(Platform.OS),
        sessionFailed: sessionFailed.current,
        capture: async (size) => {
          await renderAt(size);
          return captureImage(cardRef, { widthPx: size.width, heightPx: size.height });
        },
        validate: (uri, size) => isPlausibleCapture(new File(uri).size, size),
        onFailure: (size) => logger.warn(`Print export failed at ${size.width}x${size.height}`),
      });
      await restorePreview();
      if (!result) {
        setMessage(t(timedOut ? "sky.flow.print.layoutTimeout" : "sky.flow.print.failed"));
        return;
      }
      setMessage(t("sky.flow.print.result", { width: result.size.width, height: result.size.height }));
      await shareCapturedImage(result.uri, {
        dialogTitle: t("sky.flow.share.dialogTitle"),
        fallbackMessage: `${layout.title ?? t("sky.poster.defaultTitle")} · ${t("common.madeWith")}`,
      });
    } catch {
      setMessage(t("sky.flow.print.shareFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={busy ? undefined : onClose}>
      <View style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("sky.flow.close")} disabled={busy} onPress={onClose} hitSlop={10} style={styles.close}>
          <X size={24} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={{ width: displayWidth, height: (displayWidth * 4) / 3, overflow: "hidden", borderRadius: 6 }}>
          <View
            collapsable={false}
            onLayout={() => {
              layoutDone.current?.();
              layoutDone.current = null;
            }}
            style={{ width: renderWidth, height: renderHeight, transformOrigin: "left top", transform: [{ scale: displayWidth / renderWidth }] }}
          >
            <NightSkyPrintLayout width={renderWidth} cardRef={cardRef} {...layout} />
          </View>
        </View>

        <Text style={styles.message} numberOfLines={2}>
          {message ?? t("sky.flow.print.hint")}
        </Text>
        <TouchableOpacity activeOpacity={0.85} disabled={busy} onPress={handleShare} accessibilityRole="button" style={[styles.share, busy && { opacity: 0.6 }]}>
          {busy ? <ActivityIndicator color="#1A1208" /> : <Share2 size={18} color="#1A1208" />}
          <Text style={styles.shareText}>{busy ? t("sky.flow.print.preparing") : t("sky.flow.preview.print")}</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", backgroundColor: "rgba(0,0,0,0.92)" },
  close: { alignSelf: "flex-end", marginRight: 16, marginBottom: 8, width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  message: { marginTop: 12, minHeight: 34, paddingHorizontal: 28, color: "rgba(255,255,255,0.75)", fontSize: 13, lineHeight: 17, fontFamily: "Inter_500Medium", textAlign: "center" },
  share: { marginTop: 8, flexDirection: "row", gap: 10, alignItems: "center", justifyContent: "center", paddingVertical: 15, paddingHorizontal: 28, borderRadius: 18, backgroundColor: GOLD.base },
  shareText: { color: "#1A1208", fontSize: 15.5, fontFamily: "Inter_700Bold" },
});
