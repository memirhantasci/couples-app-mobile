import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { LayoutGrid, RotateCcw, Lock, Check } from "lucide-react-native";
import type { AppTheme } from "@/lib/theme";
import { useTabBar } from "@/context/TabBarContext";
import { ModernSection } from "./ModernSection";
import { profileSharedStyles } from "./profileSharedStyles";

interface TabBarCustomizerProps {
  theme: AppTheme;
  isLight: boolean;
}

export function TabBarCustomizer({ theme, isLight }: TabBarCustomizerProps) {
  const { enabledTabs, allTabs, toggleTab, isTabEnabled, resetTabs, maxTabs } = useTabBar();

  return (
    <ModernSection
      title="Alt Bar Menüsü Özelleştirme"
      icon={<LayoutGrid size={18} color={theme.accent} />}
      theme={theme}
      defaultOpen={true}
    >
      <View style={{ gap: 12 }}>
        <View style={styles.tabSectionHeaderRow}>
          <Text style={[profileSharedStyles.fieldLabel, { color: theme.textSecondary }]}>
            SEÇİLEN SEKMELER ({enabledTabs.length}/{maxTabs})
          </Text>
          <TouchableOpacity
            onPress={resetTabs}
            style={[styles.resetTabsBtn, { backgroundColor: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.06)" }]}
            activeOpacity={0.7}
          >
            <RotateCcw size={12} color={theme.accent} />
            <Text style={[styles.resetTabsText, { color: theme.accent }]}>Sıfırla</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionSubtitleText, { color: theme.textMuted }]}>
          Alt barda hızlıca erişmek istediğiniz sayfaları seçin. Kullanmadığınız sekmeleri (örn. ilaç takibi yapmıyorsanız İlaçlar&apos;ı) kaldırıp yerine Galeri, Notlar veya Buluşma ekleyebilirsiniz.
        </Text>

        {/* Canlı Önizleme Çubuğu */}
        <View
          style={[
            styles.tabPreviewStrip,
            {
              backgroundColor: theme.unitBg,
              borderColor: isLight ? theme.cardBorder : "rgba(255,255,255,0.08)",
            },
          ]}
        >
          <Text style={[styles.tabPreviewTitle, { color: theme.textSecondary }]}>
            Aktif Alt Bar Önizlemesi
          </Text>

          <View style={styles.tabPreviewCapsulesRow}>
            {enabledTabs.map((key) => {
              const item = allTabs.find((t) => t.key === key);
              if (!item) return null;
              const ItemIcon = item.Icon;
              return (
                <View
                  key={key}
                  style={[
                    styles.tabPreviewCapsule,
                    {
                      backgroundColor: theme.pillAccentBg,
                      borderColor: theme.pillAccentBorder,
                    },
                  ]}
                >
                  <ItemIcon size={12} color={theme.accent} />
                  <Text style={[styles.tabPreviewCapsuleText, { color: theme.text }]} numberOfLines={1}>
                    {item.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Tüm Sayfaların Listesi & Seçim */}
        <View style={styles.tabItemsList}>
          {allTabs.map((item) => {
            const isEnabled = isTabEnabled(item.key);
            const isMandatory = item.isMandatory;
            const ItemIcon = item.Icon;

            return (
              <TouchableOpacity
                key={item.key}
                activeOpacity={isMandatory ? 1 : 0.78}
                onPress={() => toggleTab(item.key)}
                style={[
                  styles.tabOptionCard,
                  {
                    backgroundColor: theme.unitBg,
                    borderColor: isEnabled
                      ? theme.accent
                      : (isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.07)"),
                    borderWidth: isEnabled ? 1.5 : 1,
                  },
                ]}
              >
                <View style={styles.tabOptionLeft}>
                  <View
                    style={[
                      styles.tabOptionIconBox,
                      {
                        backgroundColor: isEnabled ? theme.pillAccentBg : (isLight ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.05)"),
                        borderColor: isEnabled ? theme.pillAccentBorder : "transparent",
                      },
                    ]}
                  >
                    <ItemIcon
                      size={18}
                      color={isEnabled ? theme.accent : theme.textMuted}
                    />
                  </View>

                  <View style={styles.tabOptionInfo}>
                    <View style={styles.tabOptionTitleRow}>
                      <Text style={[styles.tabOptionTitle, { color: theme.text }]}>
                        {item.label}
                      </Text>
                      {isMandatory && (
                        <View style={[styles.mandatoryBadge, { backgroundColor: isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.1)" }]}>
                          <Lock size={9} color={theme.textMuted} />
                          <Text style={[styles.mandatoryBadgeText, { color: theme.textMuted }]}>Zorunlu</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.tabOptionDesc, { color: theme.textMuted }]} numberOfLines={1}>
                      {item.description}
                    </Text>
                  </View>
                </View>

                {/* Sağ Taraf: Aktiflik Durumu */}
                <View style={styles.tabOptionRight}>
                  {isMandatory ? (
                    <View style={[styles.activeTabCheck, { backgroundColor: theme.accent }]}>
                      <Check size={12} color="#ffffff" strokeWidth={3} />
                    </View>
                  ) : isEnabled ? (
                    <View style={[styles.activeTabCheck, { backgroundColor: theme.accent }]}>
                      <Check size={12} color="#ffffff" strokeWidth={3} />
                    </View>
                  ) : (
                    <View style={[styles.inactiveTabCheck, { borderColor: isLight ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.2)" }]} />
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </ModernSection>
  );
}

const styles = StyleSheet.create({
  tabSectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionSubtitleText: {
    fontSize: 12.5,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  resetTabsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 8,
  },
  resetTabsText: {
    fontSize: 11.5,
    fontFamily: "Inter_600SemiBold",
  },
  tabPreviewStrip: {
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    gap: 10,
    marginTop: 2,
  },
  tabPreviewTitle: {
    fontSize: 11.5,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.3,
  },
  tabPreviewCapsulesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    alignItems: "center",
  },
  tabPreviewCapsule: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  tabPreviewCapsuleText: {
    fontSize: 11.5,
    fontFamily: "Inter_600SemiBold",
  },
  tabItemsList: {
    gap: 8,
    marginTop: 4,
  },
  tabOptionCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 16,
    gap: 12,
  },
  tabOptionLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  tabOptionIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  tabOptionInfo: {
    flex: 1,
    gap: 2,
  },
  tabOptionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  tabOptionTitle: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  mandatoryBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  mandatoryBadgeText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
  },
  tabOptionDesc: {
    fontSize: 11.5,
    fontFamily: "Inter_400Regular",
  },
  tabOptionRight: {
    paddingLeft: 4,
  },
  activeTabCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  inactiveTabCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
  },
});
