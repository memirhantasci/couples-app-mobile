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

export interface KeyboardAwareScrollViewProps extends ScrollViewProps {
  enableOnAndroid?: boolean;
  extraScrollHeight?: number;
  extraHeight?: number;
  enableAutomaticScroll?: boolean;
  keyboardOpeningTime?: number;
  innerRef?: (ref: ScrollView | null) => void;
}

/**
 * iOS ve Android (Fabric / Yeni Mimari) ile tam uyumlu, çift zıplama yapmayan akıllı ScrollView.
 *
 * Neden özel bileşen?
 * - Eski `react-native-keyboard-aware-scroll-view` (2021) iOS'ta 250ms gecikmeyle zıplama,
 *   Android'de ise `adjustResize` ile çakışma ve Fabric altında `viewIsDescendantOf() noop` sorunları
 *   üretiyordu.
 * - Yerel `automaticallyAdjustKeyboardInsets` ise çok satırlı (multiline) TextInput'larda yalnız imleç
 *   satırını korur; metin kutusunun alt kısmını ve altındaki kaydet butonlarını klavyenin arkasında bırakır.
 *
 * Bu bileşen:
 * 1. iOS'ta `keyboardWillShow/Hide`, Android'de `keyboardDidShow/Hide` dinler.
 * 2. ScrollView'un ekrandaki gerçek alt kenarını `measureInWindow` ile ölçer:
 *    - Android'de `adjustResize` pencereyi zaten küçülttüyse örtüşme (`overlap`) 0 çıkar → gereksiz boşluk
 *      eklenmez, çift zıplama olmaz.
 *    - Android edge-to-edge / yarı saydam `<Modal>` içinde pencere küçülmediyse gerçek örtüşme kadar
 *      alt pay (`kbInset`) eklenir.
 * 3. Odaklanan `TextInput` klavyenin altında kalıyorsa `extraScrollHeight` kadar payla pürüzsüzce
 *    görünür alana kaydırır.
 */
export function KeyboardAwareScrollView({
  children,
  extraScrollHeight = 72,
  extraHeight,
  enableOnAndroid = true,
  enableAutomaticScroll = true,
  keyboardOpeningTime: _keyboardOpeningTime,
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
  const isNativeEnabled = Platform.OS === "ios" || (Platform.OS === "android" && enableOnAndroid);

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
    if (!isNativeEnabled) return;

    const handleShow = (event: KeyboardEvent) => {
      const kbY = event.endCoordinates.screenY;
      const kbH = event.endCoordinates.height;
      keyboardEndYRef.current = kbY;
      requestAnimationFrame(() => {
        const scrollNode = scrollRef.current as unknown as {
          measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void;
        } | null;
        if (scrollNode?.measureInWindow) {
          scrollNode.measureInWindow((_x, scrollY, _w, scrollH) => {
            if (scrollH > 0) {
              const overlap = Math.max(0, scrollY + scrollH - kbY);
              if (Platform.OS === "android") {
                // adjustResize pencereyi zaten küçülttüyse overlap <= 16 olur → çift boşluk eklenmez;
                // edge-to-edge Modal içinde küçülmediyse gerçek klavye örtüşmesi kadar boşluk bırakılır.
                setKbInset(overlap > 16 ? overlap : 0);
              } else {
                setKbInset(overlap > 16 ? overlap : Math.min(kbH, effectiveExtra));
              }
            } else {
              setKbInset(Platform.OS === "android" ? 0 : kbH);
            }
            scrollFocusedIntoView(kbY);
          });
        } else {
          setKbInset(Platform.OS === "android" ? 0 : kbH);
          scrollFocusedIntoView(kbY);
        }
      });
    };

    const handleHide = () => {
      keyboardEndYRef.current = null;
      isFocusInsideRef.current = false;
      setKbInset(0);
    };

    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const subShow = Keyboard.addListener(showEvent, handleShow);
    const subHide = Keyboard.addListener(hideEvent, handleHide);
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, [isNativeEnabled, effectiveExtra, scrollFocusedIntoView]);

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
    if (!isNativeEnabled || keyboardEndYRef.current === null) return;
    const kbY = keyboardEndYRef.current;
    setTimeout(() => {
      scrollFocusedIntoView(kbY);
    }, 30);
  }, [isNativeEnabled, scrollFocusedIntoView]);

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
