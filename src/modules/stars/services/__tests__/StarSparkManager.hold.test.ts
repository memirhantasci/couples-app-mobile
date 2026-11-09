/// <reference types="jest" />

import {
  HOLD_HEARTBEAT_MS,
  MAX_HOLD_MS,
  PARTNER_HOLD_TTL_MS,
  StarSparkManager,
} from '../StarSparkManager';

/**
 * Senkron dokunuş (basılı tutma) mantığı: sahte Realtime kanalı ve sahte zamanlayıcıyla.
 * İki telefonda titreşimin gerçekten aynı anda hissedilmesi yalnızca gerçek cihazda denenebilir.
 */

type Handler = (response: { payload: unknown }) => void;

const mockChannel = {
  handlers: new Map<string, Handler>(),
  sent: [] as { event: string; payload: { holding: boolean; senderId: string } }[],
  on: jest.fn(),
  subscribe: jest.fn(),
  send: jest.fn(),
};

jest.mock('@/lib/supabase', () => ({
  supabase: {
    channel: jest.fn(() => mockChannel),
    removeChannel: jest.fn(() => Promise.resolve('ok')),
  },
}));
jest.mock('@/lib/soundEffects', () => ({ hapticTap: jest.fn(() => Promise.resolve()) }));
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { t: (key: string) => key } }));
jest.mock('@/utils/logger', () => ({ logger: { warn: jest.fn(), error: jest.fn() } }));
jest.mock('../../api/starService', () => ({
  starService: { sendSpark: jest.fn() },
  SparkCooldownException: class SparkCooldownException extends Error {},
}));

const ME = 'user-me';
const PARTNER = 'user-partner';

function partnerSends(holding: boolean, senderId = PARTNER) {
  mockChannel.handlers.get('hold')?.({ payload: { starId: 's1', senderId, holding, timestamp: '' } });
}

const heldFlags = () => mockChannel.sent.map((message) => message.payload.holding);

async function setup() {
  const manager = new StarSparkManager({ starId: 's1', senderId: ME, senderName: 'Ben' });
  const onTogetherChange = jest.fn();
  const onPartnerHoldChange = jest.fn();
  await manager.subscribeToResonance({ onTogetherChange, onPartnerHoldChange });
  return { manager, onTogetherChange, onPartnerHoldChange };
}

beforeEach(() => {
  jest.useFakeTimers();
  mockChannel.handlers.clear();
  mockChannel.sent = [];
  mockChannel.on.mockImplementation((type: string, filter: { event: string }, callback: Handler) => {
    if (type === 'broadcast') mockChannel.handlers.set(filter.event, callback);
    return mockChannel;
  });
  mockChannel.subscribe.mockResolvedValue('SUBSCRIBED');
  mockChannel.send.mockImplementation((message: { event: string; payload: { holding: boolean; senderId: string } }) => {
    mockChannel.sent.push(message);
    return Promise.resolve('ok');
  });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('StarSparkManager: senkron dokunuş', () => {
  it('basılı tutunca hemen sinyal yollar, sonra yarım saniyede bir yeniler; bırakınca durdurup bildirir', async () => {
    const { manager } = await setup();

    manager.setHolding(true);
    expect(heldFlags()).toEqual([true]);

    jest.advanceTimersByTime(HOLD_HEARTBEAT_MS * 3);
    expect(heldFlags()).toEqual([true, true, true, true]);

    manager.setHolding(false);
    expect(heldFlags()).toEqual([true, true, true, true, false]);

    jest.advanceTimersByTime(HOLD_HEARTBEAT_MS * 5);
    expect(mockChannel.sent).toHaveLength(5);
  });

  it('aynı durumu tekrar bildirmek ikinci bir zamanlayıcı kurmaz', async () => {
    const { manager } = await setup();

    manager.setHolding(true);
    manager.setHolding(true);
    jest.advanceTimersByTime(HOLD_HEARTBEAT_MS);
    expect(heldFlags()).toEqual([true, true]);

    manager.setHolding(false);
    manager.setHolding(false);
    expect(heldFlags()).toEqual([true, true, false]);
  });

  it('yalnızca ikisi de basılı tutarken "birlikte" olur ve yalnızca değişimde bildirir', async () => {
    const { manager, onTogetherChange, onPartnerHoldChange } = await setup();

    partnerSends(true);
    expect(onPartnerHoldChange).toHaveBeenLastCalledWith(true);
    expect(onTogetherChange).not.toHaveBeenCalled();

    manager.setHolding(true);
    expect(onTogetherChange).toHaveBeenCalledTimes(1);
    expect(onTogetherChange).toHaveBeenLastCalledWith(true);

    // Partner sinyali yenilemeye devam ederken ikinci bir "birlikte" bildirimi gelmez
    partnerSends(true);
    expect(onTogetherChange).toHaveBeenCalledTimes(1);

    manager.setHolding(false);
    expect(onTogetherChange).toHaveBeenCalledTimes(2);
    expect(onTogetherChange).toHaveBeenLastCalledWith(false);
  });

  it('önce ben, sonra partner basarsa da birlikte olur; partner bırakınca biter', async () => {
    const { manager, onTogetherChange } = await setup();

    manager.setHolding(true);
    expect(onTogetherChange).not.toHaveBeenCalled();

    partnerSends(true);
    expect(onTogetherChange).toHaveBeenLastCalledWith(true);

    partnerSends(false);
    expect(onTogetherChange).toHaveBeenLastCalledWith(false);
  });

  it('partnerden sinyal kesilirse (bağlantı koptu) bıraktı sayılır, takılı kalmaz', async () => {
    const { manager, onTogetherChange, onPartnerHoldChange } = await setup();

    manager.setHolding(true);
    partnerSends(true);
    expect(onTogetherChange).toHaveBeenLastCalledWith(true);

    jest.advanceTimersByTime(PARTNER_HOLD_TTL_MS + 1);
    expect(onPartnerHoldChange).toHaveBeenLastCalledWith(false);
    expect(onTogetherChange).toHaveBeenLastCalledWith(false);
  });

  it('partner sinyali yenilendikçe süre uzar', async () => {
    const { manager, onTogetherChange } = await setup();

    manager.setHolding(true);
    partnerSends(true);
    for (let i = 0; i < 6; i++) {
      jest.advanceTimersByTime(HOLD_HEARTBEAT_MS);
      partnerSends(true);
    }
    expect(onTogetherChange).toHaveBeenCalledTimes(1);
    expect(onTogetherChange).toHaveBeenLastCalledWith(true);
  });

  it('kendi yankımızı yok sayar', async () => {
    const { manager, onTogetherChange, onPartnerHoldChange } = await setup();

    manager.setHolding(true);
    partnerSends(true, ME);

    expect(onPartnerHoldChange).not.toHaveBeenCalled();
    expect(onTogetherChange).not.toHaveBeenCalled();
  });

  it('bozuk yükü yok sayar', async () => {
    const { manager, onTogetherChange } = await setup();
    manager.setHolding(true);

    mockChannel.handlers.get('hold')?.({ payload: undefined });
    mockChannel.handlers.get('hold')?.({ payload: { senderId: PARTNER, holding: 'yes' } });

    expect(onTogetherChange).not.toHaveBeenCalled();
  });

  it(`tek bir basılı tutuş ${MAX_HOLD_MS / 1000} saniyede yumuşakça biter`, async () => {
    const { manager, onTogetherChange } = await setup();

    manager.setHolding(true);
    partnerSends(true);
    expect(onTogetherChange).toHaveBeenLastCalledWith(true);

    // Partner sinyali yenilemeyi sürdürür; sınırı dolduran taraf bizim
    for (let elapsed = 0; elapsed < MAX_HOLD_MS; elapsed += HOLD_HEARTBEAT_MS) {
      jest.advanceTimersByTime(HOLD_HEARTBEAT_MS);
      partnerSends(true);
    }

    expect(onTogetherChange).toHaveBeenLastCalledWith(false);
    expect(heldFlags().at(-1)).toBe(false);

    // Parmak hâlâ ekrandaysa bile yeniden başlamaz
    const sentAtLimit = mockChannel.sent.length;
    jest.advanceTimersByTime(HOLD_HEARTBEAT_MS * 4);
    expect(mockChannel.sent).toHaveLength(sentAtLimit);
  });

  it('basılı tutarken ekrandan çıkılırsa bırakma sinyali gider ve durum sıfırlanır', async () => {
    const { manager, onTogetherChange } = await setup();

    manager.setHolding(true);
    partnerSends(true);
    expect(onTogetherChange).toHaveBeenLastCalledWith(true);

    await manager.unsubscribe();

    expect(heldFlags().at(-1)).toBe(false);
    expect(onTogetherChange).toHaveBeenLastCalledWith(false);

    const sentAfter = mockChannel.sent.length;
    jest.advanceTimersByTime(MAX_HOLD_MS);
    expect(mockChannel.sent).toHaveLength(sentAfter);
  });

  it('kanal yokken (abonelik öncesi) basılı tutmak hata vermez ve birlikte olmaz', () => {
    const manager = new StarSparkManager({ starId: 's1', senderId: ME });
    expect(() => manager.setHolding(true)).not.toThrow();
    expect(() => manager.setHolding(false)).not.toThrow();
  });
});
