import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { Calendar, MapPin } from "lucide-react-native";
import { Marker } from "react-native-maps";

import { markerStyles } from "./mapMarkerStyles";
import type { MapCoordinate, MapNote, MeetingPin, SelectedItem } from "./mapTypes";

/**
 * Marker'lar performans için dondurulmuş (tracksViewChanges=false) çizilir; içinde uzak bir
 * görsel varsa yüklenene kadar yeniden çizime izin verip sonra dondurur.
 */
export function useFreezeAfterImageLoad(imageUri: string | null | undefined) {
  const [tracksViewChanges, setTracksViewChanges] = useState(!!imageUri);
  // Fotoğraf değişince (ör. partner yeni PP yükledi) yeni görsel yüklenene kadar yeniden çizime izin ver
  const [trackedUri, setTrackedUri] = useState(imageUri);
  if (trackedUri !== imageUri) {
    setTrackedUri(imageUri);
    setTracksViewChanges(!!imageUri);
  }
  const onImageLoadEnd = () => setTimeout(() => setTracksViewChanges(false), 300);
  return { tracksViewChanges, onImageLoadEnd };
}

/** Pinlerin içindeki yuvarlak profil fotoğrafı */
export function PinAvatar({ uri, size, onLoadEnd }: { uri: string; size: number; onLoadEnd?: () => void }) {
  return (
    <Image
      source={{ uri }}
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: "#F3F4F6" }}
      contentFit="cover"
      cachePolicy="memory-disk"
      onLoadEnd={onLoadEnd}
      transition={0}
    />
  );
}

// ─── 2. AŞK NOTU PİNİ (Mühürlü Aşk Zarfı Tasarımı) ───────────────────────────
interface NoteMarkerPinProps {
  note: MapNote;
  /** Notu bırakanın profil fotoğrafı (Premium) — varsa zarfın yerini alır */
  avatarUrl?: string | null;
  onSelect: (item: SelectedItem) => void;
}

function NoteMarkerPinBase({ note, avatarUrl, onSelect }: NoteMarkerPinProps) {
  const { tracksViewChanges, onImageLoadEnd } = useFreezeAfterImageLoad(avatarUrl);

  return (
    <Marker
      coordinate={{ latitude: note.latitude, longitude: note.longitude }}
      onPress={(e) => {
        e.stopPropagation?.();
        onSelect({ type: "note", data: note });
      }}
      tracksViewChanges={tracksViewChanges}
    >
      <View style={styles.noteMarkerWrapper}>
        {avatarUrl ? (
          <View style={styles.noteAvatarFrame}>
            <PinAvatar uri={avatarUrl} size={34} onLoadEnd={onImageLoadEnd} />
            <View style={styles.noteAvatarSeal}>
              <Text style={{ fontSize: 9 }}>💌</Text>
            </View>
          </View>
        ) : (
          <LinearGradient colors={["#FF4D6D", "#E01E5A"]} style={styles.noteEnvelopePill}>
            <Text style={{ fontSize: 13 }}>💌</Text>
          </LinearGradient>
        )}
        <View style={[markerStyles.markerStem, { borderTopColor: avatarUrl ? "#FFFFFF" : "#E01E5A" }]} />
      </View>
    </Marker>
  );
}

export const NoteMarkerPin = React.memo(NoteMarkerPinBase);

// ─── 3. BULUŞMA PİNİ (Zarif Randevu & Takvim Rozeti) ─────────────────────────
interface MeetingMarkerPinProps {
  meeting: MeetingPin;
  /** Buluşmayı planlayanın profil fotoğrafı (Premium) — varsa takvim ikonunun yerini alır */
  avatarUrl?: string | null;
  onSelect: (item: SelectedItem) => void;
}

function MeetingMarkerPinBase({ meeting, avatarUrl, onSelect }: MeetingMarkerPinProps) {
  const { tracksViewChanges, onImageLoadEnd } = useFreezeAfterImageLoad(avatarUrl);

  return (
    <Marker
      coordinate={{ latitude: meeting.latitude, longitude: meeting.longitude }}
      onPress={(e) => {
        e.stopPropagation?.();
        onSelect({ type: "meeting", data: meeting });
      }}
      tracksViewChanges={tracksViewChanges}
    >
      <View style={styles.meetingMarkerWrapper}>
        <LinearGradient
          colors={["#8B5CF6", "#6D28D9"]}
          style={[styles.meetingPill, avatarUrl ? styles.meetingPillWithAvatar : null]}
        >
          {avatarUrl ? (
            <PinAvatar uri={avatarUrl} size={20} onLoadEnd={onImageLoadEnd} />
          ) : (
            <Calendar size={13} color="#fff" />
          )}
          <Text style={styles.meetingMarkerText} numberOfLines={1}>
            {meeting.title}
          </Text>
        </LinearGradient>
        <View style={[markerStyles.markerStem, { borderTopColor: "#6D28D9" }]} />
      </View>
    </Marker>
  );
}

export const MeetingMarkerPin = React.memo(MeetingMarkerPinBase);

// ─── 4. BEKLEYEN NOT PİNİ (Uzun basışla seçilen konum) ────────────────────────
interface PendingNoteMarkerProps {
  coordinate: MapCoordinate;
  accent: string;
}

export function PendingNoteMarker({ coordinate, accent }: PendingNoteMarkerProps) {
  return (
    <Marker coordinate={coordinate}>
      <View style={styles.pendingMarkerWrapper}>
        <View style={styles.pendingMarkerPulse} />
        <View style={[styles.pendingMarkerCore, { backgroundColor: accent }]}>
          <MapPin size={16} color="#fff" />
        </View>
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  // 2. Aşk Notu Pin
  noteMarkerWrapper: {
    alignItems: "center",
  },
  noteEnvelopePill: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    shadowColor: "#FF1493",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
  noteAvatarFrame: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#FF1493",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
  noteAvatarSeal: {
    position: "absolute",
    right: -4,
    bottom: -2,
    width: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: "#FF4D6D",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },

  // 3. Buluşma Pin
  meetingMarkerWrapper: {
    alignItems: "center",
  },
  meetingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    shadowColor: "#8B5CF6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
    maxWidth: 130,
  },
  meetingPillWithAvatar: {
    paddingLeft: 3,
    paddingVertical: 3,
    maxWidth: 140,
  },
  meetingMarkerText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },

  // 4. Bekleyen Pin
  pendingMarkerWrapper: {
    alignItems: "center",
    justifyContent: "center",
    width: 44,
    height: 44,
  },
  pendingMarkerPulse: {
    position: "absolute",
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 77, 109, 0.25)",
  },
  pendingMarkerCore: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
});
