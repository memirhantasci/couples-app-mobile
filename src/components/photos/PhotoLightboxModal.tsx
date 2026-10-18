import React from "react";
import { View, Text, TouchableOpacity, Modal, StatusBar, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { X, Trash2, Calendar, Clock, ChevronLeft, ChevronRight } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { dayjs } from "@/lib/date";
import type { AppTheme } from "@/lib/theme";
import type { PhotoItem } from "./photoTypes";

interface PhotoLightboxModalProps {
  /** `null` keeps the modal closed. */
  selectedIndex: number | null;
  photos: PhotoItem[];
  userId: string | null;
  theme: AppTheme;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onDelete: (id: number) => void;
}

// ─── ULTRA MODERN TAM EKRAN LIGHTBOX MODALI ──────────────────────────────────
export function PhotoLightboxModal({
  selectedIndex,
  photos,
  userId,
  theme,
  onClose,
  onPrev,
  onNext,
  onDelete,
}: PhotoLightboxModalProps) {
  const insets = useSafeAreaInsets();
  const currentPhoto = selectedIndex !== null && photos[selectedIndex] ? photos[selectedIndex] : null;

  return (
    <Modal
      visible={selectedIndex !== null}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.lightboxBackdrop}>
        <StatusBar hidden />

        {/* Lightbox Üst Bar */}
        <View style={[styles.lightboxHeader, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.lightboxCloseBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <X size={20} color="#ffffff" />
          </TouchableOpacity>

          {/* Sayaç (Örn: 5 / 48) */}
          {selectedIndex !== null && (
            <View style={styles.lightboxCounterBadge}>
              <Text style={styles.lightboxCounterText}>
                {selectedIndex + 1} / {photos.length}
              </Text>
            </View>
          )}

          {currentPhoto?.user_id === userId ? (
            <TouchableOpacity
              onPress={() => currentPhoto && onDelete(currentPhoto.id)}
              style={styles.lightboxDeleteBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Trash2 size={18} color="#ff5c77" />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 40 }} />
          )}
        </View>

        {/* Tam Ekran Fotoğraf Alanı & İleri/Geri Okları */}
        <View style={styles.lightboxMainArea}>
          {/* Önceki Fotoğraf Butonu */}
          {selectedIndex !== null && selectedIndex > 0 ? (
            <TouchableOpacity
              style={styles.lightboxNavLeftBtn}
              onPress={onPrev}
              activeOpacity={0.8}
            >
              <ChevronLeft size={24} color="#ffffff" />
            </TouchableOpacity>
          ) : null}

          {currentPhoto && (
            <Image
              source={{ uri: currentPhoto.image_url }}
              style={styles.lightboxImg}
              contentFit="contain"
            />
          )}

          {/* Sonraki Fotoğraf Butonu */}
          {selectedIndex !== null && selectedIndex < photos.length - 1 ? (
            <TouchableOpacity
              style={styles.lightboxNavRightBtn}
              onPress={onNext}
              activeOpacity={0.8}
            >
              <ChevronRight size={24} color="#ffffff" />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Alt Detay Kartı (Tarih, Başlık, Açıklama) */}
        {currentPhoto && (
          <View style={[styles.lightboxFooter, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.lightboxDateRow}>
              <View style={styles.lightboxDatePill}>
                <Calendar size={13} color={theme.accent} />
                <Text style={[styles.lightboxDateText, { color: theme.accent }]}>
                  {dayjs(currentPhoto.taken_date).locale("tr").format("DD MMMM YYYY")}
                </Text>
                {currentPhoto.taken_time ? (
                  <>
                    <Text style={{ color: "rgba(255,255,255,0.4)" }}>•</Text>
                    <Clock size={12} color="rgba(255,255,255,0.6)" />
                    <Text style={styles.lightboxTimeText}>{currentPhoto.taken_time.substring(0, 5)}</Text>
                  </>
                ) : null}
              </View>
            </View>

            {currentPhoto.title ? (
              <Text style={styles.lightboxTitle}>{currentPhoto.title}</Text>
            ) : null}

            {currentPhoto.description ? (
              <Text style={styles.lightboxDesc}>{currentPhoto.description}</Text>
            ) : null}
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  lightboxBackdrop: {
    flex: 1,
    backgroundColor: "#000000",
    justifyContent: "space-between",
  },
  lightboxHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingBottom: 10,
    zIndex: 10,
  },
  lightboxCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  lightboxCounterBadge: {
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
  },
  lightboxCounterText: {
    color: "#ffffff",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  lightboxDeleteBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,92,119,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  lightboxMainArea: {
    flex: 1,
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  lightboxImg: {
    width: "100%",
    height: "100%",
  },
  lightboxNavLeftBtn: {
    position: "absolute",
    left: 12,
    zIndex: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  lightboxNavRightBtn: {
    position: "absolute",
    right: 12,
    zIndex: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  lightboxFooter: {
    paddingHorizontal: 20,
    paddingTop: 16,
    backgroundColor: "rgba(0,0,0,0.85)",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
    gap: 6,
  },
  lightboxDateRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  lightboxDatePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  lightboxDateText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  lightboxTimeText: {
    fontSize: 11.5,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.7)",
  },
  lightboxTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#ffffff",
    letterSpacing: -0.2,
  },
  lightboxDesc: {
    fontSize: 13.5,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.75)",
    lineHeight: 19,
  },
});
