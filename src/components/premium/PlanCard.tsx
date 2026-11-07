import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Check } from "lucide-react-native";
import { PREMIUM_GOLD } from "./PaywallHero";

interface Props {
  title: string;
  price: string;
  period: string;
  caption?: string;
  badge?: string;
  badgeStrong?: boolean;
  trial?: string;
  selected: boolean;
  onPress: () => void;
  isLight: boolean;
  colors: { text: string; textSecondary: string; cardBg: string; border: string; gold: string };
}

export function PlanCard({
  title,
  price,
  period,
  caption,
  badge,
  badgeStrong,
  trial,
  selected,
  onPress,
  isLight,
  colors,
}: Props) {
  const idleBorder = isLight ? "rgba(0,0,0,0.09)" : "rgba(255,255,255,0.12)";
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${title}, ${price} ${period}`}
      style={styles.outer}
    >
      <View
        style={[
          styles.card,
          {
            backgroundColor: selected ? (isLight ? "#FFF8E3" : "rgba(230,185,74,0.10)") : colors.cardBg,
            borderColor: selected ? colors.gold : idleBorder,
            shadowColor: colors.gold,
            shadowOpacity: selected ? 0.35 : 0,
            shadowRadius: selected ? 18 : 0,
            elevation: selected && isLight ? 6 : 0,
          },
        ]}
      >
        <View style={styles.left}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
            {trial ? (
              <View style={[styles.trialPill, { backgroundColor: `${colors.gold}22`, borderColor: `${colors.gold}66` }]}>
                <Text style={[styles.trialText, { color: colors.gold }]}>{trial}</Text>
              </View>
            ) : null}
          </View>
          {caption ? <Text style={[styles.caption, { color: colors.textSecondary }]}>{caption}</Text> : null}
        </View>

        <View style={styles.right}>
          <Text style={[styles.price, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
            {price}
          </Text>
          {period ? <Text style={[styles.period, { color: colors.textSecondary }]}>{period}</Text> : null}
        </View>

        <View style={[styles.radio, { borderColor: selected ? colors.gold : idleBorder }]}>
          {selected ? (
            <LinearGradient colors={PREMIUM_GOLD} style={styles.radioFill}>
              <Check size={13} color="#3A2A06" strokeWidth={3.2} />
            </LinearGradient>
          ) : null}
        </View>
      </View>

      {badge ? (
        badgeStrong ? (
          <LinearGradient colors={PREMIUM_GOLD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.badge}>
            <Text style={[styles.badgeText, { color: "#3A2A06" }]}>{badge}</Text>
          </LinearGradient>
        ) : (
          <View style={[styles.badge, { backgroundColor: isLight ? "#EDE7D6" : "rgba(255,255,255,0.14)" }]}>
            <Text style={[styles.badgeText, { color: colors.textSecondary }]}>{badge}</Text>
          </View>
        )
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  outer: { paddingTop: 10 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 18,
    paddingLeft: 18,
    paddingRight: 14,
    borderRadius: 22,
    borderWidth: 1.8,
    gap: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  left: { flex: 1.15, gap: 4 },
  titleRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  title: { fontSize: 17, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
  caption: { fontSize: 12.5, fontFamily: "Inter_500Medium" },
  trialPill: { paddingHorizontal: 8, paddingVertical: 2.5, borderRadius: 8, borderWidth: 1 },
  trialText: { fontSize: 10.5, fontFamily: "Inter_700Bold" },
  right: { flex: 1, alignItems: "flex-end" },
  price: { fontSize: 18, fontFamily: "Inter_700Bold", letterSpacing: -0.4 },
  period: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 1 },
  radio: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: "center", justifyContent: "center", marginLeft: 4 },
  radioFill: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  badge: { position: "absolute", top: 0, right: 18, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9 },
  badgeText: { fontSize: 10.5, fontFamily: "Inter_700Bold", letterSpacing: 0.6 },
});
