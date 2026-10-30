import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity } from "react-native";
import { Calendar, Camera, Sparkles, StickyNote } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";

import type { FilterType } from "./mapTypes";
import { useTranslation } from "react-i18next";

interface MapFilterChipsProps {
  accent: string;
  isLight: boolean;
  isPremium: boolean;
  photoCount: number;
  noteCount: number;
  meetingCount: number;
  activeFilter: FilterType;
  onChange: (filter: FilterType) => void;
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
  isPremium,
  photoCount,
  noteCount,
  meetingCount,
  activeFilter,
  onChange,
}: MapFilterChipsProps) {
  const { t } = useTranslation();
  const options = useMemo<FilterOption[]>(
    () => [
      {
        id: "all",
        label: t("letters.filters.all", { total: (isPremium ? photoCount : 0) + noteCount + meetingCount }),
        icon: Sparkles,
      },
      // Fotoğraf pinleri yalnızca Premium kullanıcılara açık
      ...(isPremium
        ? [{ id: "photos" as const, label: t("map.filters.photos", { total: photoCount }), icon: Camera }]
        : []),
      { id: "notes", label: t("map.filters.notes", { total: noteCount }), icon: StickyNote },
      { id: "meetings", label: t("map.filters.meetups", { total: meetingCount }), icon: Calendar },
    ],
    [isPremium, photoCount, noteCount, meetingCount, t],
  );

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.filterRow}
    >
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
                ? { backgroundColor: accent, borderColor: accent }
                : {
                    backgroundColor: isLight ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.08)",
                    borderColor: isLight ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.12)",
                  },
            ]}
            activeOpacity={0.8}
          >
            <ItemIcon size={12} color={isSelected ? "#fff" : isLight ? "#555" : "#aaa"} />
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
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 11.5,
    fontFamily: "Inter_600SemiBold",
  },
});
