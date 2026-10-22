import { Platform } from 'react-native';
import { createAudioPlayer, setAudioModeAsync, AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { safeStorage as AsyncStorage } from '@/lib/safeStorage';
import { logger } from '@/utils/logger';

export type SoundEffectType =
  | 'bubble_pop'
  | 'letter_send'
  | 'success_chime'
  | 'stamp_drop'
  | 'camera_click'
  | 'celebration'
  | 'celestial_chime';

const SOUND_ASSETS: Record<SoundEffectType, any> = {
  bubble_pop: require('../../assets/sounds/bubble_pop.wav'),
  letter_send: require('../../assets/sounds/letter_send.wav'),
  success_chime: require('../../assets/sounds/success_chime.wav'),
  stamp_drop: require('../../assets/sounds/stamp_drop.wav'),
  camera_click: require('../../assets/sounds/camera_click.wav'),
  celebration: require('../../assets/sounds/celebration.wav'),
  celestial_chime: require('../../assets/sounds/celestial_chime.wav'),
};

const COSMIC_AMBIENT_ASSET = require('../../assets/sounds/cosmic_ambient.wav');

const STORAGE_KEY_SOUND = '@app_sound_effects_enabled';
const STORAGE_KEY_HAPTIC = '@app_haptic_feedback_enabled';

// In-memory cache for ultra-fast sync access
let isSoundEnabledCache: boolean | null = null;
let isHapticEnabledCache: boolean | null = null;
let isAudioModeConfigured = false;

// Audio player instances cache (singleton pool)
const playerPool = new Map<SoundEffectType, AudioPlayer>();

/**
 * Configure audio mode to respect device silent mode (iPhone silent switch / Android mute).
 * Does not interrupt background music unless needed.
 */
async function ensureAudioMode(): Promise<void> {
  if (isAudioModeConfigured || Platform.OS === 'web') return;
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      allowsRecording: false,
    });
    isAudioModeConfigured = true;
  } catch (err) {
    logger.log('[SoundEffects] setAudioModeAsync notice:', err);
  }
}

/**
 * Ses efektlerini uygulama başında belleğe yükleyerek ilk dokunuş gecikmesini sıfırlar.
 */
export function warmUpSoundEffects(): void {
  if (Platform.OS === 'web') return;
  ensureAudioMode().catch(() => {});
  try {
    for (const key of Object.keys(SOUND_ASSETS) as SoundEffectType[]) {
      getOrCreatePlayer(key);
    }
  } catch (err) {
    logger.log('[SoundEffects] Warm-up notice:', err);
  }
}

// Modül yüklendiğinde arka planda hazırla
setTimeout(() => {
  warmUpSoundEffects();
}, 200);

/**
 * Get whether sound effects are enabled (default: true).
 */
export async function getSoundEffectsEnabled(): Promise<boolean> {
  if (isSoundEnabledCache !== null) return isSoundEnabledCache;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_SOUND);
    isSoundEnabledCache = raw !== null ? raw === 'true' : true;
  } catch {
    isSoundEnabledCache = true;
  }
  return isSoundEnabledCache;
}

/**
 * Set sound effects preference.
 */
export async function setSoundEffectsEnabled(enabled: boolean): Promise<void> {
  isSoundEnabledCache = enabled;
  if (!enabled) {
    stopCosmicAmbient();
  }
  try {
    await AsyncStorage.setItem(STORAGE_KEY_SOUND, enabled ? 'true' : 'false');
  } catch (err) {
    logger.error('[SoundEffects] Error saving sound preference:', err);
  }
}

/**
 * Get whether haptic feedback is enabled (default: true).
 */
export async function getHapticFeedbackEnabled(): Promise<boolean> {
  if (isHapticEnabledCache !== null) return isHapticEnabledCache;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_HAPTIC);
    isHapticEnabledCache = raw !== null ? raw === 'true' : true;
  } catch {
    isHapticEnabledCache = true;
  }
  return isHapticEnabledCache;
}

/**
 * Set haptic feedback preference.
 */
export async function setHapticFeedbackEnabled(enabled: boolean): Promise<void> {
  isHapticEnabledCache = enabled;
  try {
    await AsyncStorage.setItem(STORAGE_KEY_HAPTIC, enabled ? 'true' : 'false');
  } catch (err) {
    logger.error('[SoundEffects] Error saving haptic preference:', err);
  }
}

// ─── Platforma Duyarlı Haptik Yardımcıları ──────────────────────────────────
// iOS'ta Taptic Engine API'leri doğrudan kullanılır. Android'de expo-haptics'in impact/notification/
// selection çağrıları Vibrator servisini kullanır (dokümanda önerilmez); özellikle selection yalnızca
// 50 ms ve 30/255 genlikte titreşir, çoğu cihazda hissedilmez. Android'de önerilen
// performAndroidHapticsAsync (sistem dokunsal geri bildirimi) önce denenir. Confirm/Reject API 30
// öncesinde yoktur; desteklenmiyorsa eski Vibrator çağrısına düşülür.
export type HapticKind = 'selection' | 'tap' | 'stamp' | 'success' | 'warning' | 'error';

const ANDROID_HAPTIC: Record<HapticKind, Haptics.AndroidHaptics> = {
  selection: Haptics.AndroidHaptics.Clock_Tick,
  tap: Haptics.AndroidHaptics.Virtual_Key,
  stamp: Haptics.AndroidHaptics.Long_Press,
  success: Haptics.AndroidHaptics.Confirm,
  warning: Haptics.AndroidHaptics.Reject,
  error: Haptics.AndroidHaptics.Reject,
};

/**
 * Kullanıcının haptik tercihine saygı duyarak tek bir dokunsal geri bildirim verir.
 * Hiçbir zaman hata fırlatmaz; destek yoksa sessizce geçer.
 */
export async function fireHaptic(kind: HapticKind): Promise<void> {
  if (Platform.OS === 'web') return;
  if (!(await getHapticFeedbackEnabled())) return;

  try {
    if (Platform.OS === 'android') {
      try {
        await Haptics.performAndroidHapticsAsync(ANDROID_HAPTIC[kind]);
        return;
      } catch {
        // Bu API düzeyinde desteklenmiyor → aşağıdaki Vibrator tabanlı çağrıya düş
      }
    }

    switch (kind) {
      case 'selection':
        await Haptics.selectionAsync();
        break;
      case 'tap':
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        break;
      case 'stamp':
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        break;
      case 'success':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        break;
      case 'warning':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        break;
      case 'error':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        break;
    }
  } catch {}
}

/** Akıcı "tekerlek tıkı": ruh hali / seçim değişimi. */
export const hapticSelection = () => fireHaptic('selection');
/** Hafif dokunuş: bir şeye konma, eşik aşma. */
export const hapticTap = () => fireHaptic('tap');
/** Tok mühür basma hissi: mektup mühürleme. */
export const hapticStamp = () => fireHaptic('stamp');
/** Başarı: kayıt tamamlandı. */
export const hapticSuccess = () => fireHaptic('success');
export const hapticWarning = () => fireHaptic('warning');
export const hapticError = () => fireHaptic('error');

/**
 * Trigger tactile haptic feedback matching the interaction.
 * Tüm efektler platforma duyarlı `fireHaptic` üzerinden geçer (iOS'ta çağrılar öncekiyle aynıdır;
 * Android'de önerilen sistem dokunsal geri bildirimi kullanılır). Tercih kontrolü orada yapılır.
 */
export async function triggerHaptic(type: SoundEffectType): Promise<void> {
  switch (type) {
    case 'bubble_pop':
      // Ruh hali seçimi: akıcı tekerlek tıkı (eskiden hafif darbe)
      await fireHaptic('selection');
      break;
    case 'letter_send':
    case 'success_chime':
    case 'celebration':
      await fireHaptic('success');
      break;
    case 'stamp_drop':
      await fireHaptic('stamp');
      break;
    case 'camera_click':
      await fireHaptic('tap');
      break;
  }
}

/**
 * Get or initialize an AudioPlayer instance for a given sound effect.
 */
function getOrCreatePlayer(type: SoundEffectType): AudioPlayer | null {
  try {
    if (playerPool.has(type)) {
      return playerPool.get(type)!;
    }
    const source = SOUND_ASSETS[type];
    const player = createAudioPlayer(source);
    playerPool.set(type, player);
    return player;
  } catch (err) {
    logger.log('[SoundEffects] Player creation fallback:', err);
    return null;
  }
}

/**
 * Play a specific sound effect and trigger its synchronized haptic feedback.
 */
export async function playSoundEffect(type: SoundEffectType): Promise<void> {
  // 1. Trigger haptics immediately for responsive tactile feel
  triggerHaptic(type).catch(() => {});

  // 2. Check if sound is enabled
  const soundEnabled = await getSoundEffectsEnabled();
  if (!soundEnabled) return;

  // 3. Play audio
  try {
    await ensureAudioMode();
    const player = getOrCreatePlayer(type);
    if (!player) return;

    // expo-audio ses bitince otomatik başa dönmediği için her seferinde 0'a sar
    try {
      player.seekTo(0);
    } catch (_) {}

    player.play();
  } catch (err) {
    logger.log('[SoundEffects] Play error (silent fallback):', err);
  }
}

// ─── Direct Ergonomic Shortcuts for Feature Screens ─────────────────────────

/**
 * Mood / emoji selector, heart taps (soft bubble pop)
 */
export const playBubblePop = () => playSoundEffect('bubble_pop');

/**
 * Letter sent / origami flight (whoosh & twinkle)
 */
export const playLetterSend = () => playSoundEffect('letter_send');

/**
 * Medicine taken (DRANK), completed health routine (crystal chime)
 */
export const playSuccessChime = () => playSoundEffect('success_chime');

/**
 * Pin or memory sealed onto Love Map (soft wooden stamp tap)
 */
export const playStampDrop = () => playSoundEffect('stamp_drop');

/**
 * Memory photo snapped or saved (camera shutter)
 */
export const playCameraClick = () => playSoundEffect('camera_click');

/**
 * Love meter peak 90+ or relationship milestone celebration (harp glissando)
 */
export const playCelebration = () => playSoundEffect('celebration');

// ─── Star Map Celestial Audio ───────────────────────────────────────────────

let ambientPlayer: AudioPlayer | null = null;
let ambientFadeHandle: ReturnType<typeof setInterval> | null = null;

function fadeAmbient(target: number, durationMs: number, onDone?: () => void): void {
  if (ambientFadeHandle) {
    clearInterval(ambientFadeHandle);
    ambientFadeHandle = null;
  }
  const player = ambientPlayer;
  if (!player) return;
  const steps = 20;
  const stepMs = Math.max(16, durationMs / steps);
  const start = player.volume ?? 0;
  let step = 0;
  ambientFadeHandle = setInterval(() => {
    step += 1;
    const t = Math.min(1, step / steps);
    try {
      player.volume = start + (target - start) * t;
    } catch {}
    if (t >= 1) {
      if (ambientFadeHandle) {
        clearInterval(ambientFadeHandle);
        ambientFadeHandle = null;
      }
      onDone?.();
    }
  }, stepMs);
}

/**
 * Starts the looping cosmic ambience (fades in). Call when the star map screen
 * gains focus; safe to call repeatedly.
 */
export async function startCosmicAmbient(): Promise<void> {
  if (Platform.OS === 'web') return;
  const enabled = await getSoundEffectsEnabled();
  if (!enabled) return;
  try {
    await ensureAudioMode();
    if (!ambientPlayer) {
      ambientPlayer = createAudioPlayer(COSMIC_AMBIENT_ASSET);
      ambientPlayer.loop = true;
    }
    ambientPlayer.volume = 0;
    try {
      ambientPlayer.seekTo(0);
    } catch {}
    ambientPlayer.play();
    fadeAmbient(0.32, 1400);
  } catch (err) {
    logger.log('[SoundEffects] Cosmic ambient start notice:', err);
  }
}

/**
 * Fades out and pauses the cosmic ambience. Call when the star map screen
 * loses focus or unmounts.
 */
export function stopCosmicAmbient(): void {
  if (!ambientPlayer) return;
  fadeAmbient(0, 900, () => {
    try {
      ambientPlayer?.pause();
    } catch {}
  });
}

/**
 * Light crystal chime played when a star is tapped on the sky map.
 *
 * Goes through the shared player pool (warmed up at startup) like every other effect.
 * A throwaway `createAudioPlayer()` per tap lets the JS object be garbage-collected,
 * which releases the native player before it has loaded/played anything (silent on iOS).
 */
export const playCelestialChime = () =>
  Platform.OS === 'web' ? Promise.resolve() : playSoundEffect('celestial_chime');
