// ─── Toast / Yüzen Hap Bildirimleri ─────────────────────────────────────────────
// Kullanıcıyı "Tamam"a bastırmadan 2-3 saniye süzülüp kaybolan bildirimler.
// Hook gerektirmez: bağlamlardan, olay yöneticilerinden ve yardımcı fonksiyonlardan
// doğrudan `toast.success("...")` çağrılabilir. Görüntüleme `ToastHost` tarafından yapılır.
//
// Not: Toast ana ekran ağacının üstünde çizilir; açık bir <Modal> (veya iOS'ta
// `presentation: "modal"` rota) varsa onun ARKASINDA kalır. Bir modal kapanırken tetikleniyorsa
// `delay` ile kapanışı bekleyin; modal içinde kalan doğrulama hataları için Alert kullanın.

export type ToastVariant = "success" | "info" | "warning" | "error";

export interface ToastOptions {
  /** Pil içinde kalın yazılan kısa başlık (opsiyonel). */
  title?: string;
  /** Ekranda kalma süresi (ms). Verilmezse tür ve metin uzunluğuna göre belirlenir. */
  duration?: number;
  /** Gösterimi ertele (ms). Bir modal kapanırken tetikleniyorsa kapanışı beklemek için. */
  delay?: number;
  /** Gösterilirken dokunsal geri bildirim ver (varsayılan: true). Başka bir haptik zaten çalıyorsa false verin. */
  haptic?: boolean;
  /** Tür ikonu yerine gösterilecek emoji. */
  emoji?: string;
  /** Pile dokunulunca çalışır (pil ayrıca kapanır). */
  onPress?: () => void;
}

export interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
  title?: string;
  duration: number;
  haptic: boolean;
  emoji?: string;
  onPress?: () => void;
}

const MAX_QUEUE = 3;
const BASE_DURATION: Record<ToastVariant, number> = {
  success: 2400,
  info: 2600,
  warning: 3200,
  error: 3600,
};

let seq = 0;
let current: ToastItem | null = null;
let queue: ToastItem[] = [];
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

/** useSyncExternalStore aboneliği. */
export function subscribeToasts(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Şu an ekranda olan toast (yoksa null). */
export function getCurrentToast(): ToastItem | null {
  return current;
}

/** Uzun metinler için süreyi uzat: ilk 40 karakterden sonra her karakter +45 ms (en çok 5 sn). */
function resolveDuration(variant: ToastVariant, message: string, explicit?: number): number {
  if (typeof explicit === "number") return explicit;
  const extra = Math.max(0, message.length - 40) * 45;
  return Math.min(5000, BASE_DURATION[variant] + extra);
}

function isDuplicate(item: ToastItem, other: ToastItem | null): boolean {
  return !!other && other.message === item.message && other.variant === item.variant;
}

function enqueue(item: ToastItem) {
  // Aynı mesajın art arda tekrarı (çift dokunuş vb.) sessizce yutulur
  if (isDuplicate(item, current) || queue.some((queued) => isDuplicate(item, queued))) return;

  if (!current) {
    current = item;
    notify();
    return;
  }

  queue.push(item);
  if (queue.length > MAX_QUEUE) queue.shift();
}

/**
 * Host, çıkış animasyonu bitince çağırır: sıradaki toast'a geçer.
 * Kimlik eşleşmezse (eski bir pilin gecikmiş çağrısı) yok sayılır.
 */
export function finishToast(id: number) {
  if (!current || current.id !== id) return;
  current = queue.shift() ?? null;
  notify();
}

function show(message: string, variant: ToastVariant, options: ToastOptions = {}) {
  const text = message.trim();
  if (!text) return;

  const item: ToastItem = {
    id: ++seq,
    message: text,
    variant,
    title: options.title,
    duration: resolveDuration(variant, text, options.duration),
    haptic: options.haptic ?? true,
    emoji: options.emoji,
    onPress: options.onPress,
  };

  if (options.delay && options.delay > 0) {
    setTimeout(() => enqueue(item), options.delay);
  } else {
    enqueue(item);
  }
}

export const toast = {
  success: (message: string, options?: ToastOptions) => show(message, "success", options),
  info: (message: string, options?: ToastOptions) => show(message, "info", options),
  warning: (message: string, options?: ToastOptions) => show(message, "warning", options),
  error: (message: string, options?: ToastOptions) => show(message, "error", options),
};
