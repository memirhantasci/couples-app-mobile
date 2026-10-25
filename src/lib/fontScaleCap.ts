import { Platform } from "react-native";

/**
 * Sistem yazı boyutu çok büyük ayarlanmış telefonlarda ekranlar (başlık + buton satırları, kartlar,
 * araç çubukları) taşıyor / alt alta kırılıyordu. Tüm Text ve TextInput'lara bir üst sınır koyar:
 * kullanıcının yazı büyütmesi bu oranın ötesine geçmez (1 = hiç büyümez). Tek tek bileşen
 * kendi maxFontSizeMultiplier'ını verirse o geçerli olur.
 *
 * RN 0.86'da Text ve TextInput düz fonksiyon bileşenleridir (defaultProps çalışmaz). 'react-native'
 * dışa aktarımındaki Text / TextInput, orijinali doğrudan çağıran ince bir sarmalayıcıyla değiştirilir
 * (ek bir React katmanı oluşturmaz; kancalar sarmalayıcının içinde çalışır).
 */
export const MAX_FONT_SIZE_MULTIPLIER = 1.15;

function installFontScaleCap() {
  if (Platform.OS === "web") return;

  // 'import' yerine require: değiştireceğimiz şey modülün gerçek dışa aktarım nesnesi
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const rn = require("react-native");

  for (const name of ["Text", "TextInput"] as const) {
    const Original = rn[name];
    if (typeof Original !== "function") continue; // beklenmeyen biçim: dokunma

    const Capped = (props: any) =>
      Original(
        props?.maxFontSizeMultiplier == null
          ? { ...props, maxFontSizeMultiplier: MAX_FONT_SIZE_MULTIPLIER }
          : props
      );
    // displayName, TextInput.State gibi statikleri koru (klavye kütüphaneleri TextInput.State'i okur)
    Object.assign(Capped, Original);
    Capped.displayName = Original.displayName ?? name;

    try {
      Object.defineProperty(rn, name, { configurable: true, enumerable: true, get: () => Capped });
    } catch {
      // dışa aktarım değiştirilemiyorsa sınır uygulanmaz; uygulama normal çalışır
    }
  }
}

installFontScaleCap();
