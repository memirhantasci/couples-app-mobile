import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Mail, CalendarClock } from "lucide-react-native";
import { dayjs } from "@/lib/date";

interface PendingLetter {
  id: number;
  unlock_date: string;
  sender?: { display_name?: string; username: string };
}

export function PendingLettersCard({ letters }: { letters: PendingLetter[] }) {
  if (!letters || letters.length === 0) return null;

  const today = dayjs().startOf("day");

  const pendingLetters = letters.filter((letter) => {
    const unlockDate = dayjs(letter.unlock_date);
    return !unlockDate.isBefore(today, "day");
  });

  if (pendingLetters.length === 0) return null;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Bekleyen Mektuplar</Text>

      <View style={{ gap: 8 }}>
        {pendingLetters.map((letter) => {
          const unlockDate = dayjs(letter.unlock_date);
          const daysLeft = unlockDate.diff(today, "day");
          const senderName =
            letter.sender?.display_name || letter.sender?.username || "Bilinmeyen";

          return (
            <View key={letter.id} style={styles.letterItem}>
              <View style={styles.iconBox}>
                <Mail size={16} color="#C4A15A" />
              </View>

              <View style={styles.textContainer}>
                <Text style={styles.senderText} numberOfLines={1}>
                  Kimden: {senderName}
                </Text>
                <View style={styles.dateRow}>
                  <CalendarClock size={10} color="rgba(255,255,255,0.45)" />
                  <Text style={styles.dateText}>
                    {unlockDate.tz("Europe/Istanbul").format("DD MMMM YYYY")}
                  </Text>
                </View>
              </View>

              <View style={styles.daysBox}>
                <Text style={styles.daysNumber}>{daysLeft}</Text>
                <Text style={styles.daysLabel}>gün kaldı</Text>
              </View>
            </View>
          );
        })}
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
  title: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 12,
  },
  letterItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "rgba(196,161,90,0.06)",
    borderWidth: 1,
    borderColor: "rgba(196,161,90,0.18)",
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(196,161,90,0.12)",
  },
  textContainer: {
    flex: 1,
  },
  senderText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#fff",
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  dateText: {
    fontSize: 11,
    color: "rgba(255,255,255,0.45)",
  },
  daysBox: {
    alignItems: "flex-end",
  },
  daysNumber: {
    fontSize: 17,
    fontWeight: "700",
    color: "#C4A15A",
  },
  daysLabel: {
    fontSize: 9,
    fontWeight: "600",
    color: "rgba(255,255,255,0.4)",
  },
});
