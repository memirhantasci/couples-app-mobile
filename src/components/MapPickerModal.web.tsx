import React from "react";
import { View, Text, StyleSheet, Modal, TouchableOpacity } from "react-native";
import { X, MapPin } from "lucide-react-native";
import { useTranslation } from "react-i18next";

export interface LocationData {
  latitude: number;
  longitude: number;
  locationName?: string;
}

interface MapPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectLocation: (location: LocationData) => void;
  initialLocation?: LocationData;
  title?: string;
}

export function MapPickerModal({
  visible,
  onClose,
  onSelectLocation,
  title,
}: MapPickerModalProps) {
  const { t } = useTranslation();
  const resolvedTitle = title ?? t("map.picker.defaultTitle");
  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <X size={18} color="#FFFFFF" />
          </TouchableOpacity>
          <MapPin size={40} color="#38BDF8" style={{ marginBottom: 12 }} />
          <Text style={styles.title}>{resolvedTitle}</Text>
          <Text style={styles.desc}>
            {t("map.picker.webNote")}
          </Text>
          <TouchableOpacity
            onPress={() => {
              onSelectLocation({
                latitude: 41.0082,
                longitude: 28.9784,
                locationName: "İstanbul",
              });
              onClose();
            }}
            style={styles.actionBtn}
          >
            <Text style={styles.actionBtnText}>{t("map.picker.webDefault")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#0F0C1E",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  closeBtn: {
    position: "absolute",
    top: 16,
    right: 16,
    padding: 4,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
  desc: {
    color: "rgba(255, 255, 255, 0.65)",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 20,
  },
  actionBtn: {
    backgroundColor: "#38BDF8",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
  },
  actionBtnText: {
    color: "#030207",
    fontSize: 13,
    fontWeight: "700",
  },
});
