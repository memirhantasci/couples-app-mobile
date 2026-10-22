import React from "react";
import { TouchableOpacity, StyleSheet, Dimensions } from "react-native";
import { StorageImage } from "@/components/common/StorageImage";
import type { PhotoItem } from "./photoTypes";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface PhotoGrid3CellProps {
  item: PhotoItem;
  index: number;
  onPress: (index: number) => void;
}

// ─── 3 SÜTUNLU KOMPAKT IZGARA HÜCRESİ ────────────────────────────────────────
function PhotoGrid3CellBase({ item, index, onPress }: PhotoGrid3CellProps) {
  const itemSize = (SCREEN_WIDTH - 32 - 12) / 3;
  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={() => onPress(index)}
      style={[styles.grid3Box, { width: itemSize, height: itemSize }]}
    >
      <StorageImage
        bucket="photos"
        path={item.thumb_path ?? item.storage_path}
        style={styles.grid3Img}
        contentFit="cover"
        cachePolicy="memory-disk"
        recyclingKey={item.id.toString()}
      />
    </TouchableOpacity>
  );
}

export const PhotoGrid3Cell = React.memo(PhotoGrid3CellBase);

const styles = StyleSheet.create({
  grid3Box: {
    borderRadius: 14,
    overflow: "hidden",
    margin: 3,
    backgroundColor: "rgba(128,128,128,0.16)", // yüklenirken görünen nötr yer tutucu: açık ve koyu zeminde okunur
  },
  grid3Img: {
    width: "100%",
    height: "100%",
  },
});
