// ─── Özel Diyaloglar (Alert.alert yerine) ────────────────────────────────────────
// Ham sistem uyarısı (siyah/gri "OK" kutusu) yerine uygulamanın cam efektli, pastel tonlu
// diyalog kartını gösterir. `Alert.alert` ile BİREBİR aynı imza: `appAlert(title, message?, buttons?, options?)`.
//
//  • Yalnızca bilgi veren, aksiyonsuz kısa uyarılar → süzülen hap bildirimi (toast).
//  • Onay / seçim soran (birden çok düğme, onPress, destructive) ya da uzun metinli uyarılar → diyalog kartı.
//  • Bir <Modal> açıkken toast modalın ARKASINDA kalacağı için, modalın içine `<DialogHost embedded />`
//    yerleştirilmişse her uyarı o modalın içinde diyalog olarak çizilir.
//
// Hook gerektirmez: bağlamlardan ve yardımcı fonksiyonlardan doğrudan çağrılabilir. Görüntüleme `DialogHost` ile yapılır.

import { toast } from "@/lib/toast";
import i18n from "@/lib/i18n";

export type DialogTone = "info" | "success" | "warning" | "error" | "danger" | "question";

export interface DialogButton {
  text?: string;
  style?: "default" | "cancel" | "destructive";
  onPress?: () => void;
}

export interface DialogOptions {
  /** Arka plana dokunarak / geri tuşuyla kapatılabilir mi (varsayılan: true). */
  cancelable?: boolean;
  /** Düğmeye basmadan kapatıldığında çalışır. */
  onDismiss?: () => void;
  /** Rengi/ikonu belirler; verilmezse başlıktan ve düğmelerden çıkarılır. */
  tone?: DialogTone;
  /** İkon yerine gösterilecek emoji; verilmezse başlığın sonundaki emoji kullanılır. */
  emoji?: string;
  /** Her zaman diyalog kartı göster (toast'a düşürme). */
  forceDialog?: boolean;
}

export interface DialogItem {
  id: number;
  title: string;
  message?: string;
  buttons: DialogButton[];
  tone: DialogTone;
  emoji?: string;
  cancelable: boolean;
  onDismiss?: () => void;
}

export interface DialogState {
  current: DialogItem | null;
  /** Şu an diyaloğu çizmekle yükümlü modal-içi host (yoksa null: kök host çizer). */
  topHost: number | null;
}

const MAX_QUEUE = 5;
/** Toast'a düşürülebilecek en uzun mesaj (daha uzunu okunabilmesi için kartta gösterilir). */
const TOAST_MAX_CHARS = 110;

let seq = 0;
let hostSeq = 0;
let state: DialogState = { current: null, topHost: null };
let queue: DialogItem[] = [];
const hosts: number[] = [];
const listeners = new Set<() => void>();

function publish(next: Partial<DialogState>) {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
}

/** useSyncExternalStore aboneliği. */
export function subscribeDialogs(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getDialogState(): DialogState {
  return state;
}

// ─── Modal-içi host kaydı ───────────────────────────────────────────────────────

export function allocateDialogHostId(): number {
  return ++hostSeq;
}

export function registerDialogHost(id: number) {
  if (!hosts.includes(id)) hosts.push(id);
  publish({ topHost: hosts[hosts.length - 1] ?? null });
}

export function unregisterDialogHost(id: number) {
  const index = hosts.indexOf(id);
  if (index >= 0) hosts.splice(index, 1);
  publish({ topHost: hosts[hosts.length - 1] ?? null });
}

// ─── Başlık ayrıştırma: "Bilgi 🌸" → { title: "Bilgi", emoji: "🌸" } ──────────────────

function isEmojiCodePoint(cp: number): boolean {
  return (
    (cp >= 0x1f000 && cp <= 0x1faff) ||
    (cp >= 0x2600 && cp <= 0x27bf) ||
    (cp >= 0x2b00 && cp <= 0x2bff) ||
    (cp >= 0x2300 && cp <= 0x23ff) ||
    cp === 0xfe0f ||
    cp === 0x200d ||
    cp === 0x2764
  );
}

export function splitTrailingEmoji(text: string): { text: string; emoji?: string } {
  const chars = Array.from(text.trimEnd());
  let end = chars.length;
  while (end > 0) {
    const cp = chars[end - 1].codePointAt(0) ?? 0;
    if (isEmojiCodePoint(cp)) end -= 1;
    else break;
  }
  const emoji = chars.slice(end).join("").trim();
  const rest = chars.slice(0, end).join("").trim();
  // Başlığın tamamı emoji ise olduğu gibi bırak
  if (!emoji || !rest) return { text: text.trim() };
  return { text: rest, emoji };
}

function inferTone(title: string, buttons: DialogButton[]): DialogTone {
  if (buttons.some((b) => b.style === "destructive")) return "danger";
  if (buttons.length >= 2) return "question";
  if (/hata|başarısız|olmadı|yüklenemedi|silinemedi|kaydedilemedi|gönderilemedi|güncellenemedi/i.test(title)) return "error";
  if (/izin|dikkat|uyarı|sınır|geçersiz|eksik|bulunamadı|gerekli|biyolojik|belirlenmedi/i.test(title)) return "warning";
  if (/başar|tamam|kaydedildi|gönderildi|tebrik|harika/i.test(title)) return "success";
  return "info";
}

const TONE_TO_TOAST = {
  info: "info",
  success: "success",
  warning: "warning",
  error: "error",
  danger: "error",
  question: "info",
} as const;

function enqueue(item: DialogItem) {
  if (!state.current) {
    publish({ current: item });
    return;
  }
  queue.push(item);
  if (queue.length > MAX_QUEUE) queue.shift();
}

/**
 * Host, çıkış animasyonu bitince çağırır: sıradaki diyaloğa geçer, ardından düğmenin
 * `onPress`'ini (ya da arka plana dokunulduysa `onDismiss`'ini) çalıştırır.
 * Kimlik eşleşmezse (eski bir kartın gecikmiş çağrısı) yok sayılır.
 */
export function finishDialog(id: number, button?: DialogButton | null) {
  const item = state.current;
  if (!item || item.id !== id) return;
  publish({ current: queue.shift() ?? null });
  if (button) button.onPress?.();
  else item.onDismiss?.();
}

/**
 * `Alert.alert` yerine geçer.
 *
 * @example
 * appAlert("Hata", "Profil güncellenemedi. Lütfen tekrar deneyin.");
 * appAlert("Fotoğrafı Sil", "Emin misiniz?", [
 *   { text: "Vazgeç", style: "cancel" },
 *   { text: "Sil", style: "destructive", onPress: () => remove() },
 * ]);
 */
export function appAlert(
  title: string,
  message?: string,
  buttons?: DialogButton[],
  options: DialogOptions = {}
): void {
  const trimmedTitle = (title ?? "").trim();
  const trimmedMessage = message?.trim() || undefined;
  if (!trimmedTitle && !trimmedMessage) return;

  // Başlık verilmediyse mesaj başlık olur (aynı metin iki kez gösterilmez)
  const rawTitle = trimmedTitle || trimmedMessage || "";
  const rawMessage = trimmedTitle ? trimmedMessage : undefined;

  const list = buttons && buttons.length > 0 ? buttons : [];
  const { text: cleanTitle, emoji: titleEmoji } = splitTrailingEmoji(rawTitle);
  const tone = options.tone ?? inferTone(rawTitle, list);
  const emoji = options.emoji ?? titleEmoji;

  // Aksiyonsuz bilgi mesajı: kısa ise süzülen hap yeterli (modal açık değilse)
  const isInfoOnly =
    list.length === 0 ||
    (list.length === 1 && !list[0].onPress && list[0].style !== "destructive" && list[0].style !== "cancel");
  const modalHostOpen = state.topHost !== null;
  const bodyLength = (rawMessage ?? "").length;
  if (isInfoOnly && !options.forceDialog && !modalHostOpen && bodyLength <= TOAST_MAX_CHARS) {
    const variant = TONE_TO_TOAST[tone];
    if (rawMessage) {
      toast[variant](rawMessage, { title: cleanTitle || undefined, emoji });
    } else {
      toast[variant](cleanTitle, { emoji });
    }
    return;
  }

  enqueue({
    id: ++seq,
    title: cleanTitle || rawTitle,
    message: rawMessage,
    buttons: list.length > 0 ? list : [{ text: i18n.t("common.ok") }],
    tone,
    emoji,
    cancelable: options.cancelable ?? true,
    onDismiss: options.onDismiss,
  });
}

/** Evet/Hayır sorusu: `await confirmDialog({...})` → true (onaylandı) / false. */
export function confirmDialog(config: {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  tone?: DialogTone;
}): Promise<boolean> {
  return new Promise((resolve) => {
    appAlert(
      config.title,
      config.message,
      [
        { text: config.cancelText ?? i18n.t("common.cancel"), style: "cancel", onPress: () => resolve(false) },
        {
          text: config.confirmText ?? i18n.t("common.confirm"),
          style: config.destructive ? "destructive" : "default",
          onPress: () => resolve(true),
        },
      ],
      { onDismiss: () => resolve(false), tone: config.tone, forceDialog: true }
    );
  });
}

export const dialog = {
  alert: appAlert,
  confirm: confirmDialog,
};
