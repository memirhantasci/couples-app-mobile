// Kuş uçuş yolları için kübik Bézier yardımcıları.
// Fonksiyonlar 'worklet' olarak işaretlidir: Reanimated'in useAnimatedStyle içinden
// (UI iş parçacığında) doğrudan çağrılabilirler.

export interface Point {
  x: number;
  y: number;
}

/** t ∈ [0,1] için eğri üzerindeki nokta. */
export function cubicBezierPoint(t: number, p0: Point, p1: Point, p2: Point, p3: Point): Point {
  "worklet";
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return {
    x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
  };
}

/** t noktasındaki teğet (hareket yönü, normalize edilmemiş). */
export function cubicBezierTangent(t: number, p0: Point, p1: Point, p2: Point, p3: Point): Point {
  "worklet";
  const u = 1 - t;
  return {
    x: 3 * u * u * (p1.x - p0.x) + 6 * u * t * (p2.x - p1.x) + 3 * t * t * (p3.x - p2.x),
    y: 3 * u * u * (p1.y - p0.y) + 6 * u * t * (p2.y - p1.y) + 3 * t * t * (p3.y - p2.y),
  };
}

/** Bir hareket vektörünün "yukarıdan saat yönünde" derece cinsinden yönü (ekran koordinatları: y aşağı). */
export function headingDegrees(direction: Point): number {
  "worklet";
  return (Math.atan2(direction.x, -direction.y) * 180) / Math.PI;
}

/** 0..1 arası yumuşak geçiş (smoothstep). */
export function smoothstep(edge0: number, edge1: number, value: number): number {
  "worklet";
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}
