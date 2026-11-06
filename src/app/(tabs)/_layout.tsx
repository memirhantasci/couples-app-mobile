import { Tabs, useRouter, usePathname, type Href } from "expo-router";
import {
  StyleSheet,
  View,
  Text,
  Platform,
  TouchableOpacity,
  type LayoutChangeEvent,
  type StyleProp,
  type TextStyle,
} from "react-native";
import { BlurView } from "expo-blur";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { hapticSelection } from "@/lib/soundEffects";
import { useAuth } from "@/context/AuthContext";
import { useTranslation } from "react-i18next";
import { SafeAreaInsetsContext, useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/context/ThemeContext";
import { useTabBar } from "@/context/TabBarContext";
import { getTabBarBottomOffset } from "@/constants/tabBar";

import { EdgeSwipeBack } from "@/components/ui/EdgeSwipeBack";
import { DemoModeBanner } from "@/components/demo/DemoModeBanner";
import { useReminderSync } from "@/hooks/useReminderSync";
import { usePushLanguageSync } from "@/hooks/usePushLanguageSync";

/**
 * Odaktaki sekmenin ikonu yaylanarak büyür, odak gidince eski boyuna döner. Basıldığı an jöle gibi
 * ezilir (enine genişleyip boyca kısalır) ve yaylanarak toparlanır.
 */
function TabIcon({
  focused,
  squash,
  children,
}: {
  focused: boolean;
  squash: SharedValue<number>;
  children: React.ReactNode;
}) {
  const scale = useSharedValue(focused ? 1.12 : 1);
  useEffect(() => {
    scale.set(withSpring(focused ? 1.12 : 1, { damping: 9, stiffness: 220 }));
  }, [focused, scale]);
  const style = useAnimatedStyle(() => {
    const s = squash.get();
    return {
      transform: [{ scaleX: scale.get() * (1 + 0.15 * s) }, { scaleY: scale.get() * (1 - 0.12 * s) }],
    };
  });
  return <Animated.View style={style}>{children}</Animated.View>;
}

const PILL_H = 48;
const BAR_PADDING = 8;
const ITEM_PADDING = 2;

/**
 * Aktif sekmenin arkasındaki "jöle hap": yeni sekmeye geçerken ön kenarı sert, arka kenarı yumuşak bir
 * yayla gider; böylece hap sakız gibi uzar, hedefe varınca toparlanır ve uzadıkça hafifçe incelir.
 */
function JellyPill({
  index,
  count,
  width,
  color,
}: {
  index: number;
  count: number;
  width: number;
  color: string;
}) {
  const reduceMotion = useReducedMotion();
  const itemW = (width - BAR_PADDING * 2) / count;
  const targetLeft = BAR_PADDING + index * itemW + ITEM_PADDING;
  const targetRight = targetLeft + itemW - ITEM_PADDING * 2;
  const left = useSharedValue(targetLeft);
  const right = useSharedValue(targetRight);

  useEffect(() => {
    if (reduceMotion) {
      left.set(targetLeft);
      right.set(targetRight);
      return;
    }
    const lead = { damping: 18, stiffness: 320, mass: 0.8 };
    const trail = { damping: 16, stiffness: 140, mass: 1 };
    const movingRight = targetLeft > left.get();
    left.set(withSpring(targetLeft, movingRight ? trail : lead));
    right.set(withSpring(targetRight, movingRight ? lead : trail));
  }, [targetLeft, targetRight, reduceMotion, left, right]);

  const style = useAnimatedStyle(() => {
    const l = left.get();
    const w = Math.max(0, right.get() - l);
    const stretch = Math.min(1, Math.max(0, w / Math.max(1, itemW - ITEM_PADDING * 2) - 1));
    return {
      left: l,
      width: w,
      transform: [{ scaleY: 1 - 0.14 * stretch }],
    };
  });

  return <Animated.View pointerEvents="none" style={[styles.jellyPill, { backgroundColor: color }, style]} />;
}

interface TabButtonProps {
  label: string;
  isFocused: boolean;
  icon: React.ReactNode;
  labelStyle: StyleProp<TextStyle>;
  onPress: () => void;
}

function TabButton({ label, isFocused, icon, labelStyle, onPress }: TabButtonProps) {
  const reduceMotion = useReducedMotion();
  const squash = useSharedValue(0);

  const handlePress = () => {
    hapticSelection();
    if (!reduceMotion) {
      squash.set(withSequence(withTiming(1, { duration: 80 }), withSpring(0, { damping: 6, stiffness: 260 })));
    }
    onPress();
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.75}
      style={styles.tabItemBtn}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: isFocused }}
    >
      <View style={styles.tabCapsule}>
        <TabIcon focused={isFocused} squash={squash}>
          {icon}
        </TabIcon>

        <Text
          style={[styles.tabText, labelStyle]}
          numberOfLines={1}
          // Etiket, sığabildiği her yerde tam yazılır; yalnızca gerçekten sığmayacaksa (dar ekran,
          // 6 sekme) yazı hafifçe küçülür. "…" ile kesilme yalnızca bu da yetmezse olur.
          adjustsFontSizeToFit
          minimumFontScale={0.75}
        >
          {label}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function CustomTabBar({ state, descriptors, navigation }: any) {
  const { theme, isLight } = useTheme();
  const { enabledTabs, allTabs } = useTabBar();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [innerWidth, setInnerWidth] = useState(0);
  const handleInnerLayout = useCallback((event: LayoutChangeEvent) => {
    setInnerWidth(Math.round(event.nativeEvent.layout.width));
  }, []);

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
  // Odaktaki ekran alt barda yoksa (kullanıcı o sekmeyi gizlemiş) hap gösterilmez
  const focusedIndex = visibleTabs.findIndex(({ route }) => route.name === currentRouteName);

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

      <View style={styles.tabBarInner} onLayout={handleInnerLayout}>
        {innerWidth > 0 && focusedIndex >= 0 ? (
          <JellyPill index={focusedIndex} count={visibleTabs.length} width={innerWidth} color={theme.pillAccentBg} />
        ) : null}

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
            <TabButton
              key={route.key}
              label={label}
              isFocused={isFocused}
              onPress={onPress}
              icon={
                <Icon
                  size={18}
                  color={isFocused ? theme.accent : (isLight ? theme.textMuted : "rgba(255, 255, 255, 0.42)")}
                  strokeWidth={isFocused ? 2.4 : 1.8}
                />
              }
              labelStyle={
                isFocused
                  ? { color: isLight ? theme.accent : "#FFFFFF", fontFamily: "Inter_700Bold" }
                  : { color: isLight ? theme.textMuted : "rgba(255, 255, 255, 0.42)", fontFamily: "Inter_500Medium" }
              }
            />
          );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  // İlaç / buluşma / mektup-kilidi yerel hatırlatıcılarını bu cihazda güncel tut
  useReminderSync();
  usePushLanguageSync();

  const { isDemoMode } = useAuth();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();

  // iPhone kenar kaydırma hareketi: ekle/düzenle formları kendi liste ekranına, diğerleri önceki ekrana
  // (yoksa ana sayfaya) döner. Ana sayfada ve harita üzerinde (harita kendi kaydırmasını kullanır) kapalıdır.
  const FORM_BACK_TARGETS: Record<string, Href> = {
    "/add-daily-note": "/(tabs)/daily-notes",
    "/add-photo": "/(tabs)/photos",
    "/add-memory": "/(tabs)/memories",
  };
  const swipeBackEnabled = pathname !== "/home" && pathname !== "/" && pathname !== "/map";
  const handleSwipeBack = useCallback(() => {
    const target = FORM_BACK_TARGETS[pathname];
    if (target) router.navigate(target);
    else if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/home");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, router]);
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
      <EdgeSwipeBack onBack={handleSwipeBack} enabled={swipeBackEnabled}>
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
      </EdgeSwipeBack>
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
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255, 255, 255, 0.12)",
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
    paddingHorizontal: BAR_PADDING,
  },
  tabItemBtn: {
    flex: 1,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: ITEM_PADDING,
  },
  tabCapsule: {
    width: "100%",
    height: PILL_H,
    borderRadius: PILL_H / 2,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 3,
  },
  // Aktif sekmenin arkasında kayan, çerçevesiz ve gölgesiz yumuşak vurgu dolgusu
  jellyPill: {
    position: "absolute",
    top: (64 - PILL_H) / 2,
    height: PILL_H,
    borderRadius: PILL_H / 2,
  },
  tabText: {
    // Kapsülün tam genişliği: metin kutusu ölçülen (iOS'ta bazen dar kalan) genişliğe değil, kapsüle
    // bağlı olur; "Takvim" gibi kısa etiketler boş yer varken "Takv…" diye kesilmez
    width: "100%",
    fontSize: 9.5,
    textAlign: "center",
    letterSpacing: -0.2,
    marginTop: 2,
  },
});

