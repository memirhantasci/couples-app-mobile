/**
 * @file WishModal.tsx
 * @module modules/stars/components
 * @description Kayan yıldız yakalanınca açılan dilek ekranı.
 *
 * Dilek metni yalnızca bu ekranda yaşar: hiçbir yere kaydedilmez, ağa gönderilmez. "Gökyüzüne bırak"
 * denince sunucuya yalnızca bugünkü hakkın kullanıldığı bildirilir (`onRelease`). Başarılı olursa yazılan
 * kelimeler altın gibi parlayıp yukarı süzülür, kıvılcımlara dönüşerek gökyüzüne karışır ve kısa bir
 * kapanış yazısı belirir. Ağ hatasında metin korunur, hak harcanmaz.
 *
 * Gökyüzü karanlıktır: ekran temadan bağımsız koyu camdır (yıldızın içindeki HUD gibi).
 * Ebeveyn bileşen ekranı yalnızca açıkken bağlar; her açılış temiz bir durumla başlar.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
  type KeyboardEvent,
  type LayoutChangeEvent,
} from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertCircle, Sparkles } from 'lucide-react-native';
import { hapticTap, playLetterSend } from '@/lib/soundEffects';
import { smoothstep } from '../canvas/macro/starStyle';
import type { MakeWishResult } from '../types/star.types';

const MAX_WISH_LENGTH = 160;
const LEAVE_MS = 260;
/** Kelimelerin süzülüp kıvılcımlara dönüştüğü bırakış sahnesi. */
const RELEASE_MS = 2300;
/** Bırakış ilerlemesinde kapanış yazısının belirdiği an (0…1). */
const CAPTION_AT = 0.62;
/** Kapanış yazısı bu kadar görünür kalır, sonra ekran kendiliğinden kapanır. */
const DONE_HOLD_MS = 1600;
/** Bir kelimenin kalkışı bırakış süresinin bu kadarını kaplar. */
const WORD_SPAN = 0.5;
const SPARK_SPAN = 0.55;
const SPARK_COUNT = 18;
/** Klavye ile kartın alt kenarı arasındaki boşluk. */
const KEYBOARD_GAP = 14;

type Phase = 'compose' | 'sending' | 'releasing' | 'done' | 'alreadyUsed';

export interface WishOutcome {
  /** Dilek gökyüzüne bırakıldı mı (bugünkü hak kullanıldı). */
  readonly released: boolean;
  /** Yıldıza verilen ışık puanı. */
  readonly points: number;
}

export interface WishModalProps {
  /** Partner bugün dilek tuttuysa kartta küçük, sıcak bir satır gösterilir. */
  readonly partnerWishedToday: boolean;
  /** Çiftin tescilli bir yıldızı var mı; varsa kapanışta ışık katkısı söylenir. */
  readonly hasStar: boolean;
  /** Bugünkü dilek hakkını kullanır. Dilek metni bu çağrıya VERİLMEZ. */
  readonly onRelease: () => Promise<MakeWishResult>;
  /** Kapanış animasyonu bittiğinde çağrılır; ebeveyn ekranı kaldırır. */
  readonly onClose: (outcome: WishOutcome) => void;
}

interface Frame {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

interface ReleaseWord {
  readonly key: string;
  readonly text: string;
  /** Kalkış başlangıcı (bırakış ilerlemesi, 0…1). */
  readonly delay: number;
  readonly rise: number;
  readonly drift: number;
  readonly tilt: number;
}

interface ReleaseSpark {
  readonly key: string;
  readonly x: number;
  readonly y: number;
  readonly size: number;
  readonly delay: number;
  readonly rise: number;
  readonly drift: number;
  readonly phase: number;
  readonly gold: boolean;
}

interface ReleaseScene {
  readonly frame: Frame;
  readonly words: ReleaseWord[];
  readonly sparks: ReleaseSpark[];
}

/** Arka planda göz kırpan yıldızlar; sabit yerleşim (her açılışta aynı, saf). */
const TWINKLES = Array.from({ length: 18 }, (_, index) => ({
  x: (index * 0.61803398875 + 0.07) % 1,
  y: (index * 0.41421356237 + 0.11) % 1,
  size: 1.6 + (index % 3) * 0.8,
  delay: (index * 233) % 1400,
  duration: 1700 + ((index * 397) % 1500),
}));

/** Yazıyı süzülecek parçalara böler; boşluksuz uzun yazılar da parça parça kalkar. */
function splitWish(wish: string): string[] {
  const pieces: string[] = [];
  for (const word of wish.split(/\s+/)) {
    for (let index = 0; index < word.length; index += 14) pieces.push(word.slice(index, index + 14));
  }
  return pieces.slice(0, 48);
}

/** Bırakış sahnesinin rastgele ayrıntıları; yalnızca bırakış anında (olay işleyicide) kurulur. */
function buildReleaseScene(wish: string, frame: Frame): ReleaseScene {
  const pieces = splitWish(wish);
  const count = Math.max(1, pieces.length - 1);
  const words = pieces.map((text, index) => ({
    key: `w${index}`,
    text,
    delay: 0.04 + (index / count) * 0.28 + Math.random() * 0.04,
    rise: frame.y * 0.55 + 90 + Math.random() * 140,
    drift: (Math.random() - 0.5) * 70,
    tilt: (Math.random() - 0.5) * 16,
  }));
  const sparks = Array.from({ length: SPARK_COUNT }, (_, index) => ({
    key: `s${index}`,
    x: frame.x + 12 + Math.random() * Math.max(0, frame.width - 24),
    y: frame.y + 10 + Math.random() * Math.max(0, frame.height - 20),
    size: 2.5 + Math.random() * 3,
    delay: 0.12 + Math.random() * 0.36,
    rise: frame.y * 0.7 + 60 + Math.random() * 160,
    drift: (Math.random() - 0.5) * 90,
    phase: Math.random() * Math.PI * 2,
    gold: index % 3 !== 0,
  }));
  return { frame, words, sparks };
}

export function WishModal({ partnerWishedToday, hasStar, onRelease, onClose }: WishModalProps) {
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const reduceMotion = useReducedMotion();

  const [text, setText] = useState('');
  const [phase, setPhase] = useState<Phase>('compose');
  const [error, setError] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const [scene, setScene] = useState<ReleaseScene | null>(null);
  const [points, setPoints] = useState(0);

  // Klavye ve animasyon geri çağrıları en güncel durumu buradan okur.
  const phaseRef = useRef<Phase>('compose');
  const outcomeRef = useRef<WishOutcome>({ released: false, points: 0 });
  const closingRef = useRef(false);
  const closedRef = useRef(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const inputRef = useRef<TextInput>(null);
  const inputBoxRef = useRef<View>(null);
  const cardLayoutRef = useRef<{ y: number; height: number } | null>(null);
  const keyboardTopRef = useRef<number | null>(null);

  // Giriş, çıkış ve bırakış AYRI değerlerdir; aynı değere ikinci set çalışan animasyonu iptal eder.
  const appear = useSharedValue(0);
  const leave = useSharedValue(0);
  const release = useSharedValue(0);
  const lift = useSharedValue(0);

  const changePhase = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const later = useCallback((fn: () => void, ms: number) => {
    timersRef.current.push(setTimeout(fn, ms));
  }, []);
  useEffect(() => {
    const timers = timersRef.current;
    return () => timers.forEach(clearTimeout);
  }, []);

  // ─── Kapanış ───────────────────────────────────────────────────────
  const finishClose = useCallback(() => {
    if (closedRef.current) return;
    closedRef.current = true;
    onClose(outcomeRef.current);
  }, [onClose]);

  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    Keyboard.dismiss();
    const duration = reduceMotion ? 120 : LEAVE_MS;
    leave.set(
      withTiming(1, { duration, easing: Easing.in(Easing.cubic) }, (finished) => {
        'worklet';
        if (finished) scheduleOnRN(finishClose);
      }),
    );
    // Animasyon kesilirse de ekran açık kalmasın
    later(finishClose, duration + 400);
  }, [leave, reduceMotion, finishClose, later]);

  // ─── Açılış ────────────────────────────────────────────────────────
  useEffect(() => {
    appear.set(
      reduceMotion ? withTiming(1, { duration: 160 }) : withSpring(1, { damping: 18, stiffness: 170, mass: 0.9 }),
    );
    AccessibilityInfo.announceForAccessibility('Bir yıldız kaydı. Bir dilek tut.');
    // Klavye kart yerine oturduktan sonra açılır
    later(() => inputRef.current?.focus(), reduceMotion ? 120 : 420);
  }, [appear, reduceMotion, later]);

  // ─── Klavye: kart klavyenin üstünde kalır ──────────────────────────
  // Kartın kendi yerleşimi (dönüşümsüz) ve klavyenin üst kenarı karşılaştırılır. Pencere klavyeyle
  // küçülürse kart zaten yeniden ortalanır ve kaydırma sıfır çıkar; küçülmezse kart yukarı kayar.
  const applyLift = useCallback(
    (duration: number) => {
      const layout = cardLayoutRef.current;
      const keyboardTop = keyboardTopRef.current;
      let target = 0;
      if (layout && keyboardTop !== null) {
        const overlap = layout.y + layout.height + KEYBOARD_GAP - keyboardTop;
        if (overlap > 0) target = -Math.min(overlap, Math.max(0, layout.y - insets.top - 8));
      }
      lift.set(withTiming(target, { duration, easing: Easing.out(Easing.cubic) }));
    },
    [lift, insets.top],
  );

  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (event: KeyboardEvent) => {
      const keyboardTop = event.endCoordinates.screenY;
      keyboardTopRef.current = keyboardTop;
      // Küçük ekranda kart klavyenin üstüne sığmıyorsa açıklama ve amblem gizlenir
      const layout = cardLayoutRef.current;
      if (layout && layout.height + KEYBOARD_GAP > keyboardTop - insets.top - 8) setIsCompact(true);
      applyLift(event.duration > 0 ? event.duration : 220);
    });
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', (event: KeyboardEvent) => {
      keyboardTopRef.current = null;
      // Bırakış sırasında kart yerinde söner; kelimeler onun üstünden kalkar
      if (phaseRef.current === 'releasing' || phaseRef.current === 'done') return;
      setIsCompact(false);
      applyLift(event.duration > 0 ? event.duration : 200);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, [applyLift, insets.top]);

  const handleCardLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { y, height } = event.nativeEvent.layout;
      cardLayoutRef.current = { y, height };
      if (keyboardTopRef.current !== null) applyLift(160);
    },
    [applyLift],
  );

  // ─── Bırakış ───────────────────────────────────────────────────────
  const handleReleaseEnd = useCallback(() => {
    if (closingRef.current) return;
    changePhase('done');
    hapticTap();
    AccessibilityInfo.announceForAccessibility('Dileğin yola çıktı.');
    later(close, DONE_HOLD_MS);
  }, [changePhase, later, close]);

  const startRelease = useCallback(
    (wish: string) => {
      // Yazı alanı klavye açıkken, görünen yerinde ölçülür; klavye ancak bırakış başlayınca
      // kapanır (kapanırken kart yerinde kalır, bkz. klavye dinleyicisi).
      const begin = (frame: Frame | null) => {
        setScene(frame ? buildReleaseScene(wish, frame) : null);
        changePhase('releasing');
        Keyboard.dismiss();
        playLetterSend().catch(() => {});
        release.set(
          withTiming(1, { duration: reduceMotion ? 900 : RELEASE_MS, easing: Easing.linear }, (finished) => {
            'worklet';
            if (finished) scheduleOnRN(handleReleaseEnd);
          }),
        );
      };
      const box = inputBoxRef.current;
      if (reduceMotion || !box) begin(null);
      else box.measureInWindow((x, y, width, height) => begin({ x, y, width, height }));
    },
    [changePhase, release, reduceMotion, handleReleaseEnd],
  );

  const handleRelease = useCallback(async () => {
    const wish = text.trim();
    if (!wish || phaseRef.current !== 'compose') return;
    setError(null);
    changePhase('sending');

    let result: MakeWishResult;
    try {
      result = await onRelease();
    } catch {
      changePhase('compose');
      setError('Şu an gökyüzüne ulaşamadık. Bağlantını kontrol edip tekrar dener misin?');
      return;
    }
    if (closingRef.current) return;

    if (!result.ok) {
      // Bugünkü hak başka bir cihazdan kullanılmış
      Keyboard.dismiss();
      changePhase('alreadyUsed');
      return;
    }
    outcomeRef.current = { released: true, points: result.points };
    setPoints(result.points);
    startRelease(wish);
  }, [text, changePhase, onRelease, startRelease]);

  // Android geri tuşu: yazarken vazgeçer; gönderilirken beklenir; bırakıştan sonra hemen kapanır
  const handleRequestClose = useCallback(() => {
    if (phaseRef.current === 'sending') return;
    close();
  }, [close]);

  // ─── Animasyon stilleri ────────────────────────────────────────────
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, appear.get()) * (1 - leave.get()),
  }));

  const cardStyle = useAnimatedStyle(() => {
    const a = appear.get();
    const l = leave.get();
    const gone = smoothstep(0, 0.32, release.get());
    return {
      opacity: Math.min(1, a * 1.5) * (1 - l) * (1 - gone),
      transform: [
        { translateY: lift.get() + (reduceMotion ? 0 : (1 - a) * 40 + l * 24 - gone * 12) },
        { scale: reduceMotion ? 1 : (0.94 + 0.06 * Math.min(1, a)) * (1 - 0.04 * gone) },
      ],
    };
  });

  const captionStyle = useAnimatedStyle(() => {
    const t = smoothstep(CAPTION_AT, CAPTION_AT + 0.18, release.get());
    return {
      opacity: t * (1 - leave.get()),
      transform: [{ translateY: reduceMotion ? 0 : (1 - t) * 14 }, { scale: 0.96 + 0.04 * t }],
    };
  });

  const trimmed = text.trim();
  const isComposing = phase === 'compose' || phase === 'sending';
  const isSending = phase === 'sending';
  const showsCaption = phase === 'releasing' || phase === 'done';
  const cardWidth = Math.min(screenWidth - 40, 380);

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={handleRequestClose}>
      <View style={styles.root}>
        {/* Gece örtüsü: arkadaki gökyüzü silikçe görünür */}
        <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
          <LinearGradient
            colors={['rgba(3, 4, 16, 0.6)', 'rgba(7, 5, 24, 0.86)', 'rgba(2, 2, 10, 0.95)']}
            locations={[0, 0.55, 1]}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={['rgba(253, 230, 138, 0.12)', 'rgba(253, 230, 138, 0)']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 0.55 }}
            style={StyleSheet.absoluteFill}
          />
          {TWINKLES.map((spec, index) => (
            <Twinkle key={index} spec={spec} width={screenWidth} height={screenHeight} still={reduceMotion} />
          ))}
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={phase === 'done' ? close : Keyboard.dismiss}
            accessible={phase === 'done'}
            accessibilityLabel={phase === 'done' ? 'Kapat' : undefined}
          />
        </Animated.View>

        <Animated.View
          onLayout={handleCardLayout}
          pointerEvents={showsCaption ? 'none' : 'auto'}
          style={[styles.cardShadow, { width: cardWidth }, cardStyle]}
        >
          <LinearGradient
            colors={['rgba(26, 20, 56, 0.97)', 'rgba(11, 9, 28, 0.98)']}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.8, y: 1 }}
            style={styles.card}
          >
            {phase === 'alreadyUsed' ? (
              <>
                <MeteorEmblem still />
                <Text style={styles.title}>Bugünkü dileğini zaten tuttun</Text>
                <Text style={styles.body}>
                  Her gün bir dilek hakkın var. Yarın gökyüzü sana yeni bir yıldız kaydıracak ✨
                </Text>
                <TouchableOpacity
                  onPress={close}
                  activeOpacity={0.88}
                  style={styles.primaryButton}
                  accessibilityRole="button"
                  accessibilityLabel="Tamam"
                >
                  <LinearGradient
                    colors={['#FDE68A', '#F59E0B', '#E8890B']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.primaryGradient}
                  >
                    <Text style={styles.primaryText}>Tamam</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </>
            ) : (
              <>
                {!isCompact && <MeteorEmblem still={reduceMotion} />}
                <Text style={styles.eyebrow}>BİR YILDIZ KAYDI</Text>
                <Text style={styles.title}>Bir dilek tut</Text>
                {!isCompact && (
                  <Text style={styles.body}>
                    Gözlerini kapat, aklından geçeni yaz. Dileğin yalnızca gökyüzüne gider; kimse okumaz, hiçbir
                    yere kaydedilmez.
                  </Text>
                )}
                {partnerWishedToday && (
                  <View style={styles.partnerChip}>
                    <Text style={styles.partnerChipText}>💫 Partnerin de bugün bir dilek tuttu</Text>
                  </View>
                )}

                <View
                  ref={inputBoxRef}
                  collapsable={false}
                  style={[styles.inputBox, isFocused && styles.inputBoxFocused, isCompact && styles.inputBoxCompact]}
                >
                  <TextInput
                    ref={inputRef}
                    value={isComposing ? text : ''}
                    onChangeText={(value) => {
                      // Gönderilirken yazı sabit kalır (alan kapatılmaz: Android'de klavye kapanıp kart zıplardı)
                      if (phaseRef.current !== 'compose') return;
                      setText(value);
                      if (error) setError(null);
                    }}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    editable={isComposing}
                    multiline
                    maxLength={MAX_WISH_LENGTH}
                    placeholder="Dileğim…"
                    placeholderTextColor="rgba(253, 230, 138, 0.38)"
                    selectionColor="#FCD34D"
                    cursorColor="#FCD34D"
                    style={styles.input}
                    textAlignVertical="top"
                    autoCorrect={false}
                    accessibilityLabel="Dileğin"
                    accessibilityHint="Dileğin hiçbir yere kaydedilmez"
                  />
                  <Text style={styles.counter}>
                    {text.length} / {MAX_WISH_LENGTH}
                  </Text>
                </View>

                {error && (
                  <View style={styles.errorRow} accessibilityLiveRegion="polite">
                    <AlertCircle size={14} color="#FCA5A5" />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                <TouchableOpacity
                  onPress={handleRelease}
                  disabled={!trimmed || phase !== 'compose'}
                  activeOpacity={0.88}
                  style={[styles.primaryButton, !trimmed && styles.primaryButtonDisabled]}
                  accessibilityRole="button"
                  accessibilityLabel="Dileğimi gökyüzüne bırak"
                  accessibilityState={{ disabled: !trimmed || phase !== 'compose', busy: isSending }}
                >
                  <LinearGradient
                    colors={['#FDE68A', '#F59E0B', '#E8890B']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.primaryGradient}
                  >
                    {isSending ? (
                      <>
                        <ActivityIndicator size="small" color="#1C1206" />
                        <Text style={styles.primaryText}>Gökyüzüne yollanıyor…</Text>
                      </>
                    ) : (
                      <>
                        <Sparkles size={17} color="#1C1206" />
                        <Text style={styles.primaryText}>Dileğimi gökyüzüne bırak</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={close}
                  disabled={isSending}
                  style={styles.secondaryButton}
                  hitSlop={{ top: 6, bottom: 6, left: 12, right: 12 }}
                  accessibilityRole="button"
                  accessibilityLabel="Vazgeç"
                >
                  <Text style={[styles.secondaryText, isSending && { opacity: 0.4 }]}>Vazgeç</Text>
                </TouchableOpacity>
              </>
            )}
          </LinearGradient>
        </Animated.View>

        {/* Bırakış: kelimeler yazıldıkları yerden kalkar, kıvılcımlar gökyüzüne yükselir */}
        {scene && showsCaption && (
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <View
              style={[
                styles.wordsLayer,
                { left: scene.frame.x, top: scene.frame.y, width: scene.frame.width, minHeight: scene.frame.height },
              ]}
            >
              {scene.words.map((word) => (
                <ReleasingWord key={word.key} word={word} release={release} />
              ))}
            </View>
            {scene.sparks.map((spark) => (
              <RisingSpark key={spark.key} spark={spark} release={release} />
            ))}
          </View>
        )}

        {showsCaption && (
          <Animated.View pointerEvents="none" style={[styles.caption, captionStyle]}>
            <View style={styles.captionIcon}>
              <Sparkles size={26} color="#FDE68A" />
            </View>
            <Text style={styles.captionTitle}>Dileğin yola çıktı</Text>
            <Text style={styles.captionBody}>
              {points > 0 && hasStar ? 'Yıldızınız biraz daha parladı ✨' : 'Gökyüzü onu duydu ✨'}
            </Text>
          </Animated.View>
        )}
      </View>
    </Modal>
  );
}

// ─── Parçalar ──────────────────────────────────────────────────────────────

/** Kartın başındaki küçük kayan yıldız: çizgi aralıklarla yeniden kayar. */
function MeteorEmblem({ still }: { still: boolean }) {
  const sweep = useSharedValue(still ? 1 : 0);
  useEffect(() => {
    if (still) return;
    sweep.set(
      withRepeat(
        withSequence(
          withTiming(0, { duration: 0 }),
          withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic) }),
          withDelay(1700, withTiming(1, { duration: 0 })),
        ),
        -1,
        false,
      ),
    );
    return () => cancelAnimation(sweep);
  }, [sweep, still]);

  const streakStyle = useAnimatedStyle(() => {
    const t = sweep.get();
    return {
      opacity: 0.35 + 0.65 * Math.min(1, t * 2.5),
      transform: [{ rotate: '-32deg' }, { translateX: -14 + 14 * t }],
    };
  });

  return (
    <View style={styles.emblem} importantForAccessibility="no-hide-descendants">
      <LinearGradient
        colors={['rgba(253, 230, 138, 0.24)', 'rgba(245, 158, 11, 0.04)']}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View style={[styles.emblemStreakWrap, streakStyle]}>
        <LinearGradient
          colors={['rgba(255, 255, 255, 0)', 'rgba(207, 230, 255, 0.55)', '#FFFFFF']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.emblemStreak}
        />
        <View style={styles.emblemHead} />
      </Animated.View>
    </View>
  );
}

/** Arka planda yavaşça göz kırpan küçük bir yıldız. */
function Twinkle({
  spec,
  width,
  height,
  still,
}: {
  spec: (typeof TWINKLES)[number];
  width: number;
  height: number;
  still: boolean;
}) {
  const glow = useSharedValue(0.35);
  useEffect(() => {
    if (still) return;
    const half = spec.duration / 2;
    glow.set(
      withDelay(
        spec.delay,
        withRepeat(withSequence(withTiming(0.95, { duration: half }), withTiming(0.15, { duration: half })), -1, false),
      ),
    );
    return () => cancelAnimation(glow);
  }, [glow, spec, still]);

  const style = useAnimatedStyle(() => ({ opacity: glow.get() }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.twinkle,
        {
          left: spec.x * width,
          top: spec.y * height,
          width: spec.size,
          height: spec.size,
          borderRadius: spec.size / 2,
        },
        style,
      ]}
    />
  );
}

/** Dilekten bir kelime: önce altın gibi parlar, sonra yukarı süzülüp küçülerek söner. */
function ReleasingWord({ word, release }: { word: ReleaseWord; release: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const t = Math.max(0, Math.min(1, (release.get() - word.delay) / WORD_SPAN));
    const glow = Math.min(1, t / 0.25);
    const rise = t * t;
    return {
      opacity: 1 - Math.max(0, (t - 0.35) / 0.65),
      color: interpolateColor(glow, [0, 1], ['#FFFDF5', '#FDE68A']),
      transform: [
        { translateX: word.drift * t },
        { translateY: -word.rise * rise },
        { rotate: `${word.tilt * t}deg` },
        { scale: 1 + 0.08 * Math.sin(Math.min(1, t / 0.3) * Math.PI) - 0.5 * rise },
      ],
    };
  });
  return <Animated.Text style={[styles.releaseWord, style]}>{word.text}</Animated.Text>;
}

/** Yazının içinden doğup gökyüzüne yükselen, kırpışarak sönen bir kıvılcım. */
function RisingSpark({ spark, release }: { spark: ReleaseSpark; release: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const t = Math.max(0, Math.min(1, (release.get() - spark.delay) / SPARK_SPAN));
    const ease = 1 - (1 - t) * (1 - t) * (1 - t);
    const twinkle = 0.6 + 0.4 * Math.sin(t * Math.PI * 7 + spark.phase);
    return {
      opacity: t <= 0 ? 0 : Math.min(1, t * 6) * (1 - smoothstep(0.7, 1, t)) * twinkle,
      transform: [{ translateX: spark.drift * ease }, { translateY: -spark.rise * ease }, { scale: 1 - 0.45 * t }],
    };
  });
  return (
    <Animated.View
      style={[
        styles.spark,
        {
          left: spark.x,
          top: spark.y,
          width: spark.size,
          height: spark.size,
          borderRadius: spark.size / 2,
          backgroundColor: spark.gold ? '#FDE68A' : '#FFFFFF',
          shadowColor: spark.gold ? '#F59E0B' : '#BFDBFE',
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  twinkle: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
  },
  cardShadow: {
    borderRadius: 28,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.28,
    shadowRadius: 32,
    elevation: 18,
  },
  card: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(253, 230, 138, 0.22)',
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 12,
    alignItems: 'center',
    overflow: 'hidden',
  },
  emblem: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(253, 230, 138, 0.3)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emblemStreakWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emblemStreak: {
    width: 34,
    height: 2.5,
    borderRadius: 1.25,
  },
  emblemHead: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginLeft: -3,
    backgroundColor: '#FFFFFF',
    shadowColor: '#FDE68A',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 4,
  },
  eyebrow: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    letterSpacing: 2.4,
    color: '#FCD34D',
    marginBottom: 6,
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 25,
    lineHeight: 31,
    color: '#FFF8E7',
    textAlign: 'center',
    marginBottom: 8,
  },
  body: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(226, 232, 240, 0.78)',
    textAlign: 'center',
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  partnerChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(236, 72, 153, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(244, 114, 182, 0.28)',
    marginBottom: 14,
  },
  partnerChipText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: '#F9A8D4',
  },
  inputBox: {
    alignSelf: 'stretch',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(253, 230, 138, 0.18)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
    marginBottom: 12,
  },
  inputBoxFocused: {
    borderColor: 'rgba(253, 230, 138, 0.5)',
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
  },
  inputBoxCompact: {
    marginBottom: 10,
  },
  input: {
    minHeight: 84,
    maxHeight: 132,
    padding: 0,
    fontFamily: 'Inter_400Regular',
    fontSize: 17,
    lineHeight: 24,
    color: '#FFFDF5',
  },
  counter: {
    alignSelf: 'flex-end',
    marginTop: 4,
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.35)',
  },
  errorRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  errorText: {
    flex: 1,
    fontFamily: 'Inter_500Medium',
    fontSize: 12.5,
    lineHeight: 17,
    color: '#FCA5A5',
  },
  primaryButton: {
    alignSelf: 'stretch',
    height: 52,
    borderRadius: 16,
    overflow: 'hidden',
  },
  primaryButtonDisabled: {
    opacity: 0.4,
  },
  primaryGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  primaryText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 15.5,
    color: '#1C1206',
    letterSpacing: 0.2,
  },
  secondaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 2,
  },
  secondaryText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.55)',
  },
  wordsLayer: {
    position: 'absolute',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignContent: 'flex-start',
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  releaseWord: {
    fontFamily: 'Inter_400Regular',
    fontSize: 17,
    lineHeight: 24,
    marginRight: 5,
    textShadowColor: 'rgba(253, 230, 138, 0.85)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  spark: {
    position: 'absolute',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 5,
    elevation: 3,
  },
  caption: {
    position: 'absolute',
    left: 32,
    right: 32,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(253, 230, 138, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(253, 230, 138, 0.3)',
    marginBottom: 14,
  },
  captionTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 24,
    lineHeight: 30,
    color: '#FFF8E7',
    textAlign: 'center',
    marginBottom: 6,
    textShadowColor: 'rgba(253, 230, 138, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  },
  captionBody: {
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    color: 'rgba(253, 230, 138, 0.85)',
    textAlign: 'center',
  },
});
