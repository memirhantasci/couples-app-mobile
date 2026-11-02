import { useState, memo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import Animated, {
  FadeIn,
  LayoutAnimationConfig,
  ZoomIn,
  useAnimatedStyle,
  useReducedMotion,
} from "react-native-reanimated";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { todayString } from "@/lib/date";
import { encrypt } from "@/utils/crypto";
import { sanitize } from "@/utils/sanitize";
import { logger } from "@/utils/logger";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { BookOpen, Lock, LockOpen } from "lucide-react-native";
import { AppTheme } from "@/lib/theme";
import { useDemoAction } from "@/hooks/useDemoAction";
import { useFocusClock } from "@/hooks/useFocusClock";
import { DemoActionModal } from "@/components/demo/DemoActionModal";
import { JournalLockSuccessOverlay } from "@/components/daily-notes/JournalLockSuccessOverlay";
import { toast } from "@/lib/toast";
import { openForm } from "@/lib/formEntry";
import { DAILY_NOTE_MAX_CHARS } from "@/lib/dailyNote";
import { useTranslation } from "react-i18next";
import { localizeServerError } from "@/lib/serverErrors";

/** Ana sayfa kartında not en çok bu kadar karakter gösterilir; devamı Günlüklerim ekranında okunur. */
const PREVIEW_MAX_CHARS = 180;
/** Kilitli sayfanın altın halesinin bir nefes süresi (ms). */
const HALO_CYCLE_MS = 1800;

interface DailyNoteCardProps {
  existingNote?: string | null;
  theme: AppTheme;
}

export const DailyNoteCard = memo(function DailyNoteCard({ existingNote, theme }: DailyNoteCardProps) {
  const { t } = useTranslation();
  const { session, profile } = useAuth();
  const { executeOrIntercept, isDemoModalOpen, setIsDemoModalOpen, modalConfig } = useDemoAction();
  const queryClient = useQueryClient();
  const router = useRouter();

  const [content, setContent] = useState(existingNote || "");
  const [saved, setSaved] = useState(!!existingNote);
  const [submitting, setSubmitting] = useState(false);
  const [isLocking, setIsLocking] = useState(false);

  // Bugünkü not başka yerde değişirse (Günlüklerim'de düzenlendi, silindi ya da yeniden yüklendi) kart
  // eski metni göstermeye devam etmesin
  const [syncedNote, setSyncedNote] = useState(existingNote ?? null);
  if ((existingNote ?? null) !== syncedNote) {
    setSyncedNote(existingNote ?? null);
    setContent(existingNote || "");
    setSaved(!!existingNote);
  }

  async function handleSave() {
    if (executeOrIntercept(
      () => {},
      t("home.dailyNote.demoTitle"),
      t("home.dailyNote.demoDescription")
    )) {
      return;
    }
    if (saved || submitting || !content.trim() || !session?.user?.id) return;
    setSubmitting(true);

    const coupleId = profile?.coupleId ?? null;
    const today = todayString();
    const cleanContent = sanitize(content.trim());
    if (!cleanContent) {
      setSubmitting(false);
      return;
    }
    let encryptedContent: string;
    try {
      encryptedContent = encrypt(cleanContent);
    } catch (err) {
      setSubmitting(false);
      toast.error(localizeServerError(err, t("errors.unknown")), { title: t("home.dailyNote.saveFailed") });
      return;
    }

    const { error } = await supabase.rpc("save_daily_note", {
      p_date: today,
      p_content: encryptedContent,
      p_couple_id: coupleId,
    });

    setSubmitting(false);

    if (!error) {
      // Başarı bildirimi yerine editördeki aynı sır defteri töreni oynar; kart, tören bitince kilitlenir
      setIsLocking(true);
    } else {
      logger.error("Note save error:", JSON.stringify(error, null, 2));
      toast.error(localizeServerError(error, t("errors.unknown")), { title: t("home.dailyNote.saveFailed") });
    }
  }

  // Tören bitti: kilit kapanıp altın haleyle parlasın diye kart ancak şimdi "kaydedildi" haline geçer.
  // Liste de şimdi yenilenir; erken gelen yeni veri kartı törenin arkasında kilitlemesin
  function finishJournalLock() {
    setIsLocking(false);
    setSaved(true);
    queryClient.invalidateQueries({ queryKey: ["home_dashboard"] });
    // Günlüklerim ekranı da yeni notu görsün
    queryClient.invalidateQueries({ queryKey: ["daily_notes_history"] });
  }

  // Bugünün sayfası günlük editöründe açılır: yazılmadıysa yazmak, yazıldıysa okumak için
  function openTodayPage() {
    executeOrIntercept(
      () => router.push(openForm("/(tabs)/add-daily-note", { date: todayString() })),
      t("home.dailyNote.demoTitle"),
      t("home.dailyNote.demoDescription")
    );
  }

  return (
    // Kartın boş yerlerine dokunmak sayfayı açar; yazı alanı ve butonlar kendi dokunuşlarını alır.
    // Kart tek bir erişilebilirlik öğesi olmasın (yazı alanı ekran okuyucudan gizlenirdi): açma eylemi
    // başlık satırındadır
    <Pressable
      accessible={false}
      onPress={openTodayPage}
      style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, ...theme.cardShadow }]}
    >
      <Pressable
        onPress={openTodayPage}
        accessibilityRole="button"
        accessibilityLabel={t("home.dailyNote.openA11y")}
        style={styles.titleRow}
      >
        <Text style={[styles.title, { color: theme.text }]}>{t("home.dailyNote.title")}</Text>
        <JournalLockIcon locked={saved} theme={theme} />
      </Pressable>

      {saved ? (
        <View style={[styles.savedBox, { backgroundColor: theme.unitBg, borderColor: theme.cardBorder }]}>
          <Text style={[styles.savedContent, { color: theme.text }]} numberOfLines={5} ellipsizeMode="tail">
            {content.length > PREVIEW_MAX_CHARS ? `${content.slice(0, PREVIEW_MAX_CHARS).trimEnd()}…` : content}
          </Text>
          <Text style={[styles.footerText, { color: theme.textMuted }]}>{t("home.dailyNote.writeTomorrow")}</Text>
          <TouchableOpacity onPress={openTodayPage} style={styles.historyBtn}>
            <BookOpen size={12} color={theme.accent} />
            <Text style={[styles.historyBtnText, { color: theme.accent }]}>{t("dailyNotes.openJournal")}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          <TextInput
            value={content}
            onChangeText={setContent}
            placeholder={t("home.dailyNote.placeholder")}
            placeholderTextColor={theme.textMuted}
            multiline
            numberOfLines={4}
            maxLength={DAILY_NOTE_MAX_CHARS}
            style={[
              styles.input, 
              { 
                backgroundColor: theme.unitBg, 
                color: theme.text,
                borderColor: theme.isLight ? theme.cardBorder : "rgba(255,255,255,0.08)" 
              }
            ]}
          />
          <TouchableOpacity
            style={[
              styles.saveBtn,
              { backgroundColor: theme.accent },
              (submitting || !content.trim()) && { opacity: 0.6 },
            ]}
            onPress={handleSave}
            // `disabled` yerine: devre dışı dokunulabilir öğe dokunuşu karta bırakır ve kart editörü açardı
            // (kayıt sürerken bile). Boş ya da kaydedilirken basış handleSave'de yok sayılır
            accessibilityState={{ disabled: submitting || !content.trim() }}
            activeOpacity={submitting || !content.trim() ? 1 : 0.8}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.saveBtnText}>{t("common.save")}</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      <DemoActionModal
        visible={isDemoModalOpen}
        onClose={() => setIsDemoModalOpen(false)}
        title={modalConfig.title}
        description={modalConfig.description}
      />
      <JournalLockSuccessOverlay visible={isLocking} onComplete={finishJournalLock} pageText={content} />
    </Pressable>
  );
});

/**
 * Sır defterinin kilidi: sayfa yazılmadıysa loş, açık bir kilit; yazıldıysa çevresinde altın hale nefes alan,
 * parıldayan kapalı kilit. Kart açıkken kaydedilince kilit yaylanarak kapanır (ilk çizimde animasyon yok).
 */
function JournalLockIcon({ locked, theme }: { locked: boolean; theme: AppTheme }) {
  const reduceMotion = useReducedMotion();
  const gold = theme.isLight ? "#C9961A" : "#F5C563";
  const halo = useFocusClock(HALO_CYCLE_MS, locked && !reduceMotion);

  const haloStyle = useAnimatedStyle(() => {
    const p = halo.get();
    return { opacity: 0.6 * (1 - p), transform: [{ scale: 1 + 0.25 * p }] };
  });

  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.lockSlot}>
      <LayoutAnimationConfig skipEntering>
        {locked ? (
          <Animated.View key="locked" entering={ZoomIn.springify().damping(12).stiffness(200)} style={styles.lockInner}>
            <Animated.View
              style={[
                styles.lockHalo,
                { backgroundColor: `${gold}40`, borderColor: gold },
                reduceMotion ? styles.lockHaloStatic : haloStyle,
              ]}
            />
            {/* Parıltı (iOS gölgesi) yalnızca durağan ikonda: nefes alan hale her karede gölge çizdirmesin */}
            <View style={[styles.lockGlow, { shadowColor: gold }]}>
              <Lock size={16} color={gold} strokeWidth={2.4} />
            </View>
          </Animated.View>
        ) : (
          <Animated.View key="open" entering={FadeIn.duration(200)} style={[styles.lockInner, styles.lockOpen]}>
            <LockOpen size={16} color={theme.textMuted} />
          </Animated.View>
        )}
      </LayoutAnimationConfig>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    padding: 18,
    marginBottom: 4,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  title: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  lockSlot: {
    width: 28,
    height: 28,
  },
  lockInner: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  lockGlow: {
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 5,
  },
  lockOpen: {
    opacity: 0.6,
  },
  lockHalo: {
    position: "absolute",
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
  },
  lockHaloStatic: {
    opacity: 0.35,
  },
  savedBox: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
  },
  savedContent: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 21,
    marginBottom: 10,
  },
  footerText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginBottom: 8,
  },
  historyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingTop: 4,
  },
  historyBtnText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  input: {
    borderRadius: 14,
    padding: 14,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    borderWidth: 1,
    minHeight: 90,
    textAlignVertical: "top",
  },
  saveBtn: {
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
});
