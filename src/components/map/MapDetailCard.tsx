import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { BlurView } from "expo-blur";
import { StorageImage } from "@/components/common/StorageImage";
import {
  Calendar,
  Camera,
  ChevronRight,
  Navigation,
  StickyNote,
  Trash2,
  X,
  ZoomIn,
} from "lucide-react-native";
import type { ReactNode } from "react";

import { dayjs } from "@/lib/date";
import { openDirections } from "./openDirections";
import type { MapNote, MeetingPin, PhotoPin, SelectedItem } from "./mapTypes";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";

type DetailItem = NonNullable<SelectedItem>;

interface MapDetailCardProps {
  item: DetailItem;
  accent: string;
  /** Safe-area alt boşluğu; kart tab bar'ın üstünde durur. */
  bottomInset: number;
  currentUserId: string | null;
  onClose: () => void;
  onZoomPhoto: (photo: PhotoPin) => void;
  onDeletePhoto: (photo: PhotoPin) => void;
  onDeleteNote: (note: MapNote) => void;
  onOpenMeetings: () => void;
}

// Buluşma Geri Sayımı Metni
// `t` parametre olarak alınır: bileşen render sırasında çağırır, dil değişince metin yenilenir
function getMeetingCountdown(meetingDateStr: string, t: TFunction): string {
  const now = dayjs();
  const target = dayjs(meetingDateStr);
  const diffMinutes = target.diff(now, "minute");

  if (diffMinutes < 0) return t("map.meetingCountdown.done");

  const calendarDays = target.startOf("day").diff(now.startOf("day"), "day");
  if (calendarDays === 0) return t("map.meetingCountdown.today");
  if (calendarDays === 1) return t("map.meetingCountdown.tomorrow");
  return t("map.meetingCountdown.days", { count: calendarDays });
}

// ─── ORTAK BAŞLIK (Rozet + Kapat) ─────────────────────────────────────────────
function DetailHeader({
  icon,
  label,
  badgeColor,
  onClose,
}: {
  icon: ReactNode;
  label: string;
  badgeColor?: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.detailCardHeader}>
      <View style={[styles.detailBadge, badgeColor ? { backgroundColor: badgeColor } : null]}>
        {icon}
        <Text style={styles.detailBadgeText}>{label}</Text>
      </View>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("a11y.close")}
        onPress={onClose}
        style={styles.detailCloseBtn}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <X size={16} color="rgba(255,255,255,0.7)" />
      </TouchableOpacity>
    </View>
  );
}

function DeleteButton({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  return (
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("a11y.delete")} style={styles.deleteActionBtn} onPress={onPress} activeOpacity={0.8}>
      <Trash2 size={15} color="#FF4D6D" />
    </TouchableOpacity>
  );
}

// ─── 1. FOTOĞRAF DETAYI ───────────────────────────────────────────────────────
function PhotoDetail({
  photo,
  accent,
  isOwner,
  onClose,
  onZoomPhoto,
  onDeletePhoto,
}: {
  photo: PhotoPin;
  accent: string;
  isOwner: boolean;
  onClose: () => void;
  onZoomPhoto: (photo: PhotoPin) => void;
  onDeletePhoto: (photo: PhotoPin) => void;
}) {
  const { t, i18n } = useTranslation();
  return (
    <View style={styles.detailCardBody}>
      <DetailHeader
        icon={<Camera size={12} color="#fff" />}
        label={t("map.detail.photoMemory")}
        onClose={onClose}
      />

      <View style={styles.photoPreviewRow}>
        <TouchableOpacity
          onPress={() => onZoomPhoto(photo)}
          activeOpacity={0.85}
          style={styles.photoThumbContainer}
        >
          <StorageImage bucket="photos" path={photo.thumb_path || photo.storage_path} style={styles.photoDetailThumb} contentFit="cover" />
          <View style={styles.zoomIconBadge}>
            <ZoomIn size={12} color="#fff" />
          </View>
        </TouchableOpacity>

        <View style={styles.photoDetailInfo}>
          <Text style={styles.photoDetailTitle} numberOfLines={2}>
            {photo.title || t("map.detail.photoMemory")}
          </Text>
          <Text style={styles.photoDetailDate}>
            📅 {dayjs(photo.taken_date).locale(i18n.language).format("D MMMM YYYY")}
          </Text>
          {photo.location_name ? (
            <Text style={styles.photoDetailLocation} numberOfLines={1}>
              📍 {photo.location_name}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Fotoğraf Açıklaması */}
      {photo.description ? (
        <View style={styles.descriptionBox}>
          <Text style={styles.descriptionText} numberOfLines={3}>
            {photo.description}
          </Text>
        </View>
      ) : null}

      <View style={styles.detailActionsRow}>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: accent }]}
          onPress={() => openDirections(photo.latitude, photo.longitude)}
          activeOpacity={0.85}
        >
          <Navigation size={14} color="#fff" />
          <Text style={styles.actionBtnText}>{t("common.getDirections")}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionBtnSecondary}
          onPress={() => onZoomPhoto(photo)}
          activeOpacity={0.85}
        >
          <ZoomIn size={14} color="#fff" />
          <Text style={styles.actionBtnSecondaryText}>{t("map.detail.enlarge")}</Text>
        </TouchableOpacity>

        {isOwner && <DeleteButton onPress={() => onDeletePhoto(photo)} />}
      </View>
    </View>
  );
}

// ─── 2. AŞK NOTU DETAYI ───────────────────────────────────────────────────────
function NoteDetail({
  note,
  accent,
  isOwner,
  onClose,
  onDeleteNote,
}: {
  note: MapNote;
  accent: string;
  isOwner: boolean;
  onClose: () => void;
  onDeleteNote: (note: MapNote) => void;
}) {
  const { t, i18n } = useTranslation();
  return (
    <View style={styles.detailCardBody}>
      <DetailHeader
        icon={<StickyNote size={12} color="#fff" />}
        label={t("map.detail.noteBadge")}
        badgeColor="rgba(224, 30, 90, 0.85)"
        onClose={onClose}
      />

      {/* Not Mesajı Parşömeni */}
      <View style={styles.noteMessageCard}>
        <Text style={styles.quoteMark}>“</Text>
        <Text style={styles.noteMessageText}>{note.note}</Text>
        <Text style={styles.noteDateMeta}>
          {dayjs(note.created_at).locale(i18n.language).format("D MMMM YYYY, HH:mm")}
        </Text>
      </View>

      <View style={styles.detailActionsRow}>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: accent }]}
          onPress={() => openDirections(note.latitude, note.longitude)}
          activeOpacity={0.85}
        >
          <Navigation size={14} color="#fff" />
          <Text style={styles.actionBtnText}>{t("map.detail.directionsToLocation")}</Text>
        </TouchableOpacity>

        {isOwner && <DeleteButton onPress={() => onDeleteNote(note)} />}
      </View>
    </View>
  );
}

// ─── 3. BULUŞMA DETAYI ────────────────────────────────────────────────────────
function MeetingDetail({
  meeting,
  onClose,
  onOpenMeetings,
}: {
  meeting: MeetingPin;
  onClose: () => void;
  onOpenMeetings: () => void;
}) {
  const { t, i18n } = useTranslation();
  return (
    <View style={styles.detailCardBody}>
      <DetailHeader
        icon={<Calendar size={12} color="#fff" />}
        label={t("notifications.push.meeting.planSubtitle")}
        badgeColor="rgba(109, 40, 217, 0.85)"
        onClose={onClose}
      />

      <View style={styles.meetingDetailsBox}>
        <View style={styles.meetingTopRow}>
          <Text style={styles.meetingTitleText}>{meeting.title}</Text>
          <View style={styles.meetingCountdownBadge}>
            <Text style={styles.meetingCountdownText}>
              {getMeetingCountdown(meeting.meeting_datetime, t)}
            </Text>
          </View>
        </View>

        <Text style={styles.meetingDatetimeText}>
          🗓️ {dayjs(meeting.meeting_datetime).locale(i18n.language).format("D MMMM YYYY, dddd · HH:mm")}
        </Text>
        {meeting.location_name ? (
          <Text style={styles.meetingLocationText} numberOfLines={2}>
            📍 {meeting.location_name}
          </Text>
        ) : null}
      </View>

      <View style={styles.detailActionsRow}>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: "#8B5CF6" }]}
          onPress={() => openDirections(meeting.latitude, meeting.longitude)}
          activeOpacity={0.85}
        >
          <Navigation size={14} color="#fff" />
          <Text style={styles.actionBtnText}>{t("common.getDirections")}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionBtnSecondary}
          onPress={onOpenMeetings}
          activeOpacity={0.8}
        >
          <Text style={styles.actionBtnSecondaryText}>{t("map.detail.seeMeetups")}</Text>
          <ChevronRight size={14} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── DETAY KARTI (Floating Glass Card with High zIndex) ───────────────────────
export function MapDetailCard({
  item,
  accent,
  bottomInset,
  currentUserId,
  onClose,
  onZoomPhoto,
  onDeletePhoto,
  onDeleteNote,
  onOpenMeetings,
}: MapDetailCardProps) {
  return (
    <View style={[styles.detailCardOverlay, { bottom: bottomInset + 85 }]}>
      <BlurView tint="dark" intensity={95} style={StyleSheet.absoluteFill} />

      {item.type === "photo" && (
        <PhotoDetail
          photo={item.data}
          accent={accent}
          isOwner={Boolean(currentUserId && item.data.user_id && item.data.user_id === currentUserId)}
          onClose={onClose}
          onZoomPhoto={onZoomPhoto}
          onDeletePhoto={onDeletePhoto}
        />
      )}

      {item.type === "note" && (
        <NoteDetail
          note={item.data}
          accent={accent}
          isOwner={Boolean(currentUserId && item.data.user_id && item.data.user_id === currentUserId)}
          onClose={onClose}
          onDeleteNote={onDeleteNote}
        />
      )}

      {item.type === "meeting" && (
        <MeetingDetail meeting={item.data} onClose={onClose} onOpenMeetings={onOpenMeetings} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  detailCardOverlay: {
    position: "absolute",
    left: 16,
    right: 16,
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.15)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 25,
    zIndex: 999,
  },
  detailCardBody: {
    padding: 16,
    gap: 12,
  },
  detailCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  detailBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(59, 130, 246, 0.85)",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  detailBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  detailCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },

  // Fotoğraf Detay
  photoPreviewRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  photoThumbContainer: {
    position: "relative",
  },
  photoDetailThumb: {
    width: 72,
    height: 72,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  zoomIconBadge: {
    position: "absolute",
    bottom: 4,
    right: 4,
    backgroundColor: "rgba(0,0,0,0.65)",
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  photoDetailInfo: {
    flex: 1,
    gap: 3,
  },
  photoDetailTitle: {
    color: "#FFFFFF",
    fontSize: 14.5,
    fontFamily: "Inter_700Bold",
  },
  photoDetailDate: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  photoDetailLocation: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 11.5,
    fontFamily: "Inter_500Medium",
  },
  descriptionBox: {
    backgroundColor: "rgba(255,255,255,0.06)",
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  descriptionText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12.5,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },

  // Aşk Notu Detay
  noteMessageCard: {
    backgroundColor: "rgba(255, 77, 109, 0.1)",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 77, 109, 0.25)",
  },
  quoteMark: {
    fontSize: 24,
    color: "#FF4D6D",
    fontFamily: "Inter_700Bold",
    lineHeight: 22,
    marginBottom: -4,
  },
  noteMessageText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    lineHeight: 20,
  },
  noteDateMeta: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 8,
    textAlign: "right",
  },

  // Buluşma Detay
  meetingDetailsBox: {
    backgroundColor: "rgba(139, 92, 246, 0.1)",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.25)",
    gap: 5,
  },
  meetingTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  meetingTitleText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    flex: 1,
  },
  meetingCountdownBadge: {
    backgroundColor: "rgba(139, 92, 246, 0.3)",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  meetingCountdownText: {
    color: "#E9D5FF",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  meetingDatetimeText: {
    color: "#C4B5FD",
    fontSize: 12.5,
    fontFamily: "Inter_500Medium",
  },
  meetingLocationText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },

  // Aksiyon Butonları
  detailActionsRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 14,
  },
  actionBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  actionBtnSecondary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  actionBtnSecondaryText: {
    color: "#FFFFFF",
    fontSize: 12.5,
    fontFamily: "Inter_600SemiBold",
  },
  deleteActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(255, 77, 109, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 77, 109, 0.3)",
  },
});
