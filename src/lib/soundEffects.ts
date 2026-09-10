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
  | 'celebration';

const SOUND_ASSETS: Record<SoundEffectType, any> = {
  bubble_pop: require('../../assets/sounds/bubble_pop.wav'),
  letter_send: require('../../assets/sounds/letter_send.wav'),
  success_chime: require('../../assets/sounds/success_chime.wav'),
  stamp_drop: require('../../assets/sounds/stamp_drop.wav'),
  camera_click: require('../../assets/sounds/camera_click.wav'),
  celebration: require('../../assets/sounds/celebration.wav'),
};

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

/**
 * Trigger tactile haptic feedback matching the interaction.
 */
export async function triggerHaptic(type: SoundEffectType): Promise<void> {
  if (Platform.OS === 'web') return;
  const enabled = await getHapticFeedbackEnabled();
  if (!enabled) return;

  try {
    switch (type) {
      case 'bubble_pop':
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        break;
      case 'letter_send':
      case 'success_chime':
      case 'celebration':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        break;
      case 'stamp_drop':
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        break;
      case 'camera_click':
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        break;
    }
  } catch {}
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
