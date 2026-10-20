import React from 'react';
import { HStack, Image, Spacer, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import {
  background,
  clipShape,
  containerBackground,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  minimumScaleFactor,
  padding,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

/**
 * Sözleşme: src/utils/widgetBridge.ts → CoupleWidgetPayload (alanlar birebir aynı olmalı).
 * Bu dosya izole bir çalışma zamanında koşar: hook, async, dış import ve modül kapsamı
 * değişkeni KULLANILAMAZ. Tüm sabitler/yardımcılar bileşenin içinde tanımlanır.
 */
export interface CoupleWidgetProps {
  state?: 'ready' | 'locked' | 'signedOut';
  myName?: string;
  partnerName?: string;
  startDate?: string | null;
  premiumUntil?: string | null;
  partnerMoodEmoji?: string | null;
  partnerMoodLabel?: string | null;
  moodDate?: string | null;
  myAvatarPath?: string | null;
  partnerAvatarPath?: string | null;
}

export function CoupleWidgetView(props: CoupleWidgetProps, env: WidgetEnvironment) {
  'widget';

  const BG = '#1E0F24';
  const ACCENT = '#FF4D6D';
  const MUTED = '#C9B8D1';
  const WHITE = '#FFFFFF';

  const family = env.widgetFamily;
  const now = env.date instanceof Date ? env.date : new Date();
  const state = props.state ?? 'signedOut';

  // Premium bittiği an widget uygulama açılmadan kendini kilitler
  let locked = state === 'locked';
  if (state === 'ready' && props.premiumUntil) {
    const until = new Date(props.premiumUntil).getTime();
    if (!isNaN(until) && until <= now.getTime()) locked = true;
  }

  const pad2 = (n: number) => (n < 10 ? '0' + n : '' + n);
  const todayKey = now.getFullYear() + '-' + pad2(now.getMonth() + 1) + '-' + pad2(now.getDate());

  // Uygulamadaki sayaçla aynı: bugünün başlangıcı - başlangıç günü (negatif olamaz)
  let days: number | null = null;
  if (props.startDate) {
    const p = props.startDate.split('-');
    const start = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diff = Math.round((today.getTime() - start.getTime()) / 86400000);
    if (!isNaN(diff)) days = diff < 0 ? 0 : diff;
  }

  const moodVisible = !!props.partnerMoodEmoji && props.moodDate === todayKey;
  const partner = props.partnerName || 'Sevgilin';
  const me = props.myName || '';
  const initial = (name: string) => (name ? name.trim().charAt(0).toUpperCase() : '♥');
  const daysText = days === null ? '—' : String(days);

  // ─── Kilit ekranı (accessory) aileleri ───
  if (family === 'accessoryInline') {
    if (state !== 'ready' || locked) {
      return <Text modifiers={[widgetURL('couplesapp:///home')]}>Couples App ❤️</Text>;
    }
    return (
      <Text modifiers={[widgetURL('couplesapp:///home')]}>
        {'❤️ ' + daysText + ' gündür birlikte'}
      </Text>
    );
  }

  if (family === 'accessoryCircular') {
    return (
      <VStack spacing={0} modifiers={[widgetURL('couplesapp:///home')]}>
        <Text modifiers={[font({ size: 11 })]}>{state === 'ready' && !locked ? '❤️' : '👑'}</Text>
        <Text modifiers={[font({ size: 17, weight: 'bold' }), minimumScaleFactor(0.5), lineLimit(1)]}>
          {state === 'ready' && !locked ? daysText : '—'}
        </Text>
      </VStack>
    );
  }

  if (family === 'accessoryRectangular') {
    if (state !== 'ready' || locked) {
      return (
        <VStack alignment="leading" spacing={2} modifiers={[widgetURL('couplesapp:///home')]}>
          <Text modifiers={[font({ size: 13, weight: 'bold' })]}>Couples App ❤️</Text>
          <Text modifiers={[font({ size: 11 })]}>
            {state === 'locked' || locked ? 'Premium üyelere özel 👑' : 'Giriş yap'}
          </Text>
        </VStack>
      );
    }
    return (
      <VStack alignment="leading" spacing={2} modifiers={[widgetURL('couplesapp:///home')]}>
        <Text modifiers={[font({ size: 13, weight: 'bold' }), lineLimit(1)]}>
          {'❤️ ' + daysText + ' gündür birlikte'}
        </Text>
        <Text modifiers={[font({ size: 11 }), lineLimit(1)]}>
          {moodVisible ? props.partnerMoodEmoji + ' ' + partner + ': ' + (props.partnerMoodLabel || '') : partner}
        </Text>
      </VStack>
    );
  }

  // ─── Ana ekran (system) aileleri ───
  const isSmall = family === 'systemSmall';
  const avatarSize = isSmall ? 40 : 56;

  const avatar = (path: string | null | undefined, name: string, mood: boolean) => (
    <ZStack alignment="bottomTrailing" modifiers={[frame({ width: avatarSize, height: avatarSize })]}>
      <ZStack modifiers={[frame({ width: avatarSize, height: avatarSize }), clipShape('circle'), background('#3A2144')]}>
        {path ? (
          <Image
            uiImage={path}
            modifiers={[frame({ width: avatarSize, height: avatarSize }), clipShape('circle')]}
          />
        ) : (
          <Text modifiers={[font({ size: avatarSize * 0.42, weight: 'bold' }), foregroundStyle(ACCENT)]}>
            {initial(name)}
          </Text>
        )}
      </ZStack>
      {mood ? (
        <Text modifiers={[font({ size: isSmall ? 15 : 20 })]}>{props.partnerMoodEmoji}</Text>
      ) : null}
    </ZStack>
  );

  if (state !== 'ready' || locked) {
    const isLocked = state === 'locked' || locked;
    return (
      <VStack
        spacing={6}
        modifiers={[
          padding({ all: 4 }),
          containerBackground(BG, 'widget'),
          widgetURL(isLocked ? 'couplesapp:///paywall' : 'couplesapp:///home'),
        ]}
      >
        <Text modifiers={[font({ size: isSmall ? 26 : 32 })]}>{isLocked ? '👑' : '❤️'}</Text>
        <Text modifiers={[font({ size: isSmall ? 13 : 16, weight: 'bold' }), foregroundStyle(WHITE)]}>
          {isLocked ? 'Premium üyelere özel' : 'Couples App'}
        </Text>
        <Text
          modifiers={[
            font({ size: isSmall ? 11 : 13 }),
            foregroundStyle(MUTED),
            lineLimit(2),
            minimumScaleFactor(0.8),
          ]}
        >
          {isLocked ? 'Widget için Premium’a geç' : 'Widget’ı kullanmak için giriş yap'}
        </Text>
      </VStack>
    );
  }

  const daysBlock = (
    <VStack alignment={isSmall ? 'center' : 'leading'} spacing={0}>
      <Text
        modifiers={[
          font({ size: isSmall ? 30 : 40, weight: 'heavy', design: 'rounded' }),
          foregroundStyle(WHITE),
          minimumScaleFactor(0.6),
          lineLimit(1),
        ]}
      >
        {daysText}
      </Text>
      <Text modifiers={[font({ size: isSmall ? 11 : 13, weight: 'medium' }), foregroundStyle(MUTED), lineLimit(1)]}>
        {days === null ? 'Tarih ekle' : 'gündür birlikte ❤️'}
      </Text>
    </VStack>
  );

  const moodLine = moodVisible ? (
    <Text modifiers={[font({ size: 12 }), foregroundStyle(MUTED), lineLimit(1), minimumScaleFactor(0.8)]}>
      {partner + ': ' + (props.partnerMoodLabel || '')}
    </Text>
  ) : null;

  if (isSmall) {
    return (
      <VStack
        spacing={8}
        modifiers={[padding({ all: 2 }), containerBackground(BG, 'widget'), widgetURL('couplesapp:///home')]}
      >
        <HStack spacing={-8} alignment="center">
          {avatar(props.myAvatarPath, me, false)}
          {avatar(props.partnerAvatarPath, partner, moodVisible)}
        </HStack>
        {daysBlock}
      </VStack>
    );
  }

  return (
    <HStack
      spacing={16}
      alignment="center"
      modifiers={[padding({ all: 4 }), containerBackground(BG, 'widget'), widgetURL('couplesapp:///home')]}
    >
      <HStack spacing={-10} alignment="center">
        {avatar(props.myAvatarPath, me, false)}
        {avatar(props.partnerAvatarPath, partner, moodVisible)}
      </HStack>
      <VStack alignment="leading" spacing={4}>
        {daysBlock}
        {moodLine}
      </VStack>
      <Spacer />
    </HStack>
  );
}

export const coupleWidget = createWidget<CoupleWidgetProps>('CoupleWidget', CoupleWidgetView);
