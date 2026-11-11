import React, { useEffect, useRef, useCallback } from "react";
import {
  Keyboard,
  Platform,
  ScrollView,
  TextInput,
  type KeyboardEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewProps,
} from "react-native";
import { KeyboardAwareScrollView as RNKeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

export interface KeyboardAwareScrollViewProps extends ScrollViewProps {
  enableOnAndroid?: boolean;
  extraScrollHeight?: number;
  extraHeight?: number;
  enableAutomaticScroll?: boolean;
  keyboardOpeningTime?: number;
  innerRef?: (ref: ScrollView | null) => void;
}

/**
 * iOS'ta Fabric / Yeni Mimari ile tam uyumlu, zıplama yapmayan akıllı ScrollView.
 *
 * Neden özel bileşen?
 * - `react-native-keyboard-aware-scroll-view` (2021) iOS'ta 250ms gecikmeyle kaydırma yapar ve
 *   iOS'un kendi yerel kaydırmasıyla çakışarak ekranın "aşağı inip geri yukarı zıplamasına" yol açar.
 * - Yerel `automaticallyAdjustKeyboardInsets` ise çok satırlı (multiline) TextInput'larda yalnız imleç
 *   satırını korur; metin kutusunun alt kısmını ve altındaki kaydet butonlarını klavyenin arkasında bırakır.
 *
 * Bu bileşen iOS'ta:
 * 1. `automaticallyAdjustKeyboardInsets={false}` ile yerel çakışmayı kapatır.
 * 2. Klavye açılırken (`keyboardWillShow`) odaklanan TextInput'un tam kutu yüksekliğini ölçer.
 * 3. Kutu klavyenin altında kalıyorsa `extraScrollHeight` kadar ek pay bırakarak tek ve pürüzsüz bir
 *    hareketle alanı klavyenin üstüne taşır.
 *
 * Android'de mevcut davranışın korunması için `RNKeyboardAwareScrollView` kullanılır.
 */
export function KeyboardAwareScrollView({
  children,
  extraScrollHeight = 72,
  extraHeight,
  enableOnAndroid = true,
  enableAutomaticScroll = true,
  keyboardOpeningTime,
  innerRef,
  onScroll,
  contentContainerStyle,
  ...rest
}: KeyboardAwareScrollViewProps) {
  const scrollRef = useRef<ScrollView | null>(null);
  const scrollYRef = useRef(0);
  const keyboardEndYRef = useRef<number | null>(null);
  const basePaddingBottom = extractPaddingBottom(contentContainerStyle);
  const isFocusInsideRef = useRef(false);
  const [kbInset, setKbInset] = React.useState(0);

  const effectiveExtra = extraScrollHeight ?? extraHeight ?? 72;

  const setRef = useCallback(
    (node: ScrollView | null) => {
      scrollRef.current = node;
      innerRef?.(node);
    },
    [innerRef]
  );

  const scrollFocusedIntoView = useCallback(
    (keyboardScreenY: number) => {
      if (!enableAutomaticScroll || !scrollRef.current || !isFocusInsideRef.current) return;
      const focusedInput = TextInput.State.currentlyFocusedInput?.();
      if (!focusedInput) return;

      (focusedInput as unknown as {
        measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void;
      }).measureInWindow?.((_x, inputY, _w, inputHeight) => {
        if (!inputHeight || !scrollRef.current) return;
        const inputBottom = inputY + inputHeight;
        const targetBottom = keyboardScreenY - effectiveExtra;
        const overlap = inputBottom - targetBottom;

        if (overlap > 4) {
          scrollRef.current.scrollTo({
            y: Math.max(0, scrollYRef.current + overlap),
            animated: true,
          });
        } else if (inputY < 80) {
          // Alan ekranın üst sınırından yukarı taşmışsa görünür bölgeye geri indir
          const pullDown = 96 - inputY;
          scrollRef.current.scrollTo({
            y: Math.max(0, scrollYRef.current - pullDown),
            animated: true,
          });
        }
      });
    },
    [effectiveExtra, enableAutomaticScroll]
  );

  useEffect(() => {
    if (Platform.OS !== "ios") return;

    const handleWillShow = (event: KeyboardEvent) => {
      const kbY = event.endCoordinates.screenY;
      const kbH = event.endCoordinates.height;
      keyboardEndYRef.current = kbY;
      setKbInset(kbH);
      requestAnimationFrame(() => {
        scrollFocusedIntoView(kbY);
      });
    };

    const handleWillHide = () => {
      keyboardEndYRef.current = null;
      isFocusInsideRef.current = false;
      setKbInset(0);
    };

    const subShow = Keyboard.addListener("keyboardWillShow", handleWillShow);
    const subHide = Keyboard.addListener("keyboardWillHide", handleWillHide);
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, [scrollFocusedIntoView]);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollYRef.current = event.nativeEvent.contentOffset.y;
      onScroll?.(event);
    },
    [onScroll]
  );

  const handleTouchStart = useCallback(() => {
    isFocusInsideRef.current = true;
  }, []);

  // Klavye zaten açıkken kullanıcı başka bir TextInput'a dokunursa onu da görünür alana getir
  const handleTouchEnd = useCallback(() => {
    isFocusInsideRef.current = true;
    if (Platform.OS !== "ios" || keyboardEndYRef.current === null) return;
    const kbY = keyboardEndYRef.current;
    setTimeout(() => {
      scrollFocusedIntoView(kbY);
    }, 30);
  }, [scrollFocusedIntoView]);

  if (Platform.OS !== "ios") {
    return (
      <RNKeyboardAwareScrollView
        innerRef={(ref) => {
          scrollRef.current = ref as unknown as ScrollView | null;
          innerRef?.(ref as unknown as ScrollView | null);
        }}
        enableOnAndroid={enableOnAndroid}
        extraScrollHeight={extraScrollHeight}
        extraHeight={extraHeight}
        enableAutomaticScroll={enableAutomaticScroll}
        keyboardOpeningTime={keyboardOpeningTime}
        onScroll={onScroll}
        contentContainerStyle={contentContainerStyle}
        {...rest}
      >
        {children}
      </RNKeyboardAwareScrollView>
    );
  }

  return (
    <ScrollView
      ref={setRef}
      automaticallyAdjustKeyboardInsets={false}
      scrollEventThrottle={16}
      onScroll={handleScroll}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      contentContainerStyle={
        kbInset > 0
          ? [contentContainerStyle, { paddingBottom: basePaddingBottom + kbInset }]
          : contentContainerStyle
      }
      {...rest}
    >
      {children}
    </ScrollView>
  );
}

function extractPaddingBottom(style: ScrollViewProps["contentContainerStyle"]): number {
  if (!style) return 24;
  const flat = Array.isArray(style)
    ? Object.assign({}, ...style.filter((s) => s && typeof s === "object"))
    : typeof style === "object"
    ? style
    : {};
  const pb = (flat as Record<string, unknown>).paddingBottom ?? (flat as Record<string, unknown>).padding ?? 24;
  return typeof pb === "number" ? pb : 24;
}

