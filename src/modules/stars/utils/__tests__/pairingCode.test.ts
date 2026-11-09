/// <reference types="jest" />
import { extractPairingCode, isCompletePairingCode, normalizePairingCode } from '../pairingCode';

jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { t: (key: string) => key } }));

describe('stars/utils/pairingCode', () => {
  it('Türkçe İ / ı harflerini I yapar (lib ile aynı davranış)', () => {
    expect(normalizePairingCode('Kİ7M2X')).toBe('KI7M2X');
    expect(normalizePairingCode('kı7m2x')).toBe('KI7M2X');
  });

  it('panodaki metinden İ içeren kodu bozmadan ayıklar', () => {
    expect(extractPairingCode('Kodum: KİKİ12 💕')).toBe('KIKI12');
    expect(extractPairingCode('Kodum: K7M2XQ 💕')).toBe('K7M2XQ');
  });

  it('tam kodu doğrular', () => {
    expect(isCompletePairingCode('KIKI12')).toBe(true);
    expect(isCompletePairingCode('KIKI1')).toBe(false);
  });
});
