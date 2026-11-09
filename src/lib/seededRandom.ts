/**
 * Sabit tohumlu sözde rastgele sayı (0..1): parçacıklar ve süsler her çizimde aynı yere düşer.
 * Bağımlılığı yoktur; açılış animasyonu da kullandığı için bu dosyaya bileşen import edilmemeli.
 */
export function seeded(index: number, salt: number): number {
  const x = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}
