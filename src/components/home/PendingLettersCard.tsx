import React, { memo } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { dayjs } from "@/lib/date";
import { AppTheme } from "@/lib/theme";
import { Lock } from "lucide-react-native";

interface PendingLetter {
  id: number;
  unlock_date: string;
  sender?: { display_name?: string; username: string };
}

export const PendingLettersCard = memo(function PendingLettersCard({ letters, theme }: { letters: PendingLetter[]; theme: AppTheme }) {
  const router = useRouter();
  if (!letters || letters.length === 0) return null;

  const today = dayjs().startOf("day");

  const pendingLetters = letters.filter((letter) => {
    const unlockDate = dayjs(letter.unlock_date);
    return !unlockDate.isBefore(today, "day");
  });

  if (pendingLetters.length === 0) return null;

  return (
    <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
      {/* Başlık + Tümünü Gör */}
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: theme.text }]}>Bekleyen Mektuplar</Text>
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
            <View key={letter.id} style={[styles.letterItem, { backgroundColor: theme.unitBg, borderColor: theme.cardBorder }]}>
              {/* Sol: Kilit ikonu */}
              <View style={[styles.iconCircle, { backgroundColor: theme.pillAccentBg }]}>
                <Lock size={15} color={theme.accent} />
              </View>

              {/* Orta: İsim + önizleme */}
              <View style={styles.textBlock}>
                <Text style={[styles.senderName, { color: theme.text }]}>{senderName}'tan Mektup</Text>
                <Text style={[styles.previewText, { color: theme.textMuted }]} numberOfLines={1}>
                  Gözlerini kapat ve oku...
                </Text>
                {/* Alt: gün kaldı badge */}
                <View style={[styles.daysLeftBadge, { backgroundColor: theme.pillAccentBg, borderColor: theme.pillAccentBorder }]}>
                  <Text style={[styles.daysLeftText, { color: theme.accent }]}>{daysLeft} gün kaldı 🔒</Text>
                </View>
              </View>

              {/* Sağ: tarih */}
              <Text style={[styles.dateText, { color: theme.textMuted }]}>{formattedDate}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    marginBottom: 4,
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
  },
  viewAll: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  letterItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  textBlock: {
    flex: 1,
  },
  senderName: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 3,
  },
  previewText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginBottom: 6,
  },
  daysLeftBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  daysLeftText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
  },
  dateText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
});
