'widget';
import React from 'react';
import { VStack, HStack, Text, Spacer } from '@expo/ui/swift-ui';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

export interface CoupleWidgetProps {
  partnerName?: string;
  daysTogether?: number;
  moodEmoji?: string;
  moodLabel?: string;
  dailyNote?: string;
  nextMeetingTitle?: string;
  nextMeetingDays?: number;
}

export function CoupleWidgetView(
  props: CoupleWidgetProps,
  _context?: WidgetEnvironment
) {
  const days = props?.daysTogether ?? 142;
  const moodEmoji = props?.moodEmoji ?? '🥰';
  const moodLabel = props?.moodLabel ?? 'Aşk Dolu';
  const partner = props?.partnerName ?? 'Sevgilin';
  const note =
    props?.dailyNote ||
    props?.nextMeetingTitle ||
    'Bugün birbirinize sarılmayı unutmayın 🌸';

  return (
    <VStack alignment="leading" spacing={8}>
      <HStack alignment="center">
        <Text>Couples App ❤️</Text>
        <Spacer />
        <Text>{days}. Gün</Text>
      </HStack>

      <VStack alignment="leading" spacing={4}>
        <Text>{moodEmoji} {partner}: {moodLabel}</Text>
        <Text>{note}</Text>
      </VStack>

      <Spacer />

      <HStack>
        <Spacer />
        <Text>Uygulamayı Aç ›</Text>
      </HStack>
    </VStack>
  );
}

export const coupleWidget = createWidget('CoupleWidget', CoupleWidgetView);
