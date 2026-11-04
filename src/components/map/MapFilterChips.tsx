import { useMemo, type ReactNode } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity } from "react-native";
import { Calendar, Camera, Sparkles, StickyNote } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";

import type { FilterType } from "./mapTypes";
import { useTranslation } from "react-i18next";

interface MapFilterChipsProps {
  accent: string;
  isLight: boolean;
  showPhotos: boolean;
  photoCount: number;
  noteCount: number;
  meetingCount: number;
  activeFilter: FilterType;
  onChange: (filter: FilterType) => void;
  /** Çiplerin önünde, aynı satırda kayan ek düğme (ör. "Aşk Rotamız") */
  leading?: ReactNode;
}

interface FilterOption {
  id: FilterType;
  label: string;
  icon: LucideIcon;
}

// ─── KATEGORİ FİLTRE ÇİPLERİ (Tümü / Fotoğraflar / Notlar / Buluşmalar) ─────
export function MapFilterChips({
  accent,
  isLight,
  showPhotos,
  photoCount,
  noteCount,
  meetingCount,
  activeFilter,
  onChange,
  leading,
}: MapFilterChipsProps) {
  const { t } = useTranslation();
  const options = useMemo<FilterOption[]>(
    () => [
      {
        id: "all",
        label: t("letters.filters.all", { total: (showPhotos ? photoCount : 0) + noteCount + meetingCount }),
        icon: Sparkles,
      },
      // Fotoğraf filtresi yalnızca gösterilecek fotoğraf varsa (ya da Premium ile yüklenebilecekse)
      ...(showPhotos
        ? [{ id: "photos" as const, label: t("map.filters.photos", { total: photoCount }), icon: Camera }]
        : []),
      { id: "notes", label: t("map.filters.notes", { total: noteCount }), icon: StickyNote },
      { id: "meetings", label: t("map.filters.meetups", { total: meetingCount }), icon: Calendar },
    ],
    [showPhotos, photoCount, noteCount, meetingCount, t],
  );

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.filterRow}
    >
      {leading}
      {options.map((item) => {
        const isSelected = activeFilter === item.id;
        const ItemIcon = item.icon;
        return (
          <TouchableOpacity
            key={item.id}
            onPress={() => onChange(item.id)}
            style={[
              styles.filterChip,
              isSelected
                ? { backgroundColor: accent, shadowColor: accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 }
                : {
                    backgroundColor: isLight ? "rgba(255,255,255,0.92)" : "rgba(30,30,36,0.78)",
                  },
            ]}
            activeOpacity={0.8}
          >
            <ItemIcon size={14} color={isSelected ? "#fff" : isLight ? "#555" : "#aaa"} />
            <Text
              style={[
                styles.filterChipText,
                {
                  color: isSelected ? "#fff" : isLight ? "#333" : "rgba(255,255,255,0.75)",
                },
              ]}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  filterRow: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 8,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 38,
    paddingHorizontal: 15,
    borderRadius: 19,
  },
  filterChipText: {
    fontSize: 12.5,
    fontFamily: "Inter_600SemiBold",
  },
});
