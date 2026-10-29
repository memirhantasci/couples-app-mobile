import React from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  X,
  Sparkles,
  Mail,
  Pill,
  Clock,
  Camera,
  MapPin,
  Flower,
  Smile,
  Bell,
  Play,
  CheckCircle,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCustomNotification } from "@/context/NotificationContext";
import { NotificationType, NOTIFICATION_THEMES } from "@/types/notification";
import { useTranslation } from "react-i18next";
import type { ParseKeys } from "i18next";

interface NotificationShowcaseModalProps {
  visible: boolean;
  onClose: () => void;
}

interface ShowcaseItem {
  type: NotificationType;
  titleKey: ParseKeys;
  subtitleKey: ParseKeys;
  descriptionKey: ParseKeys;
  icon: any;
  accent: string;
}

const SHOWCASE_ITEMS: ShowcaseItem[] = [
  {
    type: "letter",
    titleKey: "notifications.showcase.letter.title",
    subtitleKey: "notifications.showcase.letter.subtitle",
    descriptionKey: "notifications.showcase.letter.description",
    icon: Mail,
    accent: "#F5C563",
  },
  {
    type: "medicine",
    titleKey: "notifications.demo.medicine.title",
    subtitleKey: "notifications.showcase.medicine.subtitle",
    descriptionKey: "notifications.showcase.medicine.description",
    icon: Pill,
    accent: "#34D399",
  },
  {
    type: "medicine_reminder",
    titleKey: "notifications.showcase.reminder.title",
    subtitleKey: "notifications.showcase.reminder.subtitle",
    descriptionKey: "notifications.showcase.reminder.description",
    icon: Clock,
    accent: "#38BDF8",
  },
  {
    type: "photo",
    titleKey: "notifications.showcase.photo.title",
    subtitleKey: "notifications.showcase.photo.subtitle",
    descriptionKey: "notifications.showcase.photo.description",
    icon: Camera,
    accent: "#F472B6",
  },
  {
    type: "map",
    titleKey: "notifications.showcase.map.title",
    subtitleKey: "notifications.showcase.map.subtitle",
    descriptionKey: "notifications.showcase.map.description",
    icon: MapPin,
    accent: "#A78BFA",
  },
  {
    type: "period",
    titleKey: "notifications.showcase.period.title",
    subtitleKey: "notifications.showcase.period.subtitle",
    descriptionKey: "notifications.showcase.period.description",
    icon: Flower,
    accent: "#FB7185",
  },
  {
    type: "mood",
    titleKey: "notifications.showcase.mood.title",
    subtitleKey: "notifications.showcase.mood.subtitle",
    descriptionKey: "notifications.showcase.mood.description",
    icon: Smile,
    accent: "#FBBF24",
  },
];

export const NotificationShowcaseModal: React.FC<NotificationShowcaseModalProps> = ({
  visible,
  onClose,
}) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { triggerDemoNotification } = useCustomNotification();

  const handleTestNotification = (type: NotificationType) => {
    triggerDemoNotification(type);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 10 }]}>
        <View style={styles.sheetContainer}>
          <LinearGradient
            colors={["#230C16", "#14060C", "#0A0206"]}
            style={styles.sheetGradient}
          >
            {/* Header */}
            <View style={styles.headerRow}>
              <View style={styles.headerTitleWrap}>
                <View style={styles.headerBadge}>
                  <Bell size={14} color="#FF5C77" />
                  <Text style={styles.headerBadgeText}>{t("notifications.showcase.heading")}</Text>
                </View>
                <Text style={styles.headerTitle}>{t("notifications.showcase.title")}</Text>
                <Text style={styles.headerSubtitle}>
                  {t("notifications.showcase.subtitle")}
                </Text>
              </View>

              <TouchableOpacity
                onPress={onClose}
                style={styles.closeBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {/* List */}
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
            >
              {SHOWCASE_ITEMS.map((item) => {
                const IconComponent = item.icon;
                const themeConfig = NOTIFICATION_THEMES[item.type];

                return (
                  <View key={item.type} style={[styles.card, { borderColor: themeConfig.borderGlow }]}>
                    <LinearGradient
                      colors={themeConfig.gradient}
                      style={styles.cardInner}
                    >
                      <View style={styles.cardTopRow}>
                        <View style={[styles.iconBox, { backgroundColor: themeConfig.iconBg, borderColor: item.accent }]}>
                          <IconComponent size={20} color={item.accent} />
                        </View>
                        <View style={styles.cardTitleBox}>
                          <Text style={styles.cardTitle}>{t(item.titleKey)}</Text>
                          <Text style={[styles.cardSubtitle, { color: item.accent }]}>
                            {t(item.subtitleKey)}
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.cardDescription}>{t(item.descriptionKey)}</Text>

                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => handleTestNotification(item.type)}
                        style={[
                          styles.testButton,
                          {
                            backgroundColor: themeConfig.iconBg,
                            borderColor: item.accent,
                          },
                        ]}
                      >
                        <Play size={13} color={item.accent} fill={item.accent} />
                        <Text style={[styles.testButtonText, { color: item.accent }]}>
                          {t("notifications.showcase.tryLive")}
                        </Text>
                      </TouchableOpacity>
                    </LinearGradient>
                  </View>
                );
              })}
            </ScrollView>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.78)",
    justifyContent: "flex-end",
    paddingHorizontal: 10,
  },
  sheetContainer: {
    height: "88%",
    borderRadius: 26,
    overflow: "hidden",
    borderWidth: 1.2,
    borderColor: "rgba(255, 92, 119, 0.3)",
  },
  sheetGradient: {
    flex: 1,
    paddingTop: 18,
    paddingHorizontal: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
  },
  headerTitleWrap: {
    flex: 1,
    marginRight: 10,
  },
  headerBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 92, 119, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: "flex-start",
    gap: 5,
    marginBottom: 6,
  },
  headerBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#FF5C77",
    letterSpacing: 0.8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  headerSubtitle: {
    fontSize: 12.5,
    color: "rgba(255, 255, 255, 0.65)",
    marginTop: 3,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    paddingBottom: 30,
    gap: 12,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
  },
  cardInner: {
    padding: 14,
    borderRadius: 18,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  cardTitleBox: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  cardSubtitle: {
    fontSize: 11.5,
    fontWeight: "600",
    marginTop: 1,
  },
  cardDescription: {
    fontSize: 12.5,
    color: "rgba(255, 255, 255, 0.78)",
    lineHeight: 18,
    marginBottom: 12,
  },
  testButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  testButtonText: {
    fontSize: 12,
    fontWeight: "700",
  },
});
