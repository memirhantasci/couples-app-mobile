import React from "react";
import { View, Text, TouchableOpacity, Modal, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { X, Clock, Calendar as CalendarIcon } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { dayjs } from "@/lib/date";
import type { AppTheme } from "@/lib/theme";
import { SwipeDismissView } from "@/components/ui/SwipeDismissView";
import type { CalendarPhotoItem } from "./calendarTypes";

interface CalendarPhotoLightboxProps {
  /** `null` keeps the modal closed. */
  photo: CalendarPhotoItem | null;
  theme: AppTheme;
  getAuthorName: (userId: string | undefined | null) => string;
  onClose: () => void;
}

// ─── FOTOĞRAF TAM EKRAN (LIGHTBOX) MODALI ────────────────────────────────────
export function CalendarPhotoLightbox({ photo, theme, getAuthorName, onClose }: CalendarPhotoLightboxProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={!!photo}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      {/* Aşağı kaydırarak kapat: içerik parmağı izleyip küçülür, zemin saydamlaşır */}
      <SwipeDismissView onDismiss={onClose}>
      <View style={styles.lightboxBackdrop}>
        {/* Lightbox Üst Bar */}
        <View style={[styles.lightboxHeader, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.lightboxCloseBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <X size={20} color="#ffffff" />
          </TouchableOpacity>

          <View style={styles.lightboxDatePill}>
            <CalendarIcon size={13} color={theme.accent} />
            <Text style={[styles.lightboxDateText, { color: theme.accent }]}>
              {photo ? dayjs(photo.taken_date).locale("tr").format("DD MMMM YYYY") : ""}
            </Text>
          </View>

          <View style={{ width: 40 }} />
        </View>

        {/* Tam Ekran Fotoğraf */}
        <View style={styles.lightboxMainArea}>
          {photo && (
            <Image
              source={{ uri: photo.image_url }}
              style={styles.lightboxImg}
              contentFit="contain"
            />
          )}
        </View>

        {/* Alt Bilgi Kartı */}
        {photo && (
          <View style={[styles.lightboxFooter, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.lightboxMetaRow}>
              <Text style={styles.lightboxAuthor}>
                {getAuthorName(photo.user_id)}
              </Text>
              {photo.taken_time && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Clock size={12} color="rgba(255,255,255,0.6)" />
                  <Text style={styles.lightboxTime}>{photo.taken_time.substring(0, 5)}</Text>
                </View>
              )}
            </View>

            {photo.title ? (
              <Text style={styles.lightboxTitle}>{photo.title}</Text>
            ) : null}

            {photo.description ? (
              <Text style={styles.lightboxDesc}>{photo.description}</Text>
            ) : null}
          </View>
        )}
      </View>
      </SwipeDismissView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Siyah zemin SwipeDismissView'de: sürüklerken saydamlaşabilsin diye burada renk yok
  lightboxBackdrop: {
    flex: 1,
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
  lightboxDatePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  lightboxDateText: {
    fontSize: 12.5,
    fontFamily: "Inter_600SemiBold",
  },
  lightboxMainArea: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  lightboxImg: {
    width: "100%",
    height: "100%",
  },
  lightboxFooter: {
    paddingHorizontal: 20,
    paddingTop: 16,
    backgroundColor: "rgba(0,0,0,0.85)",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
    gap: 6,
  },
  lightboxMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  lightboxAuthor: {
    fontSize: 13.5,
    fontFamily: "Inter_700Bold",
    color: "#ffffff",
  },
  lightboxTime: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.6)",
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
