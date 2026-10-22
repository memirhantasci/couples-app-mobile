import React, { useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { StorageImage } from "@/components/common/StorageImage";
import { Heart } from "lucide-react-native";
import { Marker } from "react-native-maps";

import { markerStyles } from "./mapMarkerStyles";
import { PinAvatar } from "./MapPinMarkers";
import type { PhotoPin, SelectedItem } from "./mapTypes";

interface PhotoMarkerPinProps {
  photo: PhotoPin;
  /** Fotoğrafı yükleyenin profil fotoğrafı (Premium) — varsa kalp rozetinin yerini alır */
  avatarUrl?: string | null;
  onSelect: (item: SelectedItem) => void;
}

// ─── 1. FOTOĞRAF PİNİ (Polaroid Çerçeveli) ───────────────────────────────────
function PhotoMarkerPinBase({ photo, avatarUrl, onSelect }: PhotoMarkerPinProps) {
  // Görseller (fotoğraf + varsa avatar) yüklenene kadar marker'ın yeniden çizilmesine izin ver, sonra dondur.
  const [tracksViewChanges, setTracksViewChanges] = useState(true);
  const loadedCountRef = useRef(0);
  const expectedLoads = avatarUrl ? 2 : 1;
  const handleLoadEnd = () => {
    loadedCountRef.current += 1;
    if (loadedCountRef.current >= expectedLoads) {
      setTimeout(() => setTracksViewChanges(false), 300);
    }
  };

  return (
    <Marker
      coordinate={{ latitude: photo.latitude, longitude: photo.longitude }}
      onPress={() => onSelect({ type: "photo", data: photo })}
      tracksViewChanges={tracksViewChanges}
    >
      <View style={styles.photoMarkerWrapper}>
        <View style={styles.photoPolaroidFrame}>
          <StorageImage
            bucket="photos"
            path={photo.thumb_path || photo.storage_path}
            style={styles.photoMarkerImg}
            contentFit="cover"
            cachePolicy="memory-disk"
            onLoadEnd={handleLoadEnd}
            transition={0}
          />
          {avatarUrl ? (
            <View style={styles.photoAvatarBadge}>
              <PinAvatar uri={avatarUrl} size={19} onLoadEnd={handleLoadEnd} />
            </View>
          ) : (
            <View style={styles.photoHeartBadge}>
              <Heart size={10} color="#fff" fill="#fff" />
            </View>
          )}
        </View>
        <View style={[markerStyles.markerStem, { borderTopColor: "#FFFFFF" }]} />
      </View>
    </Marker>
  );
}

export const PhotoMarkerPin = React.memo(PhotoMarkerPinBase);

const styles = StyleSheet.create({
  photoMarkerWrapper: {
    alignItems: "center",
  },
  photoPolaroidFrame: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    padding: 3,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    shadowColor: "#FF4D6D",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 8,
  },
  photoMarkerImg: {
    width: "100%",
    height: "100%",
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
  },
  photoAvatarBadge: {
    position: "absolute",
    top: -7,
    right: -7,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    backgroundColor: "#FFFFFF",
  },
  photoHeartBadge: {
    position: "absolute",
    top: -5,
    right: -5,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#FF4D6D",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
});
