import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Modal, Linking } from "react-native";
import { getCountdown, dayjs } from "@/lib/date";
import { MapPin, X, Navigation } from "lucide-react-native";
import Animated, { FadeInUp } from "react-native-reanimated";

interface Meeting {
  id: number;
  title: string;
  meeting_datetime: string;
  location_name?: string;
  latitude?: number;
  longitude?: number;
}

interface CountdownProps {
  meeting: Meeting;
}

export function MeetingCountdown({ meeting }: CountdownProps) {
  const targetDate = meeting.meeting_datetime;
  const title = meeting.title || "Buluşma";
  
  const [countdown, setCountdown] = useState(getCountdown(targetDate));
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(getCountdown(targetDate));
    }, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  const openDirections = () => {
    if (meeting.latitude && meeting.longitude) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${meeting.latitude},${meeting.longitude}`;
      Linking.openURL(url);
    }
  };

  if (countdown.isPast) {
    return (
      <TouchableOpacity 
        style={[styles.card, { alignItems: "center" }]} 
        activeOpacity={0.8}
        onPress={() => setShowModal(true)}
      >
        <Text style={{ fontSize: 28, marginBottom: 8 }}>🎉</Text>
        <Text style={{ fontSize: 15, fontWeight: "700", color: "#fff" }}>{title}</Text>
        <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 4 }}>
          Buluşma gerçekleşti!
        </Text>
        <MeetingModal 
          visible={showModal} 
          onClose={() => setShowModal(false)} 
          meeting={meeting} 
          openDirections={openDirections} 
        />
      </TouchableOpacity>
    );
  }

  const units = [
    { label: "Gün", value: countdown.days },
    { label: "Saat", value: countdown.hours },
    { label: "Dakika", value: countdown.minutes },
    { label: "Saniye", value: countdown.seconds },
  ];

  const formattedDate = dayjs(targetDate).tz("Europe/Istanbul").format("D MMMM dddd, HH:mm");

  return (
    <TouchableOpacity 
      style={styles.card}
      activeOpacity={0.8}
      onPress={() => setShowModal(true)}
    >
      <View style={styles.titleRow}>
        <View style={styles.iconBox}>
          <MapPin size={15} color="#D84257" />
        </View>
        <View>
          <Text style={styles.titleText}>{title}</Text>
          <Text style={styles.dateText}>{formattedDate}</Text>
        </View>
      </View>

      <View style={styles.grid}>
        {units.map((unit, i) => (
          <View key={unit.label} style={styles.unitBox}>
            <Animated.Text
              key={`${unit.value}-${i}`}
              entering={FadeInUp.duration(200)}
              style={styles.unitValue}
            >
              {String(unit.value).padStart(2, "0")}
            </Animated.Text>
            <Text style={styles.unitLabel}>{unit.label}</Text>
          </View>
        ))}
      </View>
      
      <MeetingModal 
        visible={showModal} 
        onClose={() => setShowModal(false)} 
        meeting={meeting} 
        openDirections={openDirections} 
      />
    </TouchableOpacity>
  );
}

function MeetingModal({ visible, onClose, meeting, openDirections }: { visible: boolean; onClose: () => void; meeting: Meeting; openDirections: () => void }) {
  const formattedDate = dayjs(meeting.meeting_datetime).locale("tr").format("DD MMMM YYYY, dddd - HH:mm");
  
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Buluşma Detayları</Text>
            <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
              <X color="rgba(255,255,255,0.5)" size={24} />
            </TouchableOpacity>
          </View>
          
          <View style={{ gap: 16 }}>
            <View>
              <Text style={styles.detailLabel}>Başlık</Text>
              <Text style={styles.detailValue}>{meeting.title || "Buluşma"}</Text>
            </View>
            
            <View>
              <Text style={styles.detailLabel}>Tarih & Saat</Text>
              <Text style={styles.detailValue}>{formattedDate}</Text>
            </View>
            
            {meeting.location_name && (
              <View>
                <Text style={styles.detailLabel}>Konum</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
                  <MapPin color="#ffd700" size={16} />
                  <Text style={styles.detailValue}>{meeting.location_name}</Text>
                </View>
              </View>
            )}
            
            {meeting.latitude && meeting.longitude && (
              <TouchableOpacity
                style={styles.directionsBtn}
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
    backgroundColor: "#181a20",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 20,
    padding: 20,
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(216,66,87,0.12)",
  },
  titleText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
  dateText: {
    fontSize: 11,
    color: "rgba(255,255,255,0.45)",
    marginTop: 2,
  },
  grid: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  unitBox: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  unitValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#D84257",
    fontVariant: ["tabular-nums"],
  },
  unitLabel: {
    fontSize: 9,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: "rgba(255,255,255,0.4)",
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#1c1c1e",
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
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
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
    marginBottom: 4,
    fontWeight: "500",
  },
  detailValue: {
    color: "#fff",
    fontSize: 15,
  },
  directionsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#22c55e",
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 12,
  },
  directionsBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  }
});
