import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from "react-native";
import { StorageImage } from "@/components/common/StorageImage";
import { Maximize2 } from "lucide-react-native";
import { dayjs } from "@/lib/date";
import type { AppTheme } from "@/lib/theme";
import type { PhotoItem } from "./photoTypes";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface PhotoGrid2CellProps {
  item: PhotoItem;
  index: number;
  theme: AppTheme;
  onPress: (index: number) => void;
}

// ─── 2 SÜTUNLU MODERN ESTETİK KART HÜCRESİ ───────────────────────────────────
function PhotoGrid2CellBase({ item, index, theme, onPress }: PhotoGrid2CellProps) {
  const itemWidth = (SCREEN_WIDTH - 32 - 10) / 2;

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={() => onPress(index)}
      style={[
        styles.grid2Card,
        { width: itemWidth, backgroundColor: theme.cardBg, borderColor: theme.cardBorder },
      ]}
    >
      <View style={styles.grid2ImgContainer}>
        <StorageImage
          bucket="photos"
          path={item.thumb_path ?? item.storage_path}
          style={styles.grid2Img}
          contentFit="cover"
          cachePolicy="memory-disk"
          recyclingKey={item.id.toString()}
        />

        <View style={styles.grid2ExpandBadge}>
          <Maximize2 size={11} color="#ffffff" />
        </View>
      </View>

      <View style={styles.grid2Details}>
        <Text style={[styles.grid2Date, { color: theme.textMuted }]} numberOfLines={1}>
          {dayjs(item.taken_date).locale("tr").format("D MMM YYYY")}
        </Text>

        {item.title ? (
          <Text style={[styles.grid2Title, { color: theme.text }]} numberOfLines={1}>
            {item.title}
          </Text>
        ) : (
          <Text style={[styles.grid2EmptySub, { color: theme.textMuted }]}>Özel Hatıra ✨</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

export const PhotoGrid2Cell = React.memo(PhotoGrid2CellBase);

const styles = StyleSheet.create({
  grid2Card: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
  },
  grid2ImgContainer: {
    width: "100%",
    aspectRatio: 1,
    position: "relative",
  },
  grid2Img: {
    width: "100%",
    height: "100%",
  },
  grid2ExpandBadge: {
    position: "absolute",
    right: 8,
    bottom: 8,
    backgroundColor: "rgba(0,0,0,0.6)",
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  grid2Details: {
    padding: 10,
  },
  grid2Date: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.5)",
  },
  grid2Title: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#ffffff",
    marginTop: 2,
  },
  grid2EmptySub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.35)",
    marginTop: 2,
  },
});
