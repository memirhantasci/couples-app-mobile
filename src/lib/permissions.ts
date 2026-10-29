import { Linking } from "react-native";
import { appAlert } from "@/lib/dialog";
import i18n from "@/lib/i18n";

/**
 * İzin reddedildiğinde kullanıcıyı çıkmazda bırakmaz: işletim sistemi izni bir kez reddedilince
 * tekrar sormaz, bu yüzden tek yol uygulamanın sistem ayarlarıdır.
 */
export function showPermissionDeniedDialog(title: string, message: string): void {
  appAlert(
    title,
    message,
    [
      { text: i18n.t("permissions.notNow"), style: "cancel" },
      {
        text: i18n.t("permissions.openSettings"),
        onPress: () => {
          Linking.openSettings().catch(() => {});
        },
      },
    ],
    { forceDialog: true }
  );
}
