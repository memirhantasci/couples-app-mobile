import React from "react";
import {
  Dimensions,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { BlurView } from "expo-blur";
import { StorageImage } from "@/components/common/StorageImage";
import { Navigation, X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRealTopInset } from "@/hooks/useRealTopInset";

import { dayjs } from "@/lib/date";
import { SwipeDismissView } from "@/components/ui/SwipeDismissView";
import { openDirections } from "./openDirections";
import type { PhotoPin } from "./mapTypes";

const { width: SW, height: SH } = Dimensions.get("window");

interface MapPhotoLightboxProps {
  /** `null` iken modal kapalıdır. */
  photo: PhotoPin | null;
  accent: string;
  onClose: () => void;
}

// ─── TAM EKRAN FOTOĞRAF LIGHTBOX MODAL ────────────────────────────────────────
export function MapPhotoLightbox({ photo, accent, onClose }: MapPhotoLightboxProps) {
  const insets = useSafeAreaInsets();
  const topInset = useRealTopInset();

  return (
    <Modal visible={!!photo} transparent animationType="fade" onRequestClose={onClose}>
      {photo && (
        // Aşağı kaydırarak kapat: zemin (karartma + bulanıklık) sürükledikçe saydamlaşır
        <SwipeDismissView
          onDismiss={onClose}
          backdropColor="rgba(0,0,0,0.95)"
          backdrop={<BlurView tint="dark" intensity={95} style={StyleSheet.absoluteFill} />}
        >
        <View style={styles.lightboxContainer}>
          <View style={[styles.lightboxHeader, { paddingTop: topInset + 10 }]}>
            <TouchableOpacity style={styles.lightboxCloseBtn} onPress={onClose}>
              <X size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.lightboxTitle} numberOfLines={1}>
              {photo.title || "Fotoğraf Anısı"}
            </Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.lightboxImageWrapper}>
            <StorageImage bucket="photos" path={photo.storage_path} style={styles.lightboxImage} contentFit="contain" />
          </View>

          <View style={[styles.lightboxFooter, { paddingBottom: insets.bottom + 16 }]}>
            <Text style={styles.lightboxDate}>
              📅 {dayjs(photo.taken_date).locale("tr").format("D MMMM YYYY")}
              {photo.location_name ? ` · 📍 ${photo.location_name}` : ""}
            </Text>
            {photo.description ? <Text style={styles.lightboxDesc}>{photo.description}</Text> : null}

            <TouchableOpacity
              style={[styles.lightboxDirectionsBtn, { backgroundColor: accent }]}
              onPress={() => openDirections(photo.latitude, photo.longitude)}
            >
              <Navigation size={15} color="#fff" />
              <Text style={styles.lightboxDirectionsText}>Bu Konuma Yol Tarifi Al</Text>
            </TouchableOpacity>
          </View>
        </View>
        </SwipeDismissView>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Karartma SwipeDismissView'de: sürüklerken saydamlaşabilsin diye burada renk yok
  lightboxContainer: {
    flex: 1,
    justifyContent: "space-between",
  },
  lightboxHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  lightboxCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  lightboxTitle: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    flex: 1,
    textAlign: "center",
    paddingHorizontal: 10,
  },
  lightboxImageWrapper: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  lightboxImage: {
    width: SW,
    height: SH * 0.65,
  },
  lightboxFooter: {
    paddingHorizontal: 20,
    gap: 8,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingTop: 16,
  },
  lightboxDate: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12.5,
    fontFamily: "Inter_500Medium",
  },
  lightboxDesc: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },
  lightboxDirectionsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 6,
  },
  lightboxDirectionsText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
});
