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

interface NotificationShowcaseModalProps {
  visible: boolean;
  onClose: () => void;
}

interface ShowcaseItem {
  type: NotificationType;
  title: string;
  subtitle: string;
  description: string;
  icon: any;
  accent: string;
}

const SHOWCASE_ITEMS: ShowcaseItem[] = [
  {
    type: "letter",
    title: "Mühürlü Aşk Mektubu 💌",
    subtitle: "Gelecekten Bir Mektup Geldiğinde",
    description: "Altın varaklı mühür rozeti, parşömen ışıltısı ve doğrudan 'Mektuplara Git' butonu içeren romantik tasarım.",
    icon: Mail,
    accent: "#F5C563",
  },
  {
    type: "medicine",
    title: "İlacını İçti! 💊✨",
    subtitle: "Partner İlacını Aldığında",
    description: "Zümrüt yeşili & nane temalı, su damlası rozeti ve doğrudan 'İlaç Takibine Git' butonu içeren sağlık tasarımı.",
    icon: Pill,
    accent: "#34D399",
  },
  {
    type: "medicine_reminder",
    title: "İlaç Vakti Geldi 💧",
    subtitle: "Günlük Hatırlatıcı Kurulduğunda",
    description: "Mavi gök tonlarında saat ve su uyarısı içeren, doğrudan ilaç sayfasına yönlendiren hatırlatıcı kartı.",
    icon: Clock,
    accent: "#38BDF8",
  },
  {
    type: "photo",
    title: "Yeni Bir Anı & Fotoğraf 📸",
    subtitle: "Ortak Albüme Fotoğraf Eklendiğinde",
    description: "Polaroid çerçeve hissi veren, gün batımı tonlarında parıltılı fotoğraf bildirimi.",
    icon: Camera,
    accent: "#F472B6",
  },
  {
    type: "map",
    title: "Haritada Aşk Notu 📍",
    subtitle: "Bir Konuma Gizli Not Bırakıldığında",
    description: "Büyüleyici lavanta-gece mavisi tonlarında, konum pini ve harita keşif kartı.",
    icon: MapPin,
    accent: "#A78BFA",
  },
  {
    type: "period",
    title: "Regl & Şefkat Desteği 🌸",
    subtitle: "Döngü Başlangıcı Paylaşıldığında",
    description: "Yumuşak pembe, nilüfer çiçeği ve doğrudan 'Döngü Takibine Git' butonu sunan özel bakım bildirimi.",
    icon: Flower,
    accent: "#FB7185",
  },
  {
    type: "mood",
    title: "Ruh Hali Güncellemesi ✨",
    subtitle: "Partner Günün Modunu Seçtiğinde",
    description: "Güneş sarısı ışıltısı ve 'Ana Sayfaya Git' butonu içeren ruh hali kartı.",
    icon: Smile,
    accent: "#FBBF24",
  },
];

export const NotificationShowcaseModal: React.FC<NotificationShowcaseModalProps> = ({
  visible,
  onClose,
}) => {
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
                  <Text style={styles.headerBadgeText}>ÖZEL BİLDİRİM TASARIMLARI</Text>
                </View>
                <Text style={styles.headerTitle}>Bildirim Görsel Vitrini ✨</Text>
                <Text style={styles.headerSubtitle}>
                  Aşağıdaki tasarımlara dokunarak canlı bildirim kartlarını test edin.
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
                          <Text style={styles.cardTitle}>{item.title}</Text>
                          <Text style={[styles.cardSubtitle, { color: item.accent }]}>
                            {item.subtitle}
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.cardDescription}>{item.description}</Text>

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
                          Bu Bildirimi Canlı Göster
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
