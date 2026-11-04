import { AppState, Platform } from 'react-native';
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

// ─── Ses Havuzu, Soğuma Kalkanı ve Eşzamanlılık Sınırı ──────────────────────
// Hızlı art arda dokunuşta (spam-click) yerel ses motoruna ve titreşim motoruna binen yükü sınırlar:
//  1. Her ses tipi, kendi minimum aralığından sık gelen istekleri yerel motora hiç iletmeden düşürür.
//  2. Her tip sabit sayıda oynatıcıyla (round-robin) çalar; çalışma anında havuz büyümez.
//  3. Aynı anda en fazla MAX_ACTIVE_EFFECTS efekt çalar; fazlası için en eskisi susturulur.

/** Aynı sesin iki tetiklenmesi arasındaki en kısa süre (ms). */
const MIN_INTERVAL_MS: Record<SoundEffectType, number> = {
  bubble_pop: 60,
  celestial_chime: 120,
  stamp_drop: 120,
  camera_click: 150,
  success_chime: 300,
  letter_send: 350,
  celebration: 500,
};

/** Tip başına oynatıcı sayısı: ardışık tetiklemeler öncekini kesmeden üst üste yankılanır. */
const POOL_SIZE: Record<SoundEffectType, number> = {
  bubble_pop: 3,
  celestial_chime: 2,
  stamp_drop: 2,
  camera_click: 1,
  success_chime: 1,
  letter_send: 1,
  celebration: 1,
};

/** Fon müziği (cosmic_ambient) hariç, aynı anda çalabilecek efekt sayısı. */
const MAX_ACTIVE_EFFECTS = 4;
/** play() sonrası native `playing` bayrağı gecikebilir: bu süre boyunca efekt çalıyor sayılır. */
const START_GRACE_MS = 400;
/** Başa sarma bu sürede dönmezse beklemeden çalınır (sessiz kalmaktansa devam). */
const SEEK_TIMEOUT_MS = 80;

interface PlayerSlot {
  players: AudioPlayer[];
  index: number;
}

const soundPool = new Map<SoundEffectType, PlayerSlot>();
/** Bir kez çalmış oynatıcılar: yeni oynatıcı zaten başta olduğundan ilk çalışta sarma atlanır. */
const playedPlayers = new WeakSet<AudioPlayer>();
const activeEffects: { player: AudioPlayer; startedAt: number }[] = [];

// Saat ayarı değişse bile aralık negatife düşmesin diye monoton saat kullanılır
const nowMs = () => globalThis.performance?.now?.() ?? Date.now();

const lastPlayTimes = Object.fromEntries(
  (Object.keys(MIN_INTERVAL_MS) as SoundEffectType[]).map((type) => [type, Number.NEGATIVE_INFINITY])
) as Record<SoundEffectType, number>;
const lastHapticTimes = { ...lastPlayTimes };

/** Son tetiklenmeden beri yeterli süre geçtiyse zamanı işler ve true döner; aksi halde isteği düşürür. */
function passCooldown(times: Record<SoundEffectType, number>, type: SoundEffectType): boolean {
  const now = nowMs();
  if (now - times[type] < MIN_INTERVAL_MS[type]) return false;
  times[type] = now;
  return true;
}

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
      getOrCreateSlot(key);
    }
  } catch (err) {
    logger.log('[SoundEffects] Warm-up notice:', err);
  }
}

// Açılışla yarışmasın: ilk ekran çizildikten sonra arka planda hazırla (ilk dokunuşta yine de anında çalar,
// çünkü getOrCreateSlot eksik havuzu o an oluşturur)
setTimeout(() => {
  warmUpSoundEffects();
}, 3000);

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
    pauseAllEffects();
  }
  try {
    await AsyncStorage.setItem(STORAGE_KEY_SOUND, enabled ? 'true' : 'false');
  } catch (err) {
    logger.error('[SoundEffects] Error saving sound preference:', err);
  }
}

/**
 * Get whether haptic feedback is enabled (default: false). Titreşim her cihazda kapalı başlar; kullanıcı
 * Profil > Ses & Titreşim'den açabilir. Bir kez açan (ya da kapatan) kullanıcının seçimi korunur.
 */
export async function getHapticFeedbackEnabled(): Promise<boolean> {
  if (isHapticEnabledCache !== null) return isHapticEnabledCache;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_HAPTIC);
    isHapticEnabledCache = raw !== null ? raw === 'true' : false;
  } catch {
    isHapticEnabledCache = false;
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

const HEARTBEAT_GAP_MS = 140;

/** Kalp atışı ("lub-dub"): tok bir darbe, kısa bir ara, ardından daha hafif ikinci darbe. */
export async function hapticHeartbeat(): Promise<void> {
  await fireHaptic('stamp');
  await new Promise((resolve) => setTimeout(resolve, HEARTBEAT_GAP_MS));
  await fireHaptic('tap');
}

/**
 * Trigger tactile haptic feedback matching the interaction.
 * Tüm efektler platforma duyarlı `fireHaptic` üzerinden geçer (iOS'ta çağrılar öncekiyle aynıdır;
 * Android'de önerilen sistem dokunsal geri bildirimi kullanılır). Tercih kontrolü orada yapılır.
 * Sesin soğuma süresine bağlıdır: saniyede onlarca dokunuşta titreşim motoru yığılmaz.
 */
export async function triggerHaptic(type: SoundEffectType): Promise<void> {
  if (!passCooldown(lastHapticTimes, type)) return;
  await dispatchHaptic(type);
}

/** Soğuma kontrolü yapılmış bir efektin titreşimini verir (`playSoundEffect` kalkanı zaten geçti). */
async function dispatchHaptic(type: SoundEffectType): Promise<void> {
  switch (type) {
    case 'bubble_pop':
      // Ruh hali seçimi: akıcı tekerlek tıkı (eskiden hafif darbe)
      await fireHaptic('selection');
      break;
    case 'letter_send':
      // Mektup gönderimi titreşimsiz: yalnızca ses ve kuş animasyonu
      break;
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
 * Get or initialize the fixed-size player pool for a given sound effect.
 * Havuz tek seferde ve tam boyutta kurulur; sonradan yeni oynatıcı eklenmez.
 */
function getOrCreateSlot(type: SoundEffectType): PlayerSlot | null {
  const existing = soundPool.get(type);
  if (existing) return existing;
  const players: AudioPlayer[] = [];
  try {
    for (let i = 0; i < POOL_SIZE[type]; i++) {
      players.push(createAudioPlayer(SOUND_ASSETS[type]));
    }
  } catch (err) {
    // Yarım kalan havuz bırakılmaz: oluşanlar serbest bırakılır, sonraki istek yeniden dener
    for (const player of players) {
      try {
        player.remove();
      } catch {}
    }
    logger.log('[SoundEffects] Player creation fallback:', err);
    return null;
  }
  const slot: PlayerSlot = { players, index: 0 };
  soundPool.set(type, slot);
  return slot;
}

function isPlayerPlaying(player: AudioPlayer): boolean {
  try {
    return player.playing;
  } catch {
    return false;
  }
}

function safePause(player: AudioPlayer): void {
  try {
    player.pause();
  } catch {}
}

/** Havuzdaki tüm efekt oynatıcılarını durdurur (arka plan, ses kapatma). Fon müziğine dokunmaz. */
function pauseAllEffects(): void {
  activeEffects.length = 0;
  for (const slot of soundPool.values()) {
    for (const player of slot.players) {
      if (isPlayerPlaying(player)) safePause(player);
    }
  }
}

/**
 * Yeni bir efekt için eşzamanlılık yerini ayırır: biten sesler listeden düşer, sınır doluysa
 * en eski çalan efekt susturulur.
 */
function reserveActiveSlot(player: AudioPlayer): void {
  const now = nowMs();
  let kept = 0;
  for (const entry of activeEffects) {
    if (entry.player !== player && (now - entry.startedAt < START_GRACE_MS || isPlayerPlaying(entry.player))) {
      activeEffects[kept++] = entry;
    }
  }
  activeEffects.length = kept;
  while (activeEffects.length >= MAX_ACTIVE_EFFECTS) {
    safePause(activeEffects.shift()!.player);
  }
  activeEffects.push({ player, startedAt: now });
}

/**
 * expo-audio ses bitince otomatik başa dönmediği için çalmış oynatıcı başa sarılır. Sarma,
 * yerel kuyruğa binmesin diye beklenir; ama dönmezse ses kaybolmasın diye süre sınırı vardır.
 */
function rewind(player: AudioPlayer): Promise<void> {
  if (!playedPlayers.has(player)) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, SEEK_TIMEOUT_MS);
    const done = () => {
      clearTimeout(timer);
      resolve();
    };
    try {
      player.seekTo(0).then(done, done);
    } catch {
      done();
    }
  });
}

export interface PlaySoundOptions {
  /** false: yalnızca ses çalar; dokunsal geri bildirimi çağıran kendisi verir (çift titreşim olmasın). */
  haptic?: boolean;
}

/**
 * Play a specific sound effect and trigger its synchronized haptic feedback.
 */
export async function playSoundEffect(type: SoundEffectType, { haptic = true }: PlaySoundOptions = {}): Promise<void> {
  if (Platform.OS === 'web') return;

  // 0. Soğuma kalkanı: çok sık gelen istek ne sese ne titreşime iletilir
  if (!passCooldown(lastPlayTimes, type)) return;

  // 1. Trigger haptics immediately for responsive tactile feel
  if (haptic) dispatchHaptic(type).catch(() => {});

  // 2. Check if sound is enabled
  const soundEnabled = await getSoundEffectsEnabled();
  if (!soundEnabled) return;

  // 3. Play audio
  try {
    await ensureAudioMode();
    const slot = getOrCreateSlot(type);
    if (!slot) return;

    // Round-robin: ardışık tetiklemeler sıradaki oynatıcıya gider, öncekini kesmez
    const player = slot.players[slot.index];
    slot.index = (slot.index + 1) % slot.players.length;

    if (isPlayerPlaying(player)) safePause(player);
    reserveActiveSlot(player);
    await rewind(player);

    // Sarma beklenirken ses kapatıldıysa ya da uygulama arka plana geçtiyse çalma
    if (isSoundEnabledCache === false || AppState.currentState === 'background') return;

    player.play();
    playedPlayers.add(player);
  } catch (err) {
    logger.log('[SoundEffects] Play error (silent fallback):', err);
  }
}

// ─── Direct Ergonomic Shortcuts for Feature Screens ─────────────────────────

/**
 * Mood / emoji selector, heart taps (soft bubble pop)
 */
export const playBubblePop = (options?: PlaySoundOptions) => playSoundEffect('bubble_pop', options);

/**
 * Letter sent / origami flight (whoosh & twinkle)
 */
export const playLetterSend = (options?: PlaySoundOptions) => playSoundEffect('letter_send', options);

/**
 * Medicine taken (DRANK), completed health routine (crystal chime)
 */
export const playSuccessChime = (options?: PlaySoundOptions) => playSoundEffect('success_chime', options);

/**
 * Pin or memory sealed onto Love Map (soft wooden stamp tap)
 */
export const playStampDrop = (options?: PlaySoundOptions) => playSoundEffect('stamp_drop', options);

/**
 * Memory photo snapped or saved (camera shutter)
 */
export const playCameraClick = (options?: PlaySoundOptions) => playSoundEffect('camera_click', options);

/**
 * Love meter peak 90+ or relationship milestone celebration (harp glissando)
 */
export const playCelebration = (options?: PlaySoundOptions) => playSoundEffect('celebration', options);

// ─── Star Map Celestial Audio ───────────────────────────────────────────────

let ambientPlayer: AudioPlayer | null = null;
let ambientFadeHandle: ReturnType<typeof setInterval> | null = null;
/**
 * Her start / stop çağrısında artar. startCosmicAmbient oynatıcıyı kurmadan önce iki kez bekler
 * (ses ayarı, ses modu); bu sırada ekrandan çıkılıp stop çağrılırsa oynatıcı henüz yoktur ve stop
 * hiçbir şey yapamazdı: başlatma sonra devam edip sesi sonsuza kadar çalardı. Bekleme dönüşünde
 * numarası değişmiş bir başlatma vazgeçer.
 */
let ambientRequest = 0;
/** Ekran ortam sesini istiyor (start çağrıldı, stop çağrılmadı): arka plandan dönünce sürer. */
let ambientWanted = false;

function pauseAmbientNow(): void {
  if (ambientFadeHandle) {
    clearInterval(ambientFadeHandle);
    ambientFadeHandle = null;
  }
  try {
    ambientPlayer?.pause();
  } catch {}
}

// Arka plana geçince ses hemen susar (kısma zamanlayıcıları arka planda çalışmaz); öne dönünce,
// ekran hâlâ istiyorsa yeniden süzülerek gelir.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state !== 'active') {
      pauseAmbientNow();
      pauseAllEffects();
    } else if (ambientWanted) {
      if (!ambientPlayer) {
        // Başlatma arka plandayken geldi ve oynatıcıyı kurmadan döndü
        startCosmicAmbient().catch(() => {});
        return;
      }
      try {
        ambientPlayer.volume = 0;
        ambientPlayer.play();
        fadeAmbient(0.32, 1400);
      } catch {}
    }
  });
}

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
  const request = ++ambientRequest;
  ambientWanted = true;
  if (ambientFadeHandle) {
    clearInterval(ambientFadeHandle);
    ambientFadeHandle = null;
  }
  const enabled = await getSoundEffectsEnabled();
  if (request !== ambientRequest) return;
  if (!enabled) {
    ambientWanted = false;
    return;
  }
  try {
    await ensureAudioMode();
    // Bu arada durdurulduysa ya da yeniden başlatıldıysa çalma (sonraki çağrı kendi işini yapar)
    if (request !== ambientRequest) return;
    if (AppState.currentState !== 'active') return; // öne dönünce AppState dinleyicisi başlatır
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
  // Oynatıcı henüz kurulmamış olsa bile bekleyen bir başlatma iptal edilir
  ambientRequest += 1;
  ambientWanted = false;
  if (!ambientPlayer) return;
  // Arka planda kısma zamanlayıcısı çalışmaz: doğrudan durdur
  if (AppState.currentState !== 'active') {
    pauseAmbientNow();
    return;
  }
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
