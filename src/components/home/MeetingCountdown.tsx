import React, { useState, useEffect, memo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Modal, Linking } from "react-native";
import { getCountdown, dayjs } from "@/lib/date";
import { MapPin, X, Navigation } from "lucide-react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { AppTheme } from "@/lib/theme";
import { UserAvatar } from "@/components/avatar/UserAvatar";
import { useCoupleAvatars } from "@/hooks/useCoupleAvatars";

export interface Meeting {
  id: number;
  title: string;
  meeting_datetime: string;
  location_name?: string;
  latitude?: number;
  longitude?: number;
  /** Buluşmayı planlayan kişi */
  user_id?: string | null;
}

interface CountdownProps {
  meeting: Meeting;
  theme: AppTheme;
}

export const MeetingCountdown = memo(function MeetingCountdown({ meeting, theme }: CountdownProps) {
  const targetDate = meeting.meeting_datetime;
  const title = meeting.title || "Buluşma";

  const [countdown, setCountdown] = useState(() => getCountdown(targetDate));
  const [showModal, setShowModal] = useState(false);
  // Planlayanın profil fotoğrafı varsa konum ikonunun yerine imza olarak görünür
  const { getAvatarUrl } = useCoupleAvatars();
  const plannerAvatarUrl = getAvatarUrl(meeting.user_id);

  useEffect(() => {
    if (countdown.isPast) return;

    const interval = setInterval(() => {
      const next = getCountdown(targetDate);
      setCountdown(next);
      if (next.isPast) {
        clearInterval(interval);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [targetDate, countdown.isPast]);

  const openDirections = () => {
    if (meeting.latitude && meeting.longitude) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${meeting.latitude},${meeting.longitude}`;
      Linking.openURL(url);
    }
  };

  const formattedDate = dayjs(targetDate).format("D MMMM");

  if (countdown.isPast) {
    return (
      <TouchableOpacity
        style={[styles.card, { alignItems: "center", backgroundColor: theme.cardBg }]}
        activeOpacity={0.8}
        onPress={() => setShowModal(true)}
      >
        <Text style={{ fontSize: 28, marginBottom: 8 }}>🎉</Text>
        <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: theme.text }}>{title}</Text>
        <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: theme.textMuted, marginTop: 4 }}>
          Buluşma gerçekleşti!
        </Text>
        <MeetingModal
          visible={showModal}
          onClose={() => setShowModal(false)}
          meeting={meeting}
          openDirections={openDirections}
          theme={theme}
        />
      </TouchableOpacity>
    );
  }

  const units = [
    { label: "GÜN", value: countdown.days },
    { label: "SAAT", value: countdown.hours },
    { label: "DAKİKA", value: countdown.minutes },
    { label: "SANİYE", value: countdown.seconds },
  ];

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, ...theme.cardShadow }]}
      activeOpacity={0.9}
      onPress={() => setShowModal(true)}
    >
      {/* Başlık Satırı */}
      <View style={styles.titleRow}>
        {plannerAvatarUrl ? (
          <UserAvatar uri={plannerAvatarUrl} size={28} borderWidth={1} />
        ) : (
          <View style={[styles.iconCircle, { backgroundColor: theme.pillAccentBg }]}>
            <MapPin size={13} color={theme.accent} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={[styles.sectionLabel, { color: theme.text }]}>Sıradaki Buluşma</Text>
          {meeting.location_name && (
            <Text style={[styles.locationText, { color: theme.textSecondary }]}>{meeting.location_name}</Text>
          )}
        </View>
        <Text style={[styles.dateChip, { color: theme.textMuted }]}>{formattedDate}</Text>
      </View>

      {/* Geri Sayım Kutuları */}
      <View style={styles.grid}>
        {units.map((unit, i) => (
          <View key={unit.label} style={[styles.unitBox, { backgroundColor: theme.unitBg, borderColor: theme.cardBorder }]}>
            <Animated.Text
              key={`${unit.value}-${i}`}
              entering={FadeInUp.duration(200)}
              style={[styles.unitValue, { color: theme.text }]}
            >
              {String(unit.value).padStart(2, "0")}
            </Animated.Text>
            <Text style={[styles.unitLabel, { color: theme.textMuted }]}>{unit.label}</Text>
          </View>
        ))}
      </View>

      <MeetingModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        meeting={meeting}
        openDirections={openDirections}
        theme={theme}
      />
    </TouchableOpacity>
  );
});

function MeetingModal({
  visible,
  onClose,
  meeting,
  openDirections,
  theme,
}: {
  visible: boolean;
  onClose: () => void;
  meeting: Meeting;
  openDirections: () => void;
  theme: AppTheme;
}) {
  const formattedDate = dayjs(meeting.meeting_datetime)
    .locale("tr")
    .format("DD MMMM YYYY, dddd - HH:mm");

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, ...theme.cardShadow }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Buluşma Detayları</Text>
            <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
              <X color={theme.textSecondary} size={24} />
            </TouchableOpacity>
          </View>

          <View style={{ gap: 16 }}>
            <View>
              <Text style={[styles.detailLabel, { color: theme.textMuted }]}>Başlık</Text>
              <Text style={[styles.detailValue, { color: theme.text }]}>{meeting.title || "Buluşma"}</Text>
            </View>

            <View>
              <Text style={[styles.detailLabel, { color: theme.textMuted }]}>Tarih & Saat</Text>
              <Text style={[styles.detailValue, { color: theme.text }]}>{formattedDate}</Text>
            </View>

            {meeting.location_name && (
              <View>
                <Text style={[styles.detailLabel, { color: theme.textMuted }]}>Konum</Text>
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}
                >
                  <MapPin color={theme.accent} size={16} />
                  <Text style={[styles.detailValue, { color: theme.text }]}>{meeting.location_name}</Text>
                </View>
              </View>
            )}

            {meeting.latitude && meeting.longitude && (
              <TouchableOpacity
                style={[styles.directionsBtn, { backgroundColor: "#22c55e" }]}
                onPress={openDirections}
              >
                <Navigation color="#fff" size={18} />
                <Text style={styles.directionsBtnText}>Yol Tarifi Al</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 0,
    borderRadius: 20,
    padding: 20,
    marginBottom: 18,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  iconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionLabel: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  locationText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.6)",
    marginTop: 1,
  },
  dateChip: {
    fontSize: 12,
    color: "rgba(255,255,255,0.5)",
    fontFamily: "Inter_500Medium",
  },
  grid: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  unitBox: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 0,
  },
  unitValue: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    fontVariant: ["tabular-nums"],
    lineHeight: 28,
  },
  unitLabel: {
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: "rgba(255,255,255,0.45)",
    marginTop: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    padding: 20,
  },
  modalContent: {
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  modalTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  detailLabel: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 12,
    marginBottom: 4,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  detailValue: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "500",
  },
  directionsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 12,
  },
  directionsBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
});
