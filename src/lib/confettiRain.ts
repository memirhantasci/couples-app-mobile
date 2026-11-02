// Kutlama yağmuru veriyolu: büyük anlarda (ör. kavuşma günü) bir ekran `rainConfetti()` çağırır;
// kökteki ConfettiRainHost ekranın tepesinden konfeti, parlak yıldız ve minik kalpler yağdırır.
// Kayıt sonrası küçük kutlamalar için değildir: yalnızca kullanıcının kendisinin tetiklediği anlar.

type Listener = () => void;

const listeners = new Set<Listener>();

/** Ekran boyunca konfeti yağdırır. Dinleyici yoksa (host bağlı değil) sessizce hiçbir şey yapmaz. */
export function rainConfetti(): void {
  listeners.forEach((listener) => listener());
}

export function subscribeConfettiRain(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
