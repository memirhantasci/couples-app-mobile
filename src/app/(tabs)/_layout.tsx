import { Tabs } from "expo-router";
import { StyleSheet, View, Text, Platform, TouchableOpacity } from "react-native";
import { BlurView } from "expo-blur";
import React, { useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { useTranslation } from "react-i18next";
import { SafeAreaInsetsContext, useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/context/ThemeContext";
import { useTabBar } from "@/context/TabBarContext";
import { getTabBarBottomOffset } from "@/constants/tabBar";

function CustomTabBar({ state, descriptors, navigation }: any) {
  const { theme, isLight } = useTheme();
  const { enabledTabs, allTabs } = useTabBar();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  const tabLookup = useMemo(() => {
    return allTabs.reduce((acc, tab) => {
      acc[tab.key] = tab;
      return acc;
    }, {} as Record<string, (typeof allTabs)[0]>);
  }, [allTabs]);

  // Kullanıcının alt barda aktif ettiği sekmeleri sırayla filtrele
  const visibleTabs = useMemo(() => {
    return enabledTabs
      .map((tabKey) => {
        const route = state.routes.find((r: any) => r.name === tabKey);
        const config = tabLookup[tabKey];
        if (!route || !config) return null;
        return { route, config };
      })
      .filter(Boolean) as { route: any; config: (typeof allTabs)[0] }[];
  }, [enabledTabs, state.routes, tabLookup]);

  // Form / Alt rotalarda tab barı gizle (kaydet butonunun ve klavyenin üstünü kapatmasını önle)
  const currentRouteName = state.routes[state.index]?.name;
  if (
    currentRouteName === "add-memory" ||
    currentRouteName === "add-photo" ||
    currentRouteName === "add-daily-note"
  ) {
    return null;
  }

  // Alt boşluk: iPhone Home Bar ve Android sistem çubuğunun (3 buton / jest çizgisi) üstünde süzülür
  const bottomOffset = getTabBarBottomOffset(insets.bottom);

  return (
    <View 
      style={[
        styles.tabBarContainer,
        { 
          bottom: bottomOffset,
          backgroundColor: theme.tabBarBg,
          borderColor: theme.tabBarBorder,
          shadowColor: isLight ? theme.accent : "#000000",
          shadowOpacity: isLight ? 0.15 : 0.45,
        }
      ]}
    >
      <BlurView
        tint={theme.blurTint}
        intensity={Platform.OS === "ios" ? 80 : 100}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.tabBarInner}>
        {visibleTabs.map(({ route, config }) => {
          const isFocused = state.routes[state.index].name === route.name;
          const { labelKey, Icon } = config;
          const label = t(labelKey);

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              activeOpacity={0.75}
              style={styles.tabItemBtn}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected: isFocused }}
            >
              <View 
                style={[
                  styles.tabCapsule,
                  isFocused && [
                    styles.tabCapsuleActive,
                    { 
                      backgroundColor: theme.pillAccentBg,
                      borderColor: theme.pillAccentBorder,
                    }
                  ]
                ]}
              >
                <Icon
                  size={18}
                  color={isFocused ? theme.accent : (isLight ? theme.textMuted : "rgba(255, 255, 255, 0.42)")}
                  strokeWidth={isFocused ? 2.4 : 1.8}
                />

                <Text
                  style={[
                    styles.tabText,
                    isFocused ? { 
                      color: isLight ? theme.accent : "#FFFFFF", 
                      fontFamily: "Inter_700Bold", 
                    } : {
                      color: isLight ? theme.textMuted : "rgba(255, 255, 255, 0.42)",
                      fontFamily: "Inter_500Medium",
                    }
                  ]}
                  numberOfLines={1}
                >
                  {label}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

import { DemoModeBanner } from "@/components/demo/DemoModeBanner";
import { useReminderSync } from "@/hooks/useReminderSync";

export default function TabsLayout() {
  // İlaç / buluşma / mektup-kilidi yerel hatırlatıcılarını bu cihazda güncel tut
  useReminderSync();

  const { isDemoMode } = useAuth();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  // Demo şeridi durum çubuğu boşluğunu kendisi üstlenir; ekranlar `insets.top` ile ikinci kez
  // boşluk bırakmasın diye şeridin altındaki içerik için üst güvenli alan sıfırlanır.
  const contentInsets = useMemo(
    () => (isDemoMode ? { ...insets, top: 0 } : insets),
    [isDemoMode, insets]
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.bgGradient[0] }}>
      <DemoModeBanner />
      <SafeAreaInsetsContext.Provider value={contentInsets}>
      <View style={{ flex: 1, backgroundColor: theme.bgGradient[0] }}>
      <Tabs
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          // Açılmış ama şu an görünmeyen sekmeler dondurulur: her gezinmede hepsi baştan render
          // edilmez. Aksi halde gezdikçe mount kalan sekme sayısı kadar ek iş birikir ve her yeni
          // sayfa bir öncekinden yavaş açılırdı (ölçüm: 8 sekme açıkken geçiş ~3 kat daha yavaş).
          freezeOnBlur: true,
          sceneStyle: { backgroundColor: theme.bgGradient[0] },
        }}
      >
      {/* Kullanıcının seçebileceği tüm ana sekmeler */}
      <Tabs.Screen name="home" />
      <Tabs.Screen name="medicine" />
      <Tabs.Screen name="calendar" />
      <Tabs.Screen name="map" />
      <Tabs.Screen name="letters" />
      <Tabs.Screen name="profile" />
      <Tabs.Screen name="photos" />
      <Tabs.Screen name="daily-notes" />
      <Tabs.Screen name="meetings" />
      <Tabs.Screen name="memories" />
      <Tabs.Screen name="period-tracker" />

      {/* Modal / Alt Form Rotaları (Alt barda yer almaz) */}
      <Tabs.Screen name="add-memory" options={{ href: null }} />
      <Tabs.Screen name="add-photo" options={{ href: null }} />
      <Tabs.Screen name="add-daily-note" options={{ href: null }} />
    </Tabs>
      </View>
      </SafeAreaInsetsContext.Provider>
    </View>
  );
}

const styles = StyleSheet.create({
  tabBarContainer: {
    position: "absolute",
    left: 16,
    right: 16,
    height: 64,
    borderRadius: 32,
    borderWidth: 1.2,
    borderColor: "rgba(255, 255, 255, 0.12)",
    elevation: 24,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    overflow: "hidden",
  },
  tabBarInner: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
  },
  tabItemBtn: {
    flex: 1,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  tabCapsule: {
    width: "100%",
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 3,
    borderWidth: 1.2,
    borderColor: "transparent",
  },
  tabCapsuleActive: {
    borderWidth: 1.2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 4,
  },
  tabText: {
    fontSize: 9.5,
    textAlign: "center",
    letterSpacing: -0.2,
    marginTop: 2,
  },
});

