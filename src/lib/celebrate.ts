// Küçük kutlama olayı veriyolu: bir ekran güzel bir an yaşandığında (günlük kaydedildi, ruh hali paylaşıldı,
// buluşma planlandı...) `celebrate()` çağırır; kökteki CelebrationHost yükselen kalpleri çizer.

export type CelebrationKind = "hearts" | "sparkles";

type Listener = (kind: CelebrationKind) => void;

const listeners = new Set<Listener>();

/** Ekranda kısa, tatlı bir kutlama animasyonu başlatır. Dinleyici yoksa sessizce hiçbir şey yapmaz. */
export function celebrate(kind: CelebrationKind = "hearts"): void {
  listeners.forEach((listener) => listener(kind));
}

export function subscribeCelebrate(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
