import React from 'react';
import {
  AccessoryWidgetBackground,
  Circle,
  HStack,
  Image,
  Rectangle,
  Spacer,
  Text,
  VStack,
  ZStack,
} from '@expo/ui/swift-ui';
import {
  aspectRatio,
  background,
  clipShape,
  containerBackground,
  font,
  foregroundStyle,
  frame,
  kerning,
  lineLimit,
  minimumScaleFactor,
  opacity,
  padding,
  resizable,
  shapes,
  widgetAccentedRenderingMode,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

/**
 * Sözleşme: src/utils/widgetBridge.ts → CoupleWidgetPayload (alanlar birebir aynı olmalı).
 * Bu dosya izole bir çalışma zamanında koşar: hook, async, dış import ve modül kapsamı
 * değişkeni KULLANILAMAZ. Tüm sabitler/yardımcılar bileşenin içinde tanımlanır.
 *
 * Tasarım: gece moru zemin + gül rengi ışıltı, halkalı çift fotoğrafları, büyük gün sayacı ve
 * sıradaki dönüm noktası (yıl dönümü ya da 100'ün katı günler). Android karşılığı:
 * plugins/android-widget/ (aynı içerik ve renkler).
 */
export interface CoupleWidgetProps {
  state?: 'ready' | 'locked' | 'signedOut';
  myName?: string;
  partnerName?: string;
  startDate?: string | null;
  premiumUntilMs?: number | null;
  partnerMoodEmoji?: string | null;
  partnerMoodLabel?: string | null;
  moodDate?: string | null;
  myAvatarPath?: string | null;
  partnerAvatarPath?: string | null;
}

export function CoupleWidgetView(props: CoupleWidgetProps, env: WidgetEnvironment) {
  'widget';

  // ─── Renkler ───
  const BASE = '#170A20';
  const ROSE = '#FF5C8A';
  const BLUSH = '#FFC2D4';
  const LAVENDER = '#DCCBE6';
  const WHITE = '#FFFFFF';
  const GOLD = '#FFD27A';
  const CHIP = 'rgba(255, 255, 255, 0.13)';

  const family = env.widgetFamily;
  const fullColor = !env.widgetRenderingMode || env.widgetRenderingMode === 'fullColor';
  const now = env.date instanceof Date ? env.date : new Date();
  const state = props.state ?? 'signedOut';

  // Premium bittiği an widget uygulama açılmadan kendini kilitler
  const expired = state === 'ready' && !!props.premiumUntilMs && props.premiumUntilMs <= now.getTime();
  const ready = state === 'ready' && !expired;
  const locked = state === 'locked' || expired;

  // ─── Tarih hesapları (uygulamadaki sayaçla aynı: bugünün başlangıcı - başlangıç günü) ───
  const DAY_MS = 86400000;
  const pad2 = (n: number) => (n < 10 ? '0' + n : '' + n);
  const todayKey = now.getFullYear() + '-' + pad2(now.getMonth() + 1) + '-' + pad2(now.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const group = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  let start: Date | null = null;
  let days: number | null = null;
  if (props.startDate) {
    const p = props.startDate.split('-');
    const parsed = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    const diff = Math.round((today.getTime() - parsed.getTime()) / DAY_MS);
    if (!isNaN(diff)) {
      start = parsed;
      days = diff < 0 ? 0 : diff;
    }
  }

  // Sıradaki dönüm noktası: yıl dönümü ya da bir sonraki 100'ün katı gün (hangisi yakınsa)
  let milestone: string | null = null;
  if (start && days !== null) {
    const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
    const sm = start.getMonth();
    const sd = start.getDate();
    let year = today.getFullYear();
    let anniversary = new Date(year, sm, Math.min(sd, daysInMonth(year, sm)));
    if (anniversary.getTime() < today.getTime()) {
      year += 1;
      anniversary = new Date(year, sm, Math.min(sd, daysInMonth(year, sm)));
    }
    const toAnniversary = Math.round((anniversary.getTime() - today.getTime()) / DAY_MS);
    const years = year - start.getFullYear();
    const next100 = (Math.floor(days / 100) + 1) * 100;
    const toNext100 = next100 - days;

    if (years >= 1 && toAnniversary === 0) milestone = '🎉 ' + years + '. yıl dönümünüz kutlu olsun';
    else if (days > 0 && days % 100 === 0) milestone = '🎉 Bugün ' + group(days) + '. gününüz';
    else if (years >= 1 && toAnniversary <= toNext100) milestone = '🎂 ' + years + '. yıl dönümüne ' + toAnniversary + ' gün';
    else milestone = '✨ ' + group(next100) + '. güne ' + toNext100 + ' gün';
  }

  const partner = props.partnerName || 'Sevgilin';
  const me = props.myName || '';
  const names = me ? me + ' & ' + partner : partner;
  const moodVisible = !!props.partnerMoodEmoji && props.moodDate === todayKey;
  const moodText = moodVisible
    ? props.partnerMoodEmoji + ' ' + partner + (props.partnerMoodLabel ? ' · ' + props.partnerMoodLabel : '')
    : null;
  const daysText = days === null ? '—' : group(days);
  const initial = (name: string) => (name ? name.trim().charAt(0).toLocaleUpperCase('tr-TR') : '♥');
  const homeURL = 'couplesapp:///home';

  // ─── Kilit ekranı (accessory) aileleri: tek renkli, sistem tonuyla çizilir ───
  if (family === 'accessoryInline') {
    return (
      <Text modifiers={[widgetURL(homeURL)]}>
        {!ready ? 'Couples App ♥' : days === null ? '♥ Tarihinizi ekleyin' : '♥ ' + daysText + ' gündür birlikte'}
      </Text>
    );
  }

  if (family === 'accessoryCircular') {
    return (
      <ZStack modifiers={[widgetURL(ready ? homeURL : 'couplesapp:///paywall')]}>
        <AccessoryWidgetBackground />
        {ready && days !== null ? (
          <VStack spacing={0}>
            <Image systemName="heart.fill" size={10} />
            <Text modifiers={[font({ size: 17, weight: 'bold', design: 'rounded' }), minimumScaleFactor(0.45), lineLimit(1)]}>
              {daysText}
            </Text>
            <Text modifiers={[font({ size: 8, weight: 'semibold' }), kerning(0.6)]}>GÜN</Text>
          </VStack>
        ) : (
          <Image systemName={locked ? 'lock.fill' : 'heart.fill'} size={18} />
        )}
      </ZStack>
    );
  }

  if (family === 'accessoryRectangular') {
    if (!ready) {
      return (
        <HStack modifiers={[widgetURL(locked ? 'couplesapp:///paywall' : homeURL)]}>
          <VStack alignment="leading" spacing={2}>
            <HStack spacing={4}>
              <Image systemName={locked ? 'lock.fill' : 'heart.fill'} size={12} />
              <Text modifiers={[font({ size: 14, weight: 'bold' })]}>Couples App</Text>
            </HStack>
            <Text modifiers={[font({ size: 12 }), lineLimit(1), opacity(0.85)]}>
              {locked ? 'Premium ile kilidi aç' : 'Görmek için giriş yap'}
            </Text>
          </VStack>
          <Spacer />
        </HStack>
      );
    }
    return (
      <HStack modifiers={[widgetURL(homeURL)]}>
        <VStack alignment="leading" spacing={1}>
          <HStack spacing={4}>
            <Image systemName="heart.fill" size={12} />
            <Text modifiers={[font({ size: 15, weight: 'bold', design: 'rounded' }), lineLimit(1), minimumScaleFactor(0.7)]}>
              {days === null ? 'Tarihinizi ekleyin' : daysText + ' gündür birlikte'}
            </Text>
          </HStack>
          <Text modifiers={[font({ size: 12, weight: 'medium' }), lineLimit(1), minimumScaleFactor(0.8)]}>
            {moodText ?? names}
          </Text>
          {milestone ? (
            <Text modifiers={[font({ size: 11 }), lineLimit(1), minimumScaleFactor(0.8), opacity(0.8)]}>{milestone}</Text>
          ) : null}
        </VStack>
        <Spacer />
      </HStack>
    );
  }

  // ─── Ana ekran (system) aileleri ───
  const isSmall = family === 'systemSmall';
  const isLarge = family === 'systemLarge' || family === 'systemExtraLarge';
  const edge = isSmall ? 14 : 16;

  // Zemin: koyu mor degrade + sağ üstte gül rengi, sol altta mor ışıltı (renkli modda)
  const backdrop = fullColor ? (
    <ZStack>
      <Rectangle
        modifiers={[
          foregroundStyle({
            type: 'linearGradient',
            colors: ['#3F1240', '#1F0B2A', '#120818'],
            startPoint: { x: 0, y: 0 },
            endPoint: { x: 1, y: 1 },
          }),
        ]}
      />
      <Rectangle
        modifiers={[
          foregroundStyle({
            type: 'radialGradient',
            colors: ['rgba(255, 92, 138, 0.55)', 'rgba(255, 92, 138, 0)'],
            center: { x: 0.92, y: 0.04 },
            startRadius: 0,
            endRadius: isLarge ? 230 : isSmall ? 120 : 170,
          }),
        ]}
      />
      <Rectangle
        modifiers={[
          foregroundStyle({
            type: 'radialGradient',
            colors: ['rgba(150, 90, 255, 0.28)', 'rgba(150, 90, 255, 0)'],
            center: { x: 0.05, y: 1 },
            startRadius: 0,
            endRadius: isLarge ? 220 : 140,
          }),
        ]}
      />
    </ZStack>
  ) : null;

  const shell = (url: string, content: React.ReactNode) => (
    <ZStack modifiers={[containerBackground(BASE, 'widget'), widgetURL(url)]}>
      {backdrop}
      {content}
    </ZStack>
  );

  // Halkalı fotoğraf; fotoğraf yoksa degrade zeminde baş harf
  const avatar = (path: string | null | undefined, name: string, size: number) => {
    const ring = size >= 60 ? 3 : 2;
    return (
      <ZStack modifiers={[frame({ width: size + ring * 2, height: size + ring * 2 })]}>
        <Circle modifiers={[foregroundStyle(fullColor ? 'rgba(255, 255, 255, 0.92)' : 'rgba(255, 255, 255, 0.5)')]} />
        {path ? (
          <Image
            uiImage={path}
            modifiers={[
              resizable(),
              aspectRatio({ contentMode: 'fill' }),
              frame({ width: size, height: size }),
              clipShape('circle'),
              widgetAccentedRenderingMode('fullColor'),
            ]}
          />
        ) : (
          <ZStack modifiers={[frame({ width: size, height: size })]}>
            <Circle
              modifiers={[
                foregroundStyle({
                  type: 'linearGradient',
                  colors: ['#FF7AA2', '#8E3DB8'],
                  startPoint: { x: 0, y: 0 },
                  endPoint: { x: 1, y: 1 },
                }),
              ]}
            />
            <Text modifiers={[font({ size: size * 0.42, weight: 'bold', design: 'rounded' }), foregroundStyle(WHITE)]}>
              {initial(name)}
            </Text>
          </ZStack>
        )}
      </ZStack>
    );
  };

  const heartBadge = (size: number) => (
    <ZStack modifiers={[frame({ width: size, height: size })]}>
      <Circle modifiers={[foregroundStyle(WHITE)]} />
      <Image systemName="heart.fill" size={size * 0.5} color={ROSE} />
    </ZStack>
  );

  // İki fotoğraf zarifçe yan yana hafifçe örtüşür (yüzleri kapatan rozet olmadan temiz görünüm)
  const couple = (size: number, overlap: number) => (
    <HStack spacing={-overlap}>
      {avatar(props.myAvatarPath, me, size)}
      {avatar(props.partnerAvatarPath, partner, size)}
    </HStack>
  );

  const chip = (text: string, size: number) => (
    <Text
      modifiers={[
        font({ size, weight: 'semibold' }),
        foregroundStyle(WHITE),
        lineLimit(1),
        minimumScaleFactor(0.75),
        padding({ horizontal: 9, vertical: 5 }),
        background(CHIP, shapes.capsule()),
      ]}
    >
      {text}
    </Text>
  );

  const eyebrow = (size: number) => (
    <Text modifiers={[font({ size, weight: 'bold' }), kerning(1.4), foregroundStyle(BLUSH), lineLimit(1), minimumScaleFactor(0.7)]}>
      AŞKIMIZIN YOLCULUĞU
    </Text>
  );

  // ─── Kilitli / giriş yapılmamış ───
  if (!ready) {
    return shell(
      locked ? 'couplesapp:///paywall' : homeURL,
      <VStack spacing={isSmall ? 6 : 8} modifiers={[padding({ all: edge })]}>
        <ZStack modifiers={[frame({ width: isSmall ? 44 : 54, height: isSmall ? 44 : 54 })]}>
          <Circle modifiers={[foregroundStyle('rgba(255, 255, 255, 0.12)')]} />
          <Image
            systemName={locked ? 'crown.fill' : 'heart.fill'}
            size={isSmall ? 20 : 24}
            color={locked ? GOLD : ROSE}
          />
        </ZStack>
        <Text modifiers={[font({ size: isSmall ? 14 : 17, weight: 'bold', design: 'rounded' }), foregroundStyle(WHITE), lineLimit(1), minimumScaleFactor(0.8)]}>
          {locked ? 'Premium üyelere özel' : 'Couples App'}
        </Text>
        <Text modifiers={[font({ size: isSmall ? 11 : 13 }), foregroundStyle(LAVENDER), lineLimit(2), minimumScaleFactor(0.8)]}>
          {locked ? 'Sayacınızı ana ekranda görün' : 'Widget için giriş yap'}
        </Text>
        {isSmall ? null : chip(locked ? "Premium'a geç 👑" : 'Uygulamayı aç', 12)}
      </VStack>
    );
  }

  const counter = (numberSize: number, unitSize: number) => (
    <HStack spacing={5} alignment="lastTextBaseline">
      <Text
        modifiers={[
          font({ size: numberSize, weight: 'heavy', design: 'rounded' }),
          foregroundStyle(WHITE),
          minimumScaleFactor(0.5),
          lineLimit(1),
        ]}
      >
        {daysText}
      </Text>
      {days === null ? null : (
        <Text modifiers={[font({ size: unitSize, weight: 'bold', design: 'rounded' }), foregroundStyle(BLUSH)]}>gün</Text>
      )}
    </HStack>
  );

  const subtitle = (size: number) => (
    <Text modifiers={[font({ size, weight: 'medium' }), foregroundStyle(LAVENDER), lineLimit(1), minimumScaleFactor(0.8)]}>
      {days === null ? 'Tarihinizi uygulamadan ekleyin' : 'birlikte ♥ ' + names}
    </Text>
  );

  // ─── Küçük: fotoğraflar üstte, sayaç altta ───
  if (isSmall) {
    return shell(
      homeURL,
      <VStack alignment="leading" spacing={0} modifiers={[padding({ all: edge })]}>
        <HStack>
          {couple(38, 10)}
          <Spacer />
        </HStack>
        <Spacer />
        {counter(34, 14)}
        <Text modifiers={[font({ size: 11, weight: 'medium' }), foregroundStyle(LAVENDER), lineLimit(1), minimumScaleFactor(0.8)]}>
          {days === null ? 'Tarihinizi ekleyin' : 'gündür birlikte ♥'}
        </Text>
        {moodText || milestone ? (
          <Text modifiers={[font({ size: 10, weight: 'semibold' }), foregroundStyle(BLUSH), lineLimit(1), minimumScaleFactor(0.7), padding({ top: 4 })]}>
            {moodText ?? milestone}
          </Text>
        ) : null}
      </VStack>
    );
  }

  // ─── Büyük: ortada büyük fotoğraflar, altında sayaç ve kartlar ───
  if (isLarge) {
    return shell(
      homeURL,
      <VStack spacing={0} modifiers={[padding({ all: 20 })]}>
        <HStack>
          {eyebrow(11)}
          <Spacer />
          <Image systemName="heart.fill" size={14} color={ROSE} />
        </HStack>
        <Spacer />
        {couple(86, 18)}
        <Spacer />
        {counter(56, 20)}
        {subtitle(14)}
        <Spacer />
        <HStack spacing={8}>
          {moodText ? chip(moodText, 13) : null}
          {milestone ? chip(milestone, 13) : null}
        </HStack>
      </VStack>
    );
  }

  // ─── Orta: solda fotoğraflar, sağda sayaç ve kartlar ───
  return shell(
    homeURL,
    <HStack spacing={14} modifiers={[padding({ all: edge })]}>
      {couple(58, 14)}
      <VStack alignment="leading" spacing={3}>
        {eyebrow(10)}
        {counter(40, 16)}
        {subtitle(12)}
        <HStack spacing={6} modifiers={[padding({ top: 3 })]}>
          {moodText ? chip(moodText, 11) : null}
          {milestone && !moodText ? chip(milestone, 11) : null}
        </HStack>
      </VStack>
      <Spacer />
    </HStack>
  );
}

export const coupleWidget = createWidget<CoupleWidgetProps>('CoupleWidget', CoupleWidgetView);
