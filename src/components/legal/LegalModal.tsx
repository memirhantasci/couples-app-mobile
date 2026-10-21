import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  X,
  ShieldCheck,
  FileText,
  Lock,
  CreditCard,
  UserCheck,
  Check,
  Calendar,
} from "lucide-react-native";
import { LEGAL_DOCS, LegalDocType } from "@/constants/legalTexts";
import { getTheme } from "@/lib/theme";

interface LegalModalProps {
  visible: boolean;
  onClose: () => void;
  initialDoc?: LegalDocType;
  accentColor?: string;
}

const TABS: { id: LegalDocType; label: string; icon: any }[] = [
  { id: "kvkk", label: "KVKK", icon: ShieldCheck },
  { id: "privacy", label: "Gizlilik", icon: Lock },
  { id: "terms", label: "Koşullar", icon: FileText },
  { id: "consent", label: "Açık Rıza", icon: UserCheck },
  { id: "subscription", label: "Abonelik", icon: CreditCard },
];

export function LegalModal({
  visible,
  onClose,
  initialDoc = "kvkk",
  accentColor = "#FF4D6D",
}: LegalModalProps) {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<LegalDocType>(initialDoc);

  // Her açılışta istenen belgeden başlanır
  const openKey = visible ? initialDoc : null;
  const [appliedOpenKey, setAppliedOpenKey] = useState(openKey);
  if (appliedOpenKey !== openKey) {
    setAppliedOpenKey(openKey);
    if (openKey) setActiveTab(openKey);
  }

  const currentDoc = LEGAL_DOCS[activeTab] || LEGAL_DOCS.kvkk;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { paddingTop: insets.top + (Platform.OS === "android" ? 16 : 8) }]}>
        {/* Ambient Top Glow */}
        <View
          style={[styles.glowEffect, { backgroundColor: `${accentColor}18` }]}
          pointerEvents="none"
        />

        {/* ─── MODAL HEADER ─── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={[styles.headerIconBox, { backgroundColor: `${accentColor}20`, borderColor: `${accentColor}40` }]}>
              <ShieldCheck color={accentColor} size={20} />
            </View>
            <View>
              <Text style={styles.headerTitle}>Yasal & Gizlilik</Text>
              <Text style={styles.headerSub}>Mevzuat ve Kullanıcı Sözleşmeleri</Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={onClose}
            style={styles.closeBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.8}
          >
            <X color="rgba(255,255,255,0.7)" size={20} />
          </TouchableOpacity>
        </View>

        {/* ─── TAB NAVIGATION ─── */}
        <View style={styles.tabsWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabsContainer}
          >
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <TouchableOpacity
                  key={tab.id}
                  onPress={() => setActiveTab(tab.id)}
                  activeOpacity={0.8}
                  style={[
                    styles.tabItem,
                    isActive && [
                      styles.tabItemActive,
                      { backgroundColor: `${accentColor}25`, borderColor: accentColor },
                    ],
                  ]}
                >
                  <Icon
                    size={14}
                    color={isActive ? accentColor : "rgba(255,255,255,0.45)"}
                  />
                  <Text
                    style={[
                      styles.tabItemText,
                      isActive && { color: "#FFFFFF", fontFamily: "Inter_700Bold" },
                    ]}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* ─── DOCUMENT DETAILS HEADER ─── */}
        <View style={styles.docMetaCard}>
          <View style={styles.docMetaTop}>
            <View style={[styles.badge, { backgroundColor: `${accentColor}20`, borderColor: `${accentColor}50` }]}>
              <Text style={[styles.badgeText, { color: accentColor }]}>
                {currentDoc.badge}
              </Text>
            </View>
            <View style={styles.dateBox}>
              <Calendar size={12} color="rgba(255,255,255,0.4)" />
              <Text style={styles.dateText}>Son Güncelleme: {currentDoc.lastUpdated}</Text>
            </View>
          </View>

          <Text style={styles.docTitle}>{currentDoc.title}</Text>
          <Text style={styles.docSummary}>{currentDoc.summary}</Text>
        </View>

        {/* ─── SCROLLABLE LEGAL TEXT ─── */}
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 90 },
          ]}
          showsVerticalScrollIndicator={true}
        >
          {currentDoc.content.map((paragraph, index) => {
            const isHeading = /^[0-9]+\.\s+[A-ZÇĞİÖŞÜ\s()\-]+$/.test(paragraph.trim());

            if (isHeading) {
              return (
                <View key={index} style={styles.headingBox}>
                  <View style={[styles.headingIndicator, { backgroundColor: accentColor }]} />
                  <Text style={[styles.headingText, { color: accentColor }]}>
                    {paragraph}
                  </Text>
                </View>
              );
            }

            return (
              <Text key={index} style={styles.paragraphText}>
                {paragraph}
              </Text>
            );
          })}
        </ScrollView>

        {/* ─── BOTTOM ACTION BAR ─── */}
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
          <LinearGradient
            colors={["transparent", "#080811", "#080811"]}
            style={styles.bottomGradient}
            pointerEvents="none"
          />

          <TouchableOpacity
            onPress={onClose}
            style={[styles.acceptBtn, { backgroundColor: accentColor }]}
            activeOpacity={0.88}
          >
            <Check size={18} color="#FFFFFF" />
            <Text style={styles.acceptBtnText}>Okudum ve Anladım</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0A10",
  },
  glowEffect: {
    position: "absolute",
    top: -80,
    alignSelf: "center",
    width: 320,
    height: 180,
    borderRadius: 160,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
  },
  headerSub: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  tabsWrapper: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  tabsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  tabItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  tabItemActive: {
    borderWidth: 1.2,
  },
  tabItemText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12.5,
    fontFamily: "Inter_600SemiBold",
  },
  docMetaCard: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
    backgroundColor: "rgba(255,255,255,0.015)",
  },
  docMetaTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.2,
  },
  dateBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  dateText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  docTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  docSummary: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 12.5,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 12,
  },
  headingBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 14,
    marginBottom: 2,
  },
  headingIndicator: {
    width: 3.5,
    height: 16,
    borderRadius: 2,
  },
  headingText: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.3,
  },
  paragraphText: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 13.5,
    fontFamily: "Inter_400Regular",
    lineHeight: 21,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  bottomGradient: {
    position: "absolute",
    top: -24,
    left: 0,
    right: 0,
    height: 24,
  },
  acceptBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 50,
    borderRadius: 25,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  acceptBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
});
