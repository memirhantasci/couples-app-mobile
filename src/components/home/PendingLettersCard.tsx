import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { dayjs } from "@/lib/date";

// ─── Tema Sabitleri ─────────────────────────────────────────────────────────
const PINK = "#ff4d6d";
const CARD_BG = "#231218";
const BORDER = "rgba(255,255,255,0.07)";

interface PendingLetter {
  id: number;
  unlock_date: string;
  sender?: { display_name?: string; username: string };
}

export function PendingLettersCard({ letters }: { letters: PendingLetter[] }) {
  const router = useRouter();
  if (!letters || letters.length === 0) return null;

  const today = dayjs().startOf("day");

  const pendingLetters = letters.filter((letter) => {
    const unlockDate = dayjs(letter.unlock_date);
    return !unlockDate.isBefore(today, "day");
  });

  if (pendingLetters.length === 0) return null;

  return (
    <View style={styles.card}>
      {/* Başlık + Tümünü Gör */}
      <View style={styles.headerRow}>
        <Text style={styles.title}>Bekleyen Mektuplar</Text>
        <TouchableOpacity onPress={() => router.push("/(tabs)/letters" as any)}>
          <Text style={styles.viewAll}>Tümünü Gör</Text>
        </TouchableOpacity>
      </View>

      <View style={{ gap: 10 }}>
        {pendingLetters.map((letter) => {
          const unlockDate = dayjs(letter.unlock_date);
          const daysLeft = unlockDate.diff(today, "day");
          const senderName =
            letter.sender?.display_name || letter.sender?.username || "Bilinmeyen";
          const formattedDate = unlockDate.format("D MMM");

          return (
            <View key={letter.id} style={styles.letterItem}>
              {/* Sol: Kırmızı X ikonu */}
              <View style={styles.iconCircle}>
                <Text style={styles.lockIcon}>✕</Text>
              </View>

              {/* Orta: İsim + önizleme */}
              <View style={styles.textBlock}>
                <Text style={styles.senderName}>{senderName}'tan Mektup</Text>
                <Text style={styles.previewText} numberOfLines={1}>
                  Gözlerini kapat ve oku...
                </Text>
                {/* Alt: gün kaldı badge */}
                <View style={styles.daysLeftBadge}>
                  <Text style={styles.daysLeftText}>{daysLeft} gün kaldı 🔒</Text>
                </View>
              </View>

              {/* Sağ: tarih */}
              <Text style={styles.dateText}>{formattedDate}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
  viewAll: {
    fontSize: 13,
    color: PINK,
    fontWeight: "600",
  },
  letterItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    padding: 14,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,77,109,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,77,109,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  lockIcon: {
    fontSize: 14,
    color: PINK,
    fontWeight: "700",
  },
  textBlock: {
    flex: 1,
    gap: 3,
  },
  senderName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
  previewText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.4)",
  },
  daysLeftBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,77,109,0.12)",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 4,
  },
  daysLeftText: {
    fontSize: 10,
    color: PINK,
    fontWeight: "600",
  },
  dateText: {
    fontSize: 11,
    color: "rgba(255,255,255,0.35)",
    fontWeight: "500",
  },
});
