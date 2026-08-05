import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import { getCountdown, dayjs } from "@/lib/date";
import { MapPin } from "lucide-react-native";
import Animated, { FadeInUp } from "react-native-reanimated";

interface CountdownProps {
  targetDate: string;
  title: string;
}

export function MeetingCountdown({ targetDate, title }: CountdownProps) {
  const [countdown, setCountdown] = useState(getCountdown(targetDate));

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(getCountdown(targetDate));
    }, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  if (countdown.isPast) {
    return (
      <View style={[styles.card, { alignItems: "center" }]}>
        <Text style={{ fontSize: 28, marginBottom: 8 }}>🎉</Text>
        <Text style={{ fontSize: 15, fontWeight: "700", color: "#fff" }}>{title}</Text>
        <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 4 }}>
          Buluşma gerçekleşti!
        </Text>
      </View>
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
    <View style={styles.card}>
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
    </View>
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
});
