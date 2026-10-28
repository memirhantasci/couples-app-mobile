import React, { useRef, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Share,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { X, Share2, Sparkles, Compass } from "lucide-react-native";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import { AppTheme } from "@/lib/theme";
import { dayjs } from "@/lib/date";


interface MapPinItem {
  id: number;
  latitude: number;
  longitude: number;
  location_name?: string | null;
  date?: string;
  type: "photo" | "note" | "meeting";
}

interface MapStoryModalProps {
  visible: boolean;
  onClose: () => void;
  pins: MapPinItem[];
  theme: AppTheme;
}

// Haversine Formülü ile iki koordinat arası km hesaplama
function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Dünya yarıçapı (km)
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/** Pinler arasındaki en uzun mesafe (km). Az pinde tüm çiftler; çok pinde yalnızca uç noktalar (O(N²) olmasın). */
function maxDistanceKm(pins: readonly { latitude: number; longitude: number }[]): number {
  let candidates = pins;
  if (pins.length > EXACT_PAIRWISE_LIMIT) {
    // Çap, dört yönün (enlem, boylam ve iki çapraz) uç noktaları arasında oluşur
    const keys = [
      (p: { latitude: number; longitude: number }) => p.latitude,
      (p: { latitude: number; longitude: number }) => p.longitude,
      (p: { latitude: number; longitude: number }) => p.latitude + p.longitude,
      (p: { latitude: number; longitude: number }) => p.latitude - p.longitude,
    ];
    const picked = new Set<{ latitude: number; longitude: number }>();
    for (const key of keys) {
      let lo = pins[0];
      let hi = pins[0];
      for (const p of pins) {
        if (key(p) < key(lo)) lo = p;
        if (key(p) > key(hi)) hi = p;
      }
      picked.add(lo);
      picked.add(hi);
    }
    candidates = [...picked];
  }
  let max = 0;
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const d = calculateDistanceKm(
        candidates[i].latitude,
        candidates[i].longitude,
        candidates[j].latitude,
        candidates[j].longitude
      );
      if (d > max) max = d;
    }
  }
  return max;
}

const EXACT_PAIRWISE_LIMIT = 150;

export function MapStoryModal({ visible, onClose, pins, theme }: MapStoryModalProps) {
  const [isSharing, setIsSharing] = useState(false);
  const shareCardRef = useRef<View>(null);

  // Harita analiz hesaplamaları
  const stats = useMemo(() => {
    // Pin yoksa uydurma rakam göstermek yerine boş durum çizilir. Modal kapalıyken hiçbir şey hesaplanmaz
    // (pinler değiştikçe tüm çiftler arası mesafe döngüsü arka planda boşuna çalışıyordu).
    if (!visible || !pins || pins.length === 0) return null;

    const totalPins = pins.length;
    const locationNames = Array.from(
      new Set(pins.map((p) => p.location_name).filter(Boolean))
    ) as string[];

    const maxDist = maxDistanceKm(pins);

    const firstPlace = pins[pins.length - 1]?.location_name || "İlk Durağımız";
    const latestPlace = pins[0]?.location_name || "Son Rotamız";
    const cityCount = Math.max(1, locationNames.length);

    return {
      totalPins,
      locationsList: locationNames,
      maxDistanceKm: maxDist > 0 ? maxDist : 12,
      firstPlace,
      latestPlace,
      headline:
        maxDist > 50
          ? `Aşkımız ${cityCount} şehirde ve ${maxDist} kilometrede büyüdü.`
          : `Birlikte ${totalPins} unutulmaz noktada anı bıraktık.`,
    };
  }, [pins, visible]);

  const handleShare = async () => {
    if (!shareCardRef.current || !stats) return;
    try {
      setIsSharing(true);
      const uri = await captureRef(shareCardRef, {
        format: "png",
        quality: 1.0,
        result: "tmpfile",
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: "image/png",
          dialogTitle: "Aşk Haritamızı Paylaş",
          UTI: "public.png",
        });
      } else {
        await Share.share({
          url: uri,
          message: `${stats.headline} · Made with Couples App`,
        });
      }
    } catch (error) {
      console.warn("Map story share error:", error);
    } finally {
      setIsSharing(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.container}>
          {/* Kapat Butonu */}
          <View style={styles.topBar}>
            <View style={styles.badge}>
              <Sparkles size={14} color="#FF6B8B" />
              <Text style={styles.badgeText}>AŞK HARİTASI HİKAYEMİZ</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={styles.closeBtn}>
              <X size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {!stats ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconCircle}>
                <Compass size={26} color="#FF4D6D" />
              </View>
              <Text style={styles.emptyTitle}>Henüz harita iziniz bulunmuyor</Text>
              <Text style={styles.emptyText}>
                Anı veya fotoğraf ekledikçe seyahat hikayeniz burada şekillenecek ✨
              </Text>
            </View>
          ) : (
          <>
          {/* Dışa Aktarılacak Estetik Story Kartı */}
          <View ref={shareCardRef} collapsable={false} style={styles.storyCard}>
            <LinearGradient
              colors={["#161220", "#24132B", "#120B18"]}
              style={StyleSheet.absoluteFill}
            />

            {/* Kart Header */}
            <View style={styles.cardTopRow}>
              <View style={styles.iconCircle}>
                <Compass size={18} color="#FF4D6D" />
              </View>
              <Text style={styles.cardHeaderTitle}>OUR LOVE ROUTE</Text>
              <Text style={styles.cardDateText}>{dayjs().format("YYYY")}</Text>
            </View>

            {/* Manşet Cümlesi */}
            <Text style={styles.cardHeadline}>{stats.headline}</Text>

            {/* Rota Çizgisi & Duraklar */}
            <View style={styles.routeBox}>
              <View style={styles.stopRow}>
                <View style={styles.dotStart} />
                <View style={styles.stopTextGroup}>
                  <Text style={styles.stopLabel}>İlk Durak</Text>
                  <Text style={styles.stopValue}>{stats.firstPlace}</Text>
                </View>
              </View>

              <View style={styles.dashedLine} />

              <View style={styles.stopRow}>
                <View style={styles.dotEnd} />
                <View style={styles.stopTextGroup}>
                  <Text style={styles.stopLabel}>Son Rota</Text>
                  <Text style={styles.stopValue}>{stats.latestPlace}</Text>
                </View>
              </View>
            </View>

            {/* Metrikler */}
            <View style={styles.metricsGrid}>
              <View style={styles.metricItem}>
                <Text style={styles.metricNum}>{stats.totalPins}</Text>
                <Text style={styles.metricLabel}>Harita İzi</Text>
              </View>
              <View style={styles.metricDivider} />
              <View style={styles.metricItem}>
                <Text style={styles.metricNum}>{stats.maxDistanceKm}</Text>
                <Text style={styles.metricLabel}>Kilometre</Text>
              </View>
              <View style={styles.metricDivider} />
              <View style={styles.metricItem}>
                <Text style={styles.metricNum}>{Math.max(1, stats.locationsList.length)}</Text>
                <Text style={styles.metricLabel}>Keşif Yeri</Text>
              </View>
            </View>

            {/* Minimalist Watermark */}
            <View style={styles.watermarkWrapper}>
              <View style={styles.watermarkDot} />
              <Text style={styles.watermarkText}>Made with Couples App</Text>
            </View>
          </View>

          {/* Paylaşım Butonu */}
          <TouchableOpacity
            onPress={handleShare}
            disabled={isSharing}
            activeOpacity={0.85}
            style={styles.shareBtn}
          >
            <LinearGradient
              colors={["#FF4D6D", "#E8002D"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.shareBtnGradient}
            >
              {isSharing ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Share2 size={18} color="#FFFFFF" />
                  <Text style={styles.shareBtnText}>Instagram Story&apos;de Paylaş</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
          </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  container: {
    width: "100%",
    maxWidth: 380,
    alignItems: "center",
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    marginBottom: 16,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 107, 139, 0.15)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  badgeText: {
    color: "#FF8FA3",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    justifyContent: "center",
    alignItems: "center",
  },
  emptyCard: {
    width: "100%",
    alignItems: "center",
    gap: 10,
    borderRadius: 24,
    paddingVertical: 36,
    paddingHorizontal: 24,
    backgroundColor: "#161220",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255, 77, 109, 0.12)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    color: "#FFFFFF",
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  emptyText: {
    color: "rgba(255, 255, 255, 0.65)",
    fontSize: 13.5,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
    textAlign: "center",
  },
  storyCard: {
    width: "100%",
    borderRadius: 24,
    overflow: "hidden",
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    elevation: 8,
    shadowColor: "#FF4D6D",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255, 77, 109, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  cardHeaderTitle: {
    color: "#FF8FA3",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.5,
    flex: 1,
  },
  cardDateText: {
    color: "rgba(255, 255, 255, 0.4)",
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  cardHeadline: {
    color: "#FFFFFF",
    fontSize: 22,
    fontFamily: "PlayfairDisplay_700Bold",
    lineHeight: 30,
    marginBottom: 20,
  },
  routeBox: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  stopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  dotStart: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#FF6B8B",
  },
  dotEnd: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#E8002D",
  },
  dashedLine: {
    width: 2,
    height: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    marginLeft: 4,
    marginVertical: 4,
  },
  stopTextGroup: {
    flex: 1,
  },
  stopLabel: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  stopValue: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  metricsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 18,
  },
  metricItem: {
    alignItems: "center",
    flex: 1,
  },
  metricNum: {
    color: "#FF8FA3",
    fontSize: 20,
    fontFamily: "Inter_700Bold",
  },
  metricLabel: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  metricDivider: {
    width: 1,
    height: 24,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  watermarkWrapper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingTop: 4,
  },
  watermarkDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#FF4D6D",
  },
  watermarkText: {
    color: "rgba(255, 255, 255, 0.55)",
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    letterSpacing: 0.5,
  },
  shareBtn: {
    marginTop: 18,
    width: "100%",
    height: 52,
    borderRadius: 26,
    overflow: "hidden",
    shadowColor: "#FF4D6D",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  shareBtnGradient: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  shareBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
});
