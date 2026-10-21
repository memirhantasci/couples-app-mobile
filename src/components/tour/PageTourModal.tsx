import React, { useState } from "react";
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from "react-native";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/context/ThemeContext";
import { PageTourGuide, FeatureItem } from "@/constants/featureGuides";
import {
  Home,
  CalendarHeart,
  Mail,
  Images,
  MapPin,
  Pill,
  Droplet,
  Clock,
  Sparkles,
  BookOpen,
  Settings,
  Heart,
  Flame,
  Calendar,
  StickyNote,
  Lock,
  Coins,
  Camera,
  Layers,
  Maximize2,
  CheckCircle,
  Bell,
  ShieldCheck,
  HelpCircle,
  X,
  ChevronLeft,
  ChevronRight,
  Lightbulb,
} from "lucide-react-native";

const ICON_MAP: Record<string, any> = {
  Home,
  CalendarHeart,
  Mail,
  Images,
  MapPin,
  Pill,
  Droplet,
  Clock,
  Sparkles,
  BookOpen,
  Settings,
  Heart,
  Flame,
  Calendar,
  StickyNote,
  Lock,
  Coins,
  Camera,
  Layers,
  Maximize2,
  CheckCircle,
  Bell,
  ShieldCheck,
  HelpCircle,
  Lightbulb,
};

function getIcon(iconName: string, size = 22, color = "#fff") {
  const IconComponent = ICON_MAP[iconName] || Sparkles;
  return <IconComponent size={size} color={color} />;
}

interface PageTourModalProps {
  visible: boolean;
  guide: PageTourGuide | null;
  onClose: () => void;
}

export function PageTourModal({ visible, guide, onClose }: PageTourModalProps) {
  const { theme, isLight } = useTheme();
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(0);

  // Reset to first step when modal opens
  const [wasVisible, setWasVisible] = useState(visible);
  if (wasVisible !== visible) {
    setWasVisible(visible);
    if (visible) setCurrentIndex(0);
  }

  if (!guide || !visible) return null;

  const features = guide.features;
  const currentFeature: FeatureItem | undefined = features[currentIndex];
  const isLastStep = currentIndex === features.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      onClose();
    } else {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        {/* Backdrop blur */}
        <BlurView
          intensity={Platform.OS === "ios" ? 40 : 80}
          tint={isLight ? "light" : "dark"}
          style={StyleSheet.absoluteFill}
        />

        <View
          style={[
            styles.container,
            {
              backgroundColor: isLight ? "#FFFFFF" : "rgba(24, 20, 32, 0.96)",
              borderColor: isLight ? theme.inputBorder : "rgba(255,255,255,0.12)",
              paddingBottom: Math.max(insets.bottom, 20),
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View
                style={[
                  styles.pageIconContainer,
                  {
                    backgroundColor: theme.pillAccentBg,
                    borderColor: theme.pillAccentBorder,
                  },
                ]}
              >
                {getIcon(guide.icon, 20, theme.accent)}
              </View>
              <View style={styles.headerTextCol}>
                <Text style={[styles.headerTagline, { color: theme.accent }]}>
                  {guide.tagline}
                </Text>
                <Text style={[styles.headerTitle, { color: theme.text }]}>
                  {guide.title} Rehberi
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={[
                styles.closeButton,
                {
                  backgroundColor: isLight
                    ? "rgba(0,0,0,0.05)"
                    : "rgba(255,255,255,0.08)",
                },
              ]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={18} color={theme.text} />
            </TouchableOpacity>
          </View>

          {/* Body */}
          {currentFeature && (
            <View style={styles.stepContent}>
              {/* Progress Indicator */}
              <View style={styles.stepProgressRow}>
                <Text
                  style={[
                    styles.stepCounterText,
                    { color: isLight ? "#8A8494" : "rgba(255,255,255,0.5)" },
                  ]}
                >
                  Özellik {currentIndex + 1} / {features.length}
                </Text>
                <View style={styles.stepDots}>
                  {features.map((_, i) => (
                    <View
                      key={i}
                      style={[
                        styles.dot,
                        i === currentIndex
                          ? [styles.activeDot, { backgroundColor: theme.accent }]
                          : {
                              backgroundColor: isLight
                                ? "rgba(0,0,0,0.12)"
                                : "rgba(255,255,255,0.18)",
                            },
                      ]}
                    />
                  ))}
                </View>
              </View>

              {/* Feature Card */}
              <ScrollView
                showsVerticalScrollIndicator={false}
                style={styles.cardScrollView}
                contentContainerStyle={styles.featureCardInner}
              >
                <View style={styles.featureHeaderRow}>
                  <View
                    style={[
                      styles.featureIconBox,
                      {
                        backgroundColor: theme.pillAccentBg,
                        borderColor: theme.pillAccentBorder,
                      },
                    ]}
                  >
                    {getIcon(currentFeature.icon, 24, theme.accent)}
                  </View>
                  <View style={styles.featureTitleCol}>
                    <View style={styles.featureBadgeWrapper}>
                      <Text style={[styles.featureTitle, { color: theme.text }]}>
                        {currentFeature.title}
                      </Text>
                      {currentFeature.badge && (
                        <View
                          style={[
                            styles.featureBadge,
                            { backgroundColor: theme.pillAccentBg },
                          ]}
                        >
                          <Text
                            style={[
                              styles.featureBadgeText,
                              { color: theme.accent },
                            ]}
                          >
                            {currentFeature.badge}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>

                <Text
                  style={[
                    styles.featureDesc,
                    {
                      color: isLight ? "#4E4858" : "rgba(255,255,255,0.82)",
                    },
                  ]}
                >
                  {currentFeature.description}
                </Text>

                {currentFeature.tip && (
                  <View
                    style={[
                      styles.tipBox,
                      {
                        backgroundColor: isLight
                          ? "rgba(0,0,0,0.03)"
                          : "rgba(255,255,255,0.05)",
                        borderColor: theme.pillAccentBorder,
                      },
                    ]}
                  >
                    <Lightbulb size={16} color={theme.accent} style={{ marginTop: 2 }} />
                    <View style={styles.tipTextCol}>
                      <Text
                        style={[
                          styles.tipTitle,
                          { color: theme.accent },
                        ]}
                      >
                        Aşk Püf Noktası
                      </Text>
                      <Text
                        style={[
                          styles.tipDesc,
                          {
                            color: isLight
                              ? "#6B6577"
                              : "rgba(255,255,255,0.7)",
                          },
                        ]}
                      >
                        {currentFeature.tip}
                      </Text>
                    </View>
                  </View>
                )}
              </ScrollView>

              {/* Step Navigation Controls */}
              <View style={styles.navigationRow}>
                {currentIndex > 0 ? (
                  <TouchableOpacity
                    onPress={handlePrev}
                    style={[
                      styles.navPrevBtn,
                      {
                        backgroundColor: isLight
                          ? "rgba(0,0,0,0.05)"
                          : "rgba(255,255,255,0.08)",
                        borderColor: isLight
                          ? "rgba(0,0,0,0.08)"
                          : "rgba(255,255,255,0.12)",
                      },
                    ]}
                    activeOpacity={0.8}
                  >
                    <ChevronLeft size={18} color={theme.text} />
                    <Text style={[styles.navPrevText, { color: theme.text }]}>
                      Geri
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <View style={{ width: 80 }} />
                )}

                <TouchableOpacity
                  onPress={handleNext}
                  style={[
                    styles.navNextBtn,
                    { backgroundColor: theme.accent },
                  ]}
                  activeOpacity={0.85}
                >
                  <Text style={styles.navNextText}>
                    {isLastStep ? "Anladım, Başla! 🎉" : "Sonraki"}
                  </Text>
                  {!isLastStep && <ChevronRight size={18} color="#FFFFFF" />}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  container: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    maxHeight: "88%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  pageIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  headerTextCol: {
    flex: 1,
  },
  headerTagline: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginTop: 2,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },

  // Step mode
  stepContent: {
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  stepProgressRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  stepCounterText: {
    fontSize: 12,
    fontWeight: "600",
  },
  stepDots: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  activeDot: {
    width: 20,
  },
  cardScrollView: {
    maxHeight: 330,
  },
  featureCardInner: {
    paddingBottom: 10,
  },
  featureHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  featureIconBox: {
    width: 50,
    height: 50,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  featureTitleCol: {
    flex: 1,
  },
  featureBadgeWrapper: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  featureBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  featureBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  featureDesc: {
    fontSize: 14.5,
    lineHeight: 22,
    fontWeight: "400",
    marginBottom: 16,
  },
  tipBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
  },
  tipTextCol: {
    flex: 1,
  },
  tipTitle: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 3,
  },
  tipDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  navigationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 18,
    paddingTop: 10,
  },
  navPrevBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 4,
  },
  navPrevText: {
    fontSize: 14,
    fontWeight: "600",
  },
  navNextBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 16,
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  navNextText: {
    color: "#FFFFFF",
    fontSize: 14.5,
    fontWeight: "700",
  },
});
