import { Dimensions, PixelRatio, Platform, Share, type View } from "react-native";
import type { RefObject } from "react";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";

// Instagram hikâyesi 1080×1920 (9:16) ister; daha küçük ya da kare görseller ortada küçük kalır
const STORY_WIDTH_PX = 1080;
const STORY_HEIGHT_PX = 1920;

interface ShareStoryOptions {
  dialogTitle: string;
  /** Sistem paylaşım menüsü yoksa görselle birlikte gönderilen metin. */
  fallbackMessage: string;
}

/** Karttaki görünümü 1080×1920 PNG olarak çekip sistem paylaşım menüsünü açar (Instagram Hikâye dahil). */
export async function shareStoryImage(
  cardRef: RefObject<View | null>,
  { dialogTitle, fallbackMessage }: ShareStoryOptions
): Promise<void> {
  const card = cardRef.current;
  if (!card) return;

  // view-shot: iOS'ta width/height nokta (cihaz ölçeğiyle çarpılır), Android'de piksel olarak yorumlanır
  const ratio = PixelRatio.get();
  const size =
    Platform.OS === "ios"
      ? { width: STORY_WIDTH_PX / ratio, height: STORY_HEIGHT_PX / ratio }
      : { width: STORY_WIDTH_PX, height: STORY_HEIGHT_PX };

  const uri = await captureRef(card, { format: "png", quality: 1, result: "tmpfile", ...size });
  if (!uri) throw new Error("Story image could not be created");
  const fileUri = uri.startsWith("file://") ? uri : `file://${uri}`;

  if (await Sharing.isAvailableAsync()) {
    const { width, height } = Dimensions.get("window");
    await Sharing.shareAsync(fileUri, {
      mimeType: "image/png",
      dialogTitle,
      UTI: "public.png",
      anchor: { x: width / 2, y: height / 2, width: 1, height: 1 },
    });
  } else {
    await Share.share({ url: fileUri, message: fallbackMessage });
  }
}
