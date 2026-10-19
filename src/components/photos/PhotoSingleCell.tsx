import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { Calendar, Clock, Trash2, Maximize2 } from "lucide-react-native";
import { dayjs } from "@/lib/date";
import type { AppTheme } from "@/lib/theme";
import type { PhotoItem } from "./photoTypes";

interface PhotoSingleCellProps {
  item: PhotoItem;
  index: number;
  isMine: boolean;
  theme: AppTheme;
  isLight: boolean;
  onPress: (index: number) => void;
  onDelete: (id: number) => void;
}

// ─── 1 SÜTUNLU BÜYÜK HİKAYE KARTI ────────────────────────────────────────────
function PhotoSingleCellBase({ item, index, isMine, theme, isLight, onPress, onDelete }: PhotoSingleCellProps) {
  const hasInfo = Boolean(item.title?.trim() || item.description?.trim());

  return (
    <View style={[styles.singleCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, ...theme.cardShadow }]}>
      {/* Üst Bilgi Barı */}
      <View style={styles.singleHeader}>
        <View style={[styles.singleDateBadge, { backgroundColor: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.06)" }]}>
          <Calendar size={13} color={theme.accent} />
          <Text style={[styles.singleDateText, { color: theme.text }]}>
            {dayjs(item.taken_date).locale("tr").format("DD MMMM YYYY")}
          </Text>
          {item.taken_time ? (
            <>
              <Text style={[styles.dotSeparator, { color: theme.textMuted }]}>•</Text>
              <Clock size={12} color={theme.textMuted} />
              <Text style={[styles.singleTimeText, { color: theme.textSecondary }]}>{item.taken_time.substring(0, 5)}</Text>
            </>
          ) : null}
        </View>

        {isMine && (
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => onDelete(item.id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Trash2 color="#ff5c77" size={15} />
          </TouchableOpacity>
        )}
      </View>

      {/* Fotoğraf Görseli (Tıklanınca Tam Ekran) */}
      <TouchableOpacity
        activeOpacity={0.92}
        onPress={() => onPress(index)}
        style={styles.singleTouchable}
      >
        <Image
          source={{ uri: item.image_url }}
          style={styles.singleImg}
          contentFit="cover"
          cachePolicy="memory-disk"
          recyclingKey={item.id.toString()}
        />
        <View style={styles.singleExpandBadge}>
          <Maximize2 size={13} color="#ffffff" />
        </View>
      </TouchableOpacity>

      {/* Başlık ve Açıklama Alanı */}
      {hasInfo ? (
        <View style={styles.singleInfoBox}>
          {item.title ? (
            <Text style={[styles.singleTitle, { color: theme.text }]} numberOfLines={2}>
              {item.title}
            </Text>
          ) : null}
          {item.description ? (
            <Text style={[styles.singleDescription, { color: theme.textSecondary }]}>
              {item.description}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export const PhotoSingleCell = React.memo(PhotoSingleCellBase);

const styles = StyleSheet.create({
  singleCard: {
    borderRadius: 22,
    borderWidth: 1,
    overflow: "hidden",
    padding: 14,
  },
  singleHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  singleDateBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  singleDateText: {
    fontSize: 12.5,
    fontFamily: "Inter_600SemiBold",
    color: "#ffffff",
  },
  dotSeparator: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 12,
  },
  singleTimeText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  deleteBtn: {
    backgroundColor: "rgba(255, 92, 119, 0.12)",
    padding: 7,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 92, 119, 0.25)",
  },
  singleTouchable: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 16,
    overflow: "hidden",
    position: "relative",
  },
  singleImg: {
    width: "100%",
    height: "100%",
  },
  singleExpandBadge: {
    position: "absolute",
    right: 10,
    bottom: 10,
    backgroundColor: "rgba(0,0,0,0.65)",
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  singleInfoBox: {
    paddingTop: 12,
  },
  singleTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: "#ffffff",
    marginBottom: 4,
  },
  singleDescription: {
    fontSize: 13.5,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.75)",
    lineHeight: 20,
  },
});
