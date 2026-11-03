import type { RefObject } from "react";
import { Text, View } from "react-native";
import Svg, { Circle, Defs, Ellipse, G, LinearGradient as SvgLinearGradient, Path, RadialGradient, Stop } from "react-native-svg";
import { useTranslation } from "react-i18next";
import { dayjs } from "@/lib/date";
import type { CoupleStarDetails } from "@/modules/stars/types/star.types";
import { StoryCard } from "./StoryCard";
import { FoilSeal, GOLD, GoldKicker, GoldRule, sparklePath, type StoryScale } from "./storyDecor";

// Yıldızın çevresindeki eğik yörüngeler; her birinde bir gezegen (açı derece cinsinden)
const ORBITS = [
  { rx: 88, ry: 25, tilt: -18, opacity: 0.6, dash: undefined, planet: 212, planetR: 3.4 },
  { rx: 67, ry: 19, tilt: 14, opacity: 0.42, dash: "2 3", planet: 40, planetR: 2.6 },
  { rx: 47, ry: 13, tilt: -36, opacity: 0.3, dash: undefined, planet: 300, planetR: 2 },
] as const;

/** Eğik elips üzerindeki noktanın koordinatı (yörünge merkezi 100,100). */
function orbitPoint(rx: number, ry: number, tiltDeg: number, angleDeg: number) {
  const a = (angleDeg * Math.PI) / 180;
  const tilt = (tiltDeg * Math.PI) / 180;
  const x = rx * Math.cos(a);
  const y = ry * Math.sin(a);
  return { x: 100 + x * Math.cos(tilt) - y * Math.sin(tilt), y: 100 + x * Math.sin(tilt) + y * Math.cos(tilt) };
}

/** Parıldayan altın yıldız ve çevresinde dönen eliptik yörünge halkaları. */
function StarEmblem({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200">
      <Defs>
        <RadialGradient id="emblemGlow" cx={100} cy={100} r={96} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={GOLD.light} stopOpacity={0.55} />
          <Stop offset="0.35" stopColor={GOLD.base} stopOpacity={0.2} />
          <Stop offset="1" stopColor={GOLD.base} stopOpacity={0} />
        </RadialGradient>
        <SvgLinearGradient id="emblemStar" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFF6DA" />
          <Stop offset="0.5" stopColor={GOLD.base} />
          <Stop offset="1" stopColor={GOLD.deep} />
        </SvgLinearGradient>
      </Defs>
      <Circle cx={100} cy={100} r={96} fill="url(#emblemGlow)" />
      {ORBITS.map((orbit, index) => {
        const planet = orbitPoint(orbit.rx, orbit.ry, orbit.tilt, orbit.planet);
        return (
          <G key={index}>
            <Ellipse
              cx={100}
              cy={100}
              rx={orbit.rx}
              ry={orbit.ry}
              transform={`rotate(${orbit.tilt} 100 100)`}
              fill="none"
              stroke={GOLD.base}
              strokeOpacity={orbit.opacity}
              strokeWidth={0.9}
              strokeDasharray={orbit.dash}
            />
            <Circle cx={planet.x} cy={planet.y} r={orbit.planetR} fill={GOLD.light} opacity={0.9} />
          </G>
        );
      })}
      {/* Sekiz kollu yıldız: büyük dört kollu parıltı + 45° dönük küçük parıltı */}
      <Path d={sparklePath(100, 100, 21)} transform="rotate(45 100 100)" fill="url(#emblemStar)" opacity={0.75} />
      <Path d={sparklePath(100, 100, 38)} fill="url(#emblemStar)" />
      <Circle cx={100} cy={100} r={9} fill="#FFF6DA" opacity={0.55} />
      <Circle cx={100} cy={100} r={4.5} fill="#FFFFFF" />
    </Svg>
  );
}

/** Altın kenarlı astronomik künye levhası (2×2). */
function DataPlate({ s, cells }: { s: StoryScale; cells: readonly { label: string; value: string }[] }) {
  return (
    <View
      style={{
        alignSelf: "stretch",
        flexDirection: "row",
        flexWrap: "wrap",
        borderRadius: s(14),
        borderWidth: s(0.8),
        borderColor: GOLD.line,
        backgroundColor: "rgba(226, 184, 92, 0.06)",
      }}
    >
      {cells.map((cell, index) => (
        <View
          key={cell.label}
          style={{
            width: "50%",
            paddingVertical: s(7),
            paddingHorizontal: s(13),
            borderColor: "rgba(226, 184, 92, 0.32)",
            borderLeftWidth: index % 2 === 1 ? s(0.6) : 0,
            borderTopWidth: index >= 2 ? s(0.6) : 0,
          }}
        >
          <Text numberOfLines={1} style={{ color: GOLD.soft, fontSize: s(7.4), fontFamily: "Inter_700Bold", letterSpacing: s(1.1) }}>
            {cell.label}
          </Text>
          <Text numberOfLines={1} style={{ color: "#FFFFFF", fontSize: s(12.5), fontFamily: "Inter_600SemiBold", marginTop: s(3) }}>
            {cell.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

interface StarCertificateStoryCardProps {
  width: number;
  cardRef: RefObject<View | null>;
  star: CoupleStarDetails;
  /** "Emirhan & Elif" */
  names: string | null;
}

/** Yıldız tescilinin 9:16 Instagram hikâyesi kartı: "Bu yıldız artık resmi olarak bizim". */
export function StarCertificateStoryCard({ width, cardRef, star, names }: StarCertificateStoryCardProps) {
  const { t, i18n } = useTranslation();
  const dec = Number(star.dec);
  const registeredOn = dayjs(star.created_at).locale(i18n.language).format("D MMMM YYYY");
  const cells = [
    { label: t("stars.claim.catalogCode"), value: star.catalog_code },
    { label: t("stars.claim.spectralClass"), value: star.spectral_type },
    { label: "RIGHT ASCENSION", value: `${Number(star.ra).toFixed(4)}°` },
    { label: "DECLINATION", value: `${dec >= 0 ? "+" : "−"}${Math.abs(dec).toFixed(4)}°` },
  ] as const;

  return (
    <StoryCard width={width} cardRef={cardRef}>
      {(s) => (
        <View style={{ flex: 1, alignItems: "center" }}>
          <GoldKicker s={s}>Celestial Registry</GoldKicker>
          <GoldRule s={s} width={s(120)} style={{ marginTop: s(9) }} />
          <Text
            style={{
              marginTop: s(11),
              color: "#FFFFFF",
              fontSize: s(22),
              lineHeight: s(28),
              fontFamily: "PlayfairDisplay_700Bold",
              textAlign: "center",
              maxWidth: s(272),
            }}
          >
            {t("stars.claim.story.headline")}
          </Text>

          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <StarEmblem size={s(132)} />
            {/* Uzun isimler tek satıra sığacak kadar küçülür: kartın dikey düzeni kaymaz */}
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.5}
              style={{
                marginTop: -s(2),
                color: GOLD.ink,
                fontSize: s(32),
                lineHeight: s(40),
                fontFamily: "PlayfairDisplay_400Regular_Italic",
                textAlign: "center",
                maxWidth: s(290),
                textShadowColor: "rgba(226, 184, 92, 0.55)",
                textShadowOffset: { width: 0, height: 0 },
                textShadowRadius: s(14),
              }}
            >
              {star.custom_name}
            </Text>
            {star.common_name ? (
              <Text style={{ color: "rgba(255, 255, 255, 0.55)", fontSize: s(11), fontFamily: "Inter_500Medium", marginTop: s(2) }}>
                ({star.common_name})
              </Text>
            ) : null}
          </View>

          <DataPlate s={s} cells={cells} />

          {/* İsimler ortada; solda altın folyo mühür taşar, sağda aynı pay boş kalır */}
          <View style={{ alignSelf: "stretch", alignItems: "center", marginTop: s(11), paddingHorizontal: s(62), minHeight: s(46) }}>
            {names ? (
              <Text
                numberOfLines={2}
                style={{ color: "#FFFFFF", fontSize: s(15), lineHeight: s(20), fontFamily: "PlayfairDisplay_400Regular_Italic", textAlign: "center" }}
              >
                {names}
              </Text>
            ) : null}
            <Text style={{ color: GOLD.soft, fontSize: s(8.6), fontFamily: "Inter_600SemiBold", letterSpacing: s(0.8), marginTop: s(4), textAlign: "center" }}>
              {t("stars.claim.story.registeredOn", { date: registeredOn })}
            </Text>
          </View>

          <View pointerEvents="none" style={{ position: "absolute", left: -s(10), bottom: -s(10) }}>
            <FoilSeal s={s} size={80} text="COUPLESKY CELESTIAL REGISTRY ✦ OFFICIALLY SEALED ✦ " rotate={-14} />
          </View>
        </View>
      )}
    </StoryCard>
  );
}
