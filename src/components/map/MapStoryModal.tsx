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
import Svg, { Line, Path, Rect } from "react-native-svg";
import { X, Share2, Sparkles, Compass, Plane } from "lucide-react-native";
import { AppTheme } from "@/lib/theme";
import { shareStoryImage } from "@/lib/storyShare";
import { caseLocale } from "@/lib/textCase";
import { StoryCard, STORY_ASPECT, type StoryScale } from "@/components/share/StoryCard";
import { FoilSeal, GOLD, PhotoPlaceholder, StoryPhoto, seeded } from "@/components/share/storyDecor";
import { dayjs } from "@/lib/date";
import { useTranslation } from "react-i18next";


interface MapPinItem {
  id: number;
  latitude: number;
  longitude: number;
  location_name?: string | null;
  date?: string;
  type: "photo" | "note" | "meeting";
  /** Fotoğraf pinlerinde küçük resim yolu (pullarda gösterilir) */
  photo_path?: string | null;
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

// ─── Aşk Pasaportu: hikâye kartının parçaları (ölçüler 360×640 tasarım birimi) ───────────────
const PAPER = "#F7EEDC";
const INK = "#3B2418";
const INK_SOFT = "rgba(59, 36, 24, 0.55)";
const POSTMARK = "rgba(200, 33, 63, 0.6)";

const STAMP_W = 84;
const STAMP_H = 100;
const TICKET_W = 304;
const TICKET_H = 112;
const TICKET_TEAR_Y = 72;

/** Kenarları tırtıklı (delikli) pul gövdesi: her kenarda içe doğru yarım daire delikler. */
function stampPath(w: number, h: number, r: number, spacing: number): string {
  const nx = Math.max(3, Math.round(w / spacing));
  const ny = Math.max(3, Math.round(h / spacing));
  const sx = w / nx;
  const sy = h / ny;
  // Saat yönünde dolaşılır; sweep 0 her kenarda yayı içe büker
  let d = "M 0 0";
  for (let i = 0; i < nx; i++) {
    const c = (i + 0.5) * sx;
    d += ` L ${c - r} 0 A ${r} ${r} 0 0 0 ${c + r} 0`;
  }
  d += ` L ${w} 0`;
  for (let i = 0; i < ny; i++) {
    const c = (i + 0.5) * sy;
    d += ` L ${w} ${c - r} A ${r} ${r} 0 0 0 ${w} ${c + r}`;
  }
  d += ` L ${w} ${h}`;
  for (let i = 0; i < nx; i++) {
    const c = w - (i + 0.5) * sx;
    d += ` L ${c + r} ${h} A ${r} ${r} 0 0 0 ${c - r} ${h}`;
  }
  d += ` L 0 ${h}`;
  for (let i = 0; i < ny; i++) {
    const c = h - (i + 0.5) * sy;
    d += ` L 0 ${c + r} A ${r} ${r} 0 0 0 0 ${c - r}`;
  }
  return `${d} Z`;
}

/** Yanlarında yırtma çentikleri olan biniş kartı gövdesi. */
function ticketPath(w: number, h: number, corner: number, tearY: number, notch: number): string {
  return (
    `M ${corner} 0 H ${w - corner} Q ${w} 0 ${w} ${corner} V ${tearY - notch} ` +
    `A ${notch} ${notch} 0 0 0 ${w} ${tearY + notch} V ${h - corner} Q ${w} ${h} ${w - corner} ${h} ` +
    `H ${corner} Q 0 ${h} 0 ${h - corner} V ${tearY + notch} A ${notch} ${notch} 0 0 0 0 ${tearY - notch} ` +
    `V ${corner} Q 0 0 ${corner} 0 Z`
  );
}

const STAMP_PATH = stampPath(STAMP_W, STAMP_H, 2.6, 8);
const TICKET_PATH = ticketPath(TICKET_W, TICKET_H, 12, TICKET_TEAR_Y, 7);

/** Biniş kartındaki havalimanı kodu gibi: yer adının ilk üç harfi ("İstanbul" → "İST"). */
function placeCode(place: string): string {
  const letters = Array.from(place).filter((ch) => /\p{L}/u.test(ch));
  return letters.length >= 3 ? letters.slice(0, 3).join("").toLocaleUpperCase(caseLocale()) : "LOV";
}

/** İçinde minik fotoğraf olan nostaljik pul. */
function LoveStamp({ s, photoPath, rotate }: { s: StoryScale; photoPath: string | null; rotate: number }) {
  return (
    <View style={{ width: s(STAMP_W), height: s(STAMP_H), transform: [{ rotate: `${rotate}deg` }] }}>
      <Svg width={s(STAMP_W)} height={s(STAMP_H)} viewBox={`0 0 ${STAMP_W} ${STAMP_H}`} style={StyleSheet.absoluteFill}>
        <Path d={STAMP_PATH} fill={PAPER} />
        <Rect x={6.5} y={6.5} width={STAMP_W - 13} height={STAMP_H - 13} fill="none" stroke={GOLD.deep} strokeOpacity={0.55} strokeWidth={0.6} />
      </Svg>
      <View style={{ position: "absolute", left: s(9), top: s(9), width: s(STAMP_W - 18), height: s(STAMP_H - 30), overflow: "hidden" }}>
        {photoPath ? <StoryPhoto photo={{ bucket: "photos", path: photoPath }} style={StyleSheet.absoluteFill} /> : <PhotoPlaceholder s={s} iconSize={24} />}
      </View>
      <View style={{ position: "absolute", left: s(10), right: s(10), bottom: s(8), flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ color: INK_SOFT, fontSize: s(6.4), fontFamily: "Inter_700Bold", letterSpacing: s(1) }}>LOVE POST</Text>
        <Text style={{ color: POSTMARK, fontSize: s(7), fontFamily: "Inter_800ExtraBold" }}>♥</Text>
      </View>
    </View>
  );
}

/** Pulun altındaki durak etiketi. */
function StopCaption({ s, label, place }: { s: StoryScale; label: string; place: string }) {
  return (
    <View style={{ width: s(112), alignItems: "center" }}>
      <Text style={{ color: GOLD.soft, fontSize: s(7.4), fontFamily: "Inter_700Bold", letterSpacing: s(1.2) }}>
        {label.toLocaleUpperCase(caseLocale())}
      </Text>
      <Text
        numberOfLines={2}
        style={{ marginTop: s(2), color: "#FFFFFF", fontSize: s(10.5), lineHeight: s(13.5), fontFamily: "Inter_600SemiBold", textAlign: "center" }}
      >
        {place}
      </Text>
    </View>
  );
}

/** Sabit tohumlu barkod çubukları (aynı rota → aynı barkod). */
function Barcode({ s, width, height, seed }: { s: StoryScale; width: number; height: number; seed: number }) {
  const gap = 1.1;
  const bars: { x: number; width: number }[] = [];
  let cursor = 0;
  for (let i = 0; i < 44; i++) {
    const barWidth = 0.8 + Math.floor(seeded(i, seed) * 3) * 0.95;
    bars.push({ x: cursor, width: barWidth });
    cursor += barWidth + gap;
  }
  const total = cursor - gap;
  return (
    <Svg width={s(width)} height={s(height)} viewBox={`0 0 ${total} 10`} preserveAspectRatio="none">
      {bars.map((bar, index) => (
        <Rect key={index} x={bar.x} y={0} width={bar.width} height={10} fill={INK} opacity={0.82} />
      ))}
    </Svg>
  );
}

/** Uçak biletinin biniş kartı düzeninde rota metrikleri. */
function BoardingPass({
  s,
  metrics,
  year,
  route,
  seed,
}: {
  s: StoryScale;
  metrics: readonly { value: number; label: string }[];
  year: string;
  route: string;
  seed: number;
}) {
  return (
    <View style={{ width: s(TICKET_W), height: s(TICKET_H) }}>
      <Svg width={s(TICKET_W)} height={s(TICKET_H)} viewBox={`0 0 ${TICKET_W} ${TICKET_H}`} style={StyleSheet.absoluteFill}>
        <Path d={TICKET_PATH} fill={PAPER} stroke={GOLD.deep} strokeOpacity={0.5} strokeWidth={0.8} />
        <Line x1={14} y1={TICKET_TEAR_Y} x2={TICKET_W - 14} y2={TICKET_TEAR_Y} stroke={INK} strokeOpacity={0.28} strokeWidth={0.8} strokeDasharray="3 3" />
      </Svg>

      <View style={{ height: s(TICKET_TEAR_Y), paddingHorizontal: s(16), paddingTop: s(10) }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ color: INK_SOFT, fontSize: s(7.2), fontFamily: "Inter_700Bold", letterSpacing: s(1.6) }}>BOARDING PASS</Text>
          <Text style={{ color: INK_SOFT, fontSize: s(7.2), fontFamily: "Inter_700Bold", letterSpacing: s(1.6) }}>{`CS · ${year}`}</Text>
        </View>
        <View style={{ flexDirection: "row", marginTop: s(7) }}>
          {metrics.map((metric, index) => (
            <View
              key={metric.label}
              style={{
                flex: 1,
                alignItems: "center",
                borderLeftWidth: index > 0 ? s(0.6) : 0,
                borderColor: "rgba(59, 36, 24, 0.16)",
              }}
            >
              <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: INK, fontSize: s(21), lineHeight: s(26), fontFamily: "PlayfairDisplay_700Bold" }}>
                {metric.value}
              </Text>
              <Text numberOfLines={1} style={{ color: INK_SOFT, fontSize: s(7), fontFamily: "Inter_700Bold", letterSpacing: s(0.8) }}>
                {metric.label.toLocaleUpperCase(caseLocale())}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={{ flex: 1, flexDirection: "row", alignItems: "center", paddingHorizontal: s(16), gap: s(12) }}>
        <Barcode s={s} width={170} height={20} seed={seed} />
        <Text numberOfLines={1} adjustsFontSizeToFit style={{ flex: 1, textAlign: "right", color: INK, fontSize: s(11), fontFamily: "Inter_800ExtraBold", letterSpacing: s(1.2) }}>
          {route}
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
    // Pullar: rotanın en eski ve en yeni fotoğrafı (pinler yeniden eskiye sıralı). Tek fotoğraf varsa son pulda.
    const photoPaths = pins.map((p) => p.photo_path).filter((path): path is string => !!path);

    return {
      totalPins,
      locationsList: locationNames,
      maxDistanceKm: maxDist > 0 ? maxDist : 12,
      firstPlace,
      latestPlace,
      firstPhoto: photoPaths.length > 1 ? photoPaths[photoPaths.length - 1] : null,
      lastPhoto: photoPaths[0] ?? null,
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

  const year = dayjs().format("YYYY");

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
          <StoryCard width={storyWidth} cardRef={shareCardRef}>
            {(s) => (
              <View style={styles.storyColumn}>
                {/* Pasaport başlığı ve sağ üstte resmi seyahat damgası */}
                <View style={{ alignSelf: "stretch", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View>
                    <Text style={{ color: GOLD.ink, fontSize: s(9.5), fontFamily: "Inter_700Bold", letterSpacing: s(2.6) }}>
                      ✦ OUR LOVE ROUTE
                    </Text>
                    <Text style={{ marginTop: s(3), color: "rgba(255, 255, 255, 0.6)", fontSize: s(10), fontFamily: "Inter_600SemiBold", letterSpacing: s(1.6) }}>
                      {`LOVE PASSPORT · ${year}`}
                    </Text>
                  </View>
                  <FoilSeal s={s} size={62} text={`OFFICIAL LOVE ROUTE ✦ ${year} ✦ `} center={year} rotate={12} />
                </View>

                <Text
                  numberOfLines={2}
                  adjustsFontSizeToFit
                  style={{
                    alignSelf: "stretch",
                    color: "#FFFFFF",
                    fontSize: s(20),
                    lineHeight: s(26),
                    fontFamily: "PlayfairDisplay_700Bold",
                    textAlign: "center",
                  }}
                >
                  {stats.headline}
                </Text>

                {/* İlk ve son durağın pulları; aralarında altın kesikli rota */}
                <View style={{ width: s(304), height: s(158) }}>
                  <Svg width={s(304)} height={s(158)} viewBox="0 0 304 158" style={StyleSheet.absoluteFill}>
                    <Path
                      d="M 94 52 Q 154 -6 212 60"
                      fill="none"
                      stroke={GOLD.base}
                      strokeWidth={1.4}
                      strokeDasharray="4 4"
                      strokeLinecap="round"
                    />
                  </Svg>
                  {/* Rotanın tepesindeki uçak (lucide ikonu sağ üste bakar: 45° çevrilerek yola hizalanır) */}
                  <View style={{ position: "absolute", left: s(153.5 - 8), top: s(25 - 8), transform: [{ rotate: "45deg" }] }}>
                    <Plane size={s(16)} color={GOLD.ink} fill={GOLD.ink} />
                  </View>
                  <View style={{ position: "absolute", left: s(4), top: s(6) }}>
                    <LoveStamp s={s} photoPath={stats.firstPhoto} rotate={-6} />
                  </View>
                  <View style={{ position: "absolute", right: s(4), top: s(12) }}>
                    <LoveStamp s={s} photoPath={stats.lastPhoto} rotate={5} />
                  </View>
                  <View style={{ position: "absolute", left: -s(10), bottom: 0 }}>
                    <StopCaption s={s} label={t("map.story.firstStopLabel")} place={stats.firstPlace} />
                  </View>
                  <View style={{ position: "absolute", right: -s(10), bottom: 0 }}>
                    <StopCaption s={s} label={t("map.story.latestRouteLabel")} place={stats.latestPlace} />
                  </View>
                </View>

                <BoardingPass
                  s={s}
                  year={year}
                  route={`${placeCode(stats.firstPlace)} ✈ ${placeCode(stats.latestPlace)}`}
                  seed={stats.totalPins + stats.maxDistanceKm}
                  metrics={[
                    { value: stats.totalPins, label: t("map.story.trail") },
                    { value: stats.maxDistanceKm, label: t("map.story.kilometers") },
                    { value: Math.max(1, stats.locationsList.length), label: t("map.story.explored") },
                  ]}
                />
              </View>
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
  // Pasaport kartının dikey düzeni: başlık, manşet, pullar ve biniş kartı güvenli bölgeye yayılır
  storyColumn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "space-between",
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
