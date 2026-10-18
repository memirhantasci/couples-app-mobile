import React, { useCallback, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { BlurView } from "expo-blur";
import { BookHeart, Layers, Maximize2, Navigation } from "lucide-react-native";

import { TourGuideButton } from "@/components/tour/TourGuideButton";
import { MapFilterChips } from "./MapFilterChips";
import { MapThemePicker } from "./MapThemePicker";
import type { FilterType, MapThemeType } from "./mapTypes";

interface MapControlBarProps {
  accent: string;
  isLight: boolean;
  /** Safe-area üst boşluğu (status bar / çentik). */
  topInset: number;
  isPremium: boolean;
  photoCount: number;
  noteCount: number;
  meetingCount: number;
  activeFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  mapTheme: MapThemeType;
  onMapThemeChange: (theme: MapThemeType) => void;
  isLocating: boolean;
  onOpenTour: () => void;
  onOpenStory: () => void;
  onFitAll: () => void;
  onLocate: () => void;
}

// ─── ÜST KONTROL ÇUBUĞU (Başlık, aksiyonlar, filtreler, tema menüsü) ──────────
export function MapControlBar({
  accent,
  isLight,
  topInset,
  isPremium,
  photoCount,
  noteCount,
  meetingCount,
  activeFilter,
  onFilterChange,
  mapTheme,
  onMapThemeChange,
  isLocating,
  onOpenTour,
  onOpenStory,
  onFitAll,
  onLocate,
}: MapControlBarProps) {
  const [showThemePicker, setShowThemePicker] = useState(false);

  const handleThemeSelect = useCallback(
    (next: MapThemeType) => {
      onMapThemeChange(next);
      setShowThemePicker(false);
    },
    [onMapThemeChange],
  );

  const actionBtnStyle = [
    styles.topActionBtn,
    {
      backgroundColor: isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.1)",
      borderColor: isLight ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.15)",
    },
  ];

  return (
    <View style={[styles.topBar, { paddingTop: topInset + 8 }]}>
      <BlurView
        tint={isLight ? "light" : "dark"}
        intensity={80}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.topBarMainRow}>
        <View style={styles.topBarTitleBlock}>
          <Text style={[styles.topBarTitle, { color: isLight ? "#1A1528" : "#FFFFFF" }]}>
            Aşk Haritası
          </Text>
          <Text
            style={[
              styles.topBarSub,
              { color: isLight ? "#6B6577" : "rgba(255,255,255,0.55)" },
            ]}
            numberOfLines={1}
          >
            {isPremium ? `${photoCount} Anı · ` : ""}
            {noteCount} Not · {meetingCount} Buluşma
          </Text>
        </View>

        {/* Aksiyon Butonları (Rehber, Hikaye, Tema, Sığdır, GPS) */}
        <View style={styles.topActionsGroup}>
          <TourGuideButton onPress={onOpenTour} />

          <TouchableOpacity
            style={actionBtnStyle}
            onPress={onOpenStory}
            activeOpacity={0.8}
            accessibilityLabel="Hikayemiz - Harita Özeti"
          >
            <BookHeart size={16} color={accent} />
          </TouchableOpacity>

          <TouchableOpacity
            style={actionBtnStyle}
            onPress={() => setShowThemePicker((open) => !open)}
            activeOpacity={0.8}
            accessibilityLabel="Harita Teması"
          >
            <Layers size={16} color={accent} />
          </TouchableOpacity>

          <TouchableOpacity
            style={actionBtnStyle}
            onPress={onFitAll}
            activeOpacity={0.8}
            accessibilityLabel="Tüm Pinleri Göster"
          >
            <Maximize2 size={16} color={accent} />
          </TouchableOpacity>

          <TouchableOpacity
            style={actionBtnStyle}
            onPress={onLocate}
            activeOpacity={0.8}
            accessibilityLabel="Konumuma Git"
          >
            {isLocating ? (
              <ActivityIndicator size={16} color={accent} />
            ) : (
              <Navigation size={16} color={accent} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <MapFilterChips
        accent={accent}
        isLight={isLight}
        isPremium={isPremium}
        photoCount={photoCount}
        noteCount={noteCount}
        meetingCount={meetingCount}
        activeFilter={activeFilter}
        onChange={onFilterChange}
      />

      {showThemePicker && (
        <MapThemePicker
          accent={accent}
          isLight={isLight}
          mapTheme={mapTheme}
          onSelect={handleThemeSelect}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    overflow: "hidden",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.06)",
    zIndex: 20,
  },
  topBarMainRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  // Beş aksiyon butonu yer açsın diye başlık bloğu gerekirse daralır.
  topBarTitleBlock: {
    flex: 1,
    marginRight: 8,
  },
  topBarTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.4,
  },
  topBarSub: {
    fontSize: 11.5,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  topActionsGroup: {
    flexDirection: "row",
    gap: 8,
  },
  topActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
