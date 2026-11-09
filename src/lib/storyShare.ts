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

interface CapturePixels {
  widthPx: number;
  heightPx: number;
}

/** Görünümü verilen piksel boyunda PNG olarak yakalar, `file://` adresi döner. Yakalanamazsa hata atar. */
export async function captureImage(cardRef: RefObject<View | null>, { widthPx, heightPx }: CapturePixels): Promise<string> {
  const card = cardRef.current;
  if (!card) throw new Error("Capture target is not mounted");

  // view-shot: iOS'ta width/height nokta (cihaz ölçeğiyle çarpılır), Android'de piksel olarak yorumlanır
  const ratio = PixelRatio.get();
  const size = Platform.OS === "ios" ? { width: widthPx / ratio, height: heightPx / ratio } : { width: widthPx, height: heightPx };

  const uri = await captureRef(card, { format: "png", quality: 1, result: "tmpfile", ...size });
  if (!uri) throw new Error("Story image could not be created");
  return uri.startsWith("file://") ? uri : `file://${uri}`;
}

/** Yakalanmış PNG'yi sistem paylaşım menüsüyle açar. */
export async function shareCapturedImage(fileUri: string, { dialogTitle, fallbackMessage }: ShareStoryOptions): Promise<void> {
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

/**
 * Karttaki görünümü 1080×1920 PNG olarak çekip sistem paylaşım menüsünü açar (Instagram Hikâye dahil).
 * StoryCard kartı zaten tam bu piksel boyunda çizer (ekranda yalnızca küçültülür); yakalama 1:1 olur, büyütme yapılmaz.
 */
export async function shareStoryImage(cardRef: RefObject<View | null>, options: ShareStoryOptions): Promise<void> {
  if (!cardRef.current) return;
  const fileUri = await captureImage(cardRef, { widthPx: STORY_WIDTH_PX, heightPx: STORY_HEIGHT_PX });
  await shareCapturedImage(fileUri, options);
}
