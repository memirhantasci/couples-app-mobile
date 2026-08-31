import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { dayjs } from "@/lib/date";
import { AppTheme } from "@/lib/theme";

interface PendingLetter {
  id: number;
  unlock_date: string;
  sender?: { display_name?: string; username: string };
}

export function PendingLettersCard({ letters, theme }: { letters: PendingLetter[]; theme: AppTheme }) {
  const router = useRouter();
  if (!letters || letters.length === 0) return null;

  const today = dayjs().startOf("day");

  const pendingLetters = letters.filter((letter) => {
    const unlockDate = dayjs(letter.unlock_date);
    return !unlockDate.isBefore(today, "day");
  });

  if (pendingLetters.length === 0) return null;

  return (
    <View style={[styles.card, { backgroundColor: theme.cardBg }]}>
      {/* Başlık + Tümünü Gör */}
      <View style={styles.headerRow}>
        <Text style={styles.title}>Bekleyen Mektuplar</Text>
        <TouchableOpacity onPress={() => router.push("/(tabs)/letters" as any)}>
          <Text style={[styles.viewAll, { color: theme.accent }]}>Tümünü Gör</Text>
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
              <View style={[styles.iconCircle, { backgroundColor: `${theme.accent}26` }]}>
                <Text style={[styles.lockIcon, { color: theme.accent }]}>✕</Text>
              </View>

              {/* Orta: İsim + önizleme */}
              <View style={styles.textBlock}>
                <Text style={styles.senderName}>{senderName}'tan Mektup</Text>
                <Text style={styles.previewText} numberOfLines={1}>
                  Gözlerini kapat ve oku...
                </Text>
                {/* Alt: gün kaldı badge */}
                <View style={[styles.daysLeftBadge, { backgroundColor: `${theme.accent}1F` }]}>
                  <Text style={[styles.daysLeftText, { color: theme.accent }]}>{daysLeft} gün kaldı 🔒</Text>
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
    borderWidth: 0,
    borderRadius: 20,
    padding: 16,
    marginBottom: 18,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  viewAll: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  letterItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(0,0,0,0.15)", // slightly darker inset
    borderWidth: 0,
    borderRadius: 14,
    padding: 14,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  lockIcon: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  textBlock: {
    flex: 1,
    gap: 3,
  },
  senderName: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  previewText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.5)",
  },
  daysLeftBadge: {
    alignSelf: "flex-start",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 6,
  },
  daysLeftText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
  },
  dateText: {
    fontSize: 11,
    color: "rgba(255,255,255,0.4)",
    fontFamily: "Inter_500Medium",
  },
});
