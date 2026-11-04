import { useCallback, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { BlurView } from "expo-blur";
import { BookHeart, Layers, Maximize2, Navigation, Route } from "lucide-react-native";

import { TourGuideButton } from "@/components/tour/TourGuideButton";
import { MapFilterChips } from "./MapFilterChips";
import { MapThemePicker } from "./MapThemePicker";
import type { FilterType, MapThemeType } from "./mapTypes";
import { useTranslation } from "react-i18next";

interface MapControlBarProps {
  accent: string;
  isLight: boolean;
  /** Safe-area üst boşluğu (status bar / çentik). */
  topInset: number;
  /** Fotoğraf pinleri sayılsın / filtrelensin mi (Premium ya da Premium bitse de gösterilecek fotoğraf var) */
  showPhotos: boolean;
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
  /** "Aşk Rotamız" turu sürüyor mu */
  isJourneyActive: boolean;
  onToggleJourney: () => void;
}

// ─── ÜST KONTROL ÇUBUĞU (Başlık, aksiyonlar, filtreler, tema menüsü) ──────────
export function MapControlBar({
  accent,
  isLight,
  topInset,
  showPhotos,
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
  isJourneyActive,
  onToggleJourney,
}: MapControlBarProps) {
  const { t } = useTranslation();
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
      backgroundColor: isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.12)",
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
            {t("notifications.push.map.subtitle")}
          </Text>
          <Text
            style={[
              styles.topBarSub,
              { color: isLight ? "#6B6577" : "rgba(255,255,255,0.55)" },
            ]}
            numberOfLines={1}
          >
            {[
              showPhotos ? t("map.summary.photos", { count: photoCount }) : null,
              t("map.summary.notes", { count: noteCount }),
              t("map.summary.meetups", { count: meetingCount }),
            ]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        </View>

        {/* Aksiyon Butonları (Rehber, Hikaye, Tema, Sığdır, GPS) */}
        <View style={styles.topActionsGroup}>
          <TourGuideButton onPress={onOpenTour} />

          <TouchableOpacity
            style={actionBtnStyle}
            onPress={onOpenStory}
            activeOpacity={0.8}
            accessibilityLabel={t("map.controls.storyA11y")}
          >
            <BookHeart size={16} color={accent} />
          </TouchableOpacity>

          <TouchableOpacity
            style={actionBtnStyle}
            onPress={() => setShowThemePicker((open) => !open)}
            activeOpacity={0.8}
            accessibilityLabel={t("map.theme.title")}
          >
            <Layers size={16} color={accent} />
          </TouchableOpacity>

          <TouchableOpacity
            style={actionBtnStyle}
            onPress={onFitAll}
            activeOpacity={0.8}
            accessibilityLabel={t("map.controls.showAllA11y")}
          >
            <Maximize2 size={16} color={accent} />
          </TouchableOpacity>

          <TouchableOpacity
            style={actionBtnStyle}
            onPress={onLocate}
            activeOpacity={0.8}
            accessibilityLabel={t("map.controls.myLocationA11y")}
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
        showPhotos={showPhotos}
        photoCount={photoCount}
        noteCount={noteCount}
        meetingCount={meetingCount}
        activeFilter={activeFilter}
        onChange={onFilterChange}
        leading={
          <TouchableOpacity
            onPress={onToggleJourney}
            activeOpacity={0.8}
            style={[
              styles.journeyChip,
              isJourneyActive
                ? { backgroundColor: accent, borderColor: accent }
                : {
                    backgroundColor: isLight ? "rgba(255,255,255,0.92)" : "rgba(30,30,36,0.78)",
                    borderColor: `${accent}88`,
                  },
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: isJourneyActive }}
            accessibilityLabel={isJourneyActive ? t("map.journey.close") : t("map.journey.button")}
          >
            <Route size={14} color={isJourneyActive ? "#fff" : accent} />
            <Text style={[styles.journeyChipText, { color: isJourneyActive ? "#fff" : accent }]}>
              {t("map.journey.button")}
            </Text>
          </TouchableOpacity>
        }
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
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    zIndex: 20,
  },
  topBarMainRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  // Beş aksiyon butonu yer açsın diye başlık bloğu gerekirse daralır.
  topBarTitleBlock: {
    flex: 1,
    marginRight: 8,
  },
  topBarTitle: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.8,
  },
  topBarSub: {
    fontSize: 12.5,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  topActionsGroup: {
    flexDirection: "row",
    gap: 8,
  },
  topActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  journeyChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 38,
    paddingHorizontal: 15,
    borderRadius: 19,
    borderWidth: 1.5,
  },
  journeyChipText: {
    fontSize: 12.5,
    fontFamily: "Inter_700Bold",
  },
});
