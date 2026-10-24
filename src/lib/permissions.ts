import { Linking } from "react-native";
import { appAlert } from "@/lib/dialog";

/**
 * İzin reddedildiğinde kullanıcıyı çıkmazda bırakmaz: işletim sistemi izni bir kez reddedilince
 * tekrar sormaz, bu yüzden tek yol uygulamanın sistem ayarlarıdır.
 */
export function showPermissionDeniedDialog(title: string, message: string): void {
  appAlert(
    title,
    message,
    [
      { text: "Şimdi Değil", style: "cancel" },
      {
        text: "Ayarları Aç",
        onPress: () => {
          Linking.openSettings().catch(() => {});
        },
      },
    ],
    { forceDialog: true }
  );
}
