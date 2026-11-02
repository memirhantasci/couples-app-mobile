import { useRef, useState, useMemo } from "react";
import { logger } from "@/utils/logger";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { X, Share2, Sparkles, Compass } from "lucide-react-native";
import { AppTheme } from "@/lib/theme";
import { shareStoryImage } from "@/lib/storyShare";
import { StoryCard, STORY_ASPECT, type StoryPalette, type StoryScale } from "@/components/share/StoryCard";
import { dayjs } from "@/lib/date";
import { useTranslation } from "react-i18next";


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

// Önizlemenin üstündeki başlık satırı ile altındaki paylaş butonunun (aralıklarıyla) kapladığı yükseklik
const CHROME_HEIGHT = 170;

const ROUTE_PALETTE: StoryPalette = {
  background: ["#150E1F", "#2D1236", "#120A18"],
  glow: "216, 88, 112",
  decor: "#EC7E95",
};

function StopRow({ s, color, label, value }: { s: StoryScale; color: string; label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: s(12) }}>
      <View style={{ width: s(10), height: s(10), borderRadius: s(5), backgroundColor: color }} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: "rgba(255, 255, 255, 0.55)", fontSize: s(10.5), fontFamily: "Inter_400Regular" }}>{label}</Text>
        <Text numberOfLines={2} style={{ color: "#FFFFFF", fontSize: s(14), lineHeight: s(19), fontFamily: "Inter_600SemiBold" }}>
          {value}
        </Text>
      </View>
    </View>
  );
}

export function MapStoryModal({ visible, onClose, pins, theme }: MapStoryModalProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
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

    const firstPlace = pins[pins.length - 1]?.location_name || t("map.story.firstStop");
    const latestPlace = pins[0]?.location_name || t("map.story.latestRoute");
    const cityCount = Math.max(1, locationNames.length);

    return {
      totalPins,
      locationsList: locationNames,
      maxDistanceKm: maxDist > 0 ? maxDist : 12,
      firstPlace,
      latestPlace,
      headline:
        maxDist > 50
          ? t("map.story.headlineMany", { count: cityCount, maxDist })
          : t("map.story.headlinePins", { count: totalPins }),
    };
  }, [pins, visible, t]);

  // Önizleme 9:16 hikâye oranında; ekrana sığan en büyük boyda çizilir
  const storyWidth = Math.floor(
    Math.min(windowWidth - 48, (windowHeight - insets.top - insets.bottom - CHROME_HEIGHT) * STORY_ASPECT)
  );

  const handleShare = async () => {
    if (!stats) return;
    try {
      setIsSharing(true);
      await shareStoryImage(shareCardRef, {
        dialogTitle: t("map.story.shareTitle"),
        fallbackMessage: `${stats.headline} · ${t("common.madeWith")}`,
      });
    } catch (error) {
      logger.warn("Map story share error:", error);
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
          <View style={[styles.topBar, stats ? { width: storyWidth } : null]}>
            <View style={styles.badge}>
              <Sparkles size={14} color="#EC7E95" />
              <Text style={styles.badgeText}>{t("map.story.title")}</Text>
            </View>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("a11y.close")} onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={styles.closeBtn}>
              <X size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {!stats ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconCircle}>
                <Compass size={26} color="#D85870" />
              </View>
              <Text style={styles.emptyTitle}>{t("map.story.emptyTitle")}</Text>
              <Text style={styles.emptyText}>
                {t("map.story.emptyDescription")}
              </Text>
            </View>
          ) : (
          <>
          {/* Dışa aktarılan görsel tam bu karttır: 1080×1920 (Instagram hikâyesi), kenar boşluksuz */}
          <StoryCard
            width={storyWidth}
            cardRef={shareCardRef}
            palette={ROUTE_PALETTE}
            backdrop={
              <View pointerEvents="none" style={styles.storyBackdrop}>
                <Compass size={storyWidth * 0.95} color="rgba(255, 255, 255, 0.04)" />
              </View>
            }
          >
            {(s) => (
              <>
                <View style={styles.storyHeader}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: s(6),
                      backgroundColor: "rgba(255, 255, 255, 0.09)",
                      borderRadius: s(14),
                      paddingHorizontal: s(12),
                      paddingVertical: s(6),
                    }}
                  >
                    <Compass size={s(13)} color="#FF8FA3" />
                    <Text style={{ color: "#FF8FA3", fontSize: s(10.5), fontFamily: "Inter_700Bold", letterSpacing: s(1.6) }}>
                      OUR LOVE ROUTE
                    </Text>
                  </View>
                  <Text style={{ marginTop: s(8), color: "rgba(255, 255, 255, 0.6)", fontSize: s(11.5), fontFamily: "Inter_500Medium" }}>
                    {dayjs().format("YYYY")}
                  </Text>
                </View>

                <View style={styles.storyMiddle}>
                  <Text
                    numberOfLines={4}
                    style={{
                      color: "#FFFFFF",
                      fontSize: s(27),
                      lineHeight: s(36),
                      fontFamily: "PlayfairDisplay_700Bold",
                      textAlign: "center",
                      marginBottom: s(24),
                    }}
                  >
                    {stats.headline}
                  </Text>

                  <View
                    style={{
                      backgroundColor: "rgba(255, 255, 255, 0.07)",
                      borderRadius: s(20),
                      borderWidth: StyleSheet.hairlineWidth,
                      borderColor: "rgba(255, 255, 255, 0.14)",
                      padding: s(16),
                    }}
                  >
                    <StopRow s={s} color="#EC7E95" label={t("map.story.firstStopLabel")} value={stats.firstPlace} />
                    <View style={{ marginLeft: s(4), marginVertical: s(4) }}>
                      {[0, 1, 2, 3].map((dot) => (
                        <View
                          key={dot}
                          style={{
                            width: s(2),
                            height: s(4),
                            marginVertical: s(2),
                            borderRadius: 1,
                            backgroundColor: "rgba(255, 255, 255, 0.3)",
                          }}
                        />
                      ))}
                    </View>
                    <StopRow s={s} color="#FFFFFF" label={t("map.story.latestRouteLabel")} value={stats.latestPlace} />
                  </View>
                </View>

                <View style={{ flexDirection: "row", gap: s(8) }}>
                  {[
                    { value: stats.totalPins, label: t("map.story.trail") },
                    { value: stats.maxDistanceKm, label: t("map.story.kilometers") },
                    { value: Math.max(1, stats.locationsList.length), label: t("map.story.explored") },
                  ].map((metric) => (
                    <View
                      key={metric.label}
                      style={{
                        flex: 1,
                        alignItems: "center",
                        backgroundColor: "rgba(255, 255, 255, 0.07)",
                        borderRadius: s(16),
                        borderWidth: StyleSheet.hairlineWidth,
                        borderColor: "rgba(255, 255, 255, 0.14)",
                        paddingVertical: s(12),
                      }}
                    >
                      <Text style={{ color: "#FF8FA3", fontSize: s(24), fontFamily: "Inter_700Bold" }}>{metric.value}</Text>
                      <Text style={{ color: "rgba(255, 255, 255, 0.6)", fontSize: s(10), fontFamily: "Inter_400Regular", marginTop: s(2) }}>
                        {metric.label}
                      </Text>
                    </View>
                  ))}
                </View>

                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: s(6), marginTop: s(16) }}>
                  <View style={{ width: s(4), height: s(4), borderRadius: s(2), backgroundColor: "#D85870" }} />
                  <Text style={{ color: "rgba(255, 255, 255, 0.6)", fontSize: s(10.5), fontFamily: "Inter_500Medium", letterSpacing: s(0.5) }}>
                    {t("common.madeWith")}
                  </Text>
                </View>
              </>
            )}
          </StoryCard>

          {/* Paylaşım Butonu */}
          <TouchableOpacity
            onPress={handleShare}
            disabled={isSharing}
            activeOpacity={0.85}
            style={[styles.shareBtn, { width: storyWidth }]}
          >
            <LinearGradient
              colors={["#D85870", "#C8213F"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.shareBtnGradient}
            >
              {isSharing ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Share2 size={18} color="#FFFFFF" />
                  <Text style={styles.shareBtnText}>{t("map.story.shareInstagram")}</Text>
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
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(216, 88, 112, 0.12)",
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
  storyBackdrop: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
  storyHeader: {
    alignItems: "center",
  },
  storyMiddle: {
    flex: 1,
    justifyContent: "center",
  },
  shareBtn: {
    marginTop: 18,
    height: 52,
    borderRadius: 26,
    overflow: "hidden",
    shadowColor: "#D85870",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
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
