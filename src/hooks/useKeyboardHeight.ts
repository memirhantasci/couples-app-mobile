import { useEffect, useRef, useState } from "react";
import { Keyboard, LayoutAnimation, Platform, type KeyboardEvent } from "react-native";

/**
 * Klavyenin ekranın altından kapladığı yükseklik (klavye kapalıyken 0).
 *
 * Alt pencere (bottom sheet) ve ortalanmış pencereleri klavyeyle birlikte yukarı kaldırmak için kullanılır:
 * kapsayıcıya `paddingBottom: height` verilir. Değişim klavyenin kendi animasyon süresi ve eğrisiyle
 * (LayoutAnimation) yapılır, yani pencere klavyeyle aynı anda, tek hareketle kalkar; önce aşağı kayıp sonra
 * düzelmez.
 *
 * Yalnızca iOS'ta etkindir. Android'de Modal penceresi klavyeye göre zaten yeniden boyutlanır; burada ayrıca
 * boşluk eklemek pencereyi iki kez kaldırırdı. Bu yüzden Android'de her zaman 0 döner.
 */
export function useKeyboardHeight(enabled: boolean = Platform.OS === "ios"): number {
  const [height, setHeight] = useState(0);
  const heightRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    const apply = (next: number, event: KeyboardEvent) => {
      // iOS alanlar arasında geçişte de "willShow" gönderir; yükseklik değişmediyse animasyon kurulmaz
      // (kurulursa sonraki ilgisiz bir yerleşim değişikliğine uygulanırdı)
      if (Math.abs(next - heightRef.current) < 1) return;
      heightRef.current = next;
      const duration = event.duration > 10 ? event.duration : 10;
      LayoutAnimation.configureNext({
        duration,
        update: {
          duration,
          type: (event.easing && LayoutAnimation.Types[event.easing]) || LayoutAnimation.Types.keyboard,
        },
      });
      setHeight(next);
    };

    const show = Keyboard.addListener("keyboardWillShow", (event) => apply(event.endCoordinates.height, event));
    const change = Keyboard.addListener("keyboardWillChangeFrame", (event) => {
      // Klavye yüksekliği açıkken değişebilir (öneri çubuğu, emoji klavyesi); kapanış "willHide" ile gelir
      if (heightRef.current > 0) apply(event.endCoordinates.height, event);
    });
    const hide = Keyboard.addListener("keyboardWillHide", (event) => apply(0, event));
    return () => {
      show.remove();
      change.remove();
      hide.remove();
      heightRef.current = 0;
    };
  }, [enabled]);

  return enabled ? height : 0;
}

