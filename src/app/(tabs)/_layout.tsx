import { Tabs } from "expo-router";
import { StyleSheet, View, Text, Platform, TouchableOpacity } from "react-native";
import { BlurView } from "expo-blur";
import { 
  Home, CalendarHeart, Pill, Mail, Settings, MapIcon
} from "lucide-react-native";
import React from "react";
import { useAuth } from "@/context/AuthContext";
import { getTheme } from "@/lib/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const TAB_CONFIG: Record<string, { label: string; Icon: any }> = {
  home: { label: "Ana Sayfa", Icon: Home },
  medicine: { label: "İlaçlar", Icon: Pill },
  calendar: { label: "Takvim", Icon: CalendarHeart },
  map: { label: "Harita", Icon: MapIcon },
  letters: { label: "Mektuplar", Icon: Mail },
  profile: { label: "Ayarlar", Icon: Settings },
};

function CustomTabBar({ state, descriptors, navigation }: any) {
  const { profile } = useAuth();
  const theme = getTheme(profile?.gender);
  const insets = useSafeAreaInsets();

  // Yalnızca href !== null olan ana sekmeleri filtrele
  const visibleRoutes = state.routes.filter((route: any) => {
    const { options } = descriptors[route.key];
    return options.href !== null && TAB_CONFIG[route.name];
  });

  // Alt boşluk: iPhone Home Bar ile dengeli ve estetik duracak şekilde
  const bottomOffset = Platform.OS === "ios" 
    ? Math.max(insets.bottom - 4, 12) 
    : 14;

  return (
    <View 
      style={[
        styles.tabBarContainer,
        { 
          bottom: bottomOffset,
          backgroundColor: Platform.OS === "ios" ? "rgba(18, 12, 24, 0.72)" : theme.cardBg,
        }
      ]}
    >
      <BlurView
        tint="dark"
        intensity={Platform.OS === "ios" ? 80 : 100}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.tabBarInner}>
        {visibleRoutes.map((route: any) => {
          const isFocused = state.routes[state.index].name === route.name;
          const config = TAB_CONFIG[route.name];
          if (!config) return null;

          const { label, Icon } = config;

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
            >
              <View 
                style={[
                  styles.tabCapsule,
                  isFocused && [
                    styles.tabCapsuleActive,
                    { 
                      backgroundColor: theme.pillAccentBg || "rgba(255, 77, 109, 0.16)",
                      borderColor: theme.pillAccentBorder || "rgba(255, 77, 109, 0.35)",
                    }
                  ]
                ]}
              >
                <Icon
                  size={18}
                  color={isFocused ? theme.accent : "rgba(255, 255, 255, 0.42)"}
                  strokeWidth={isFocused ? 2.4 : 1.8}
                />

                <Text
                  style={[
                    styles.tabText,
                    isFocused ? { 
                      color: "#FFFFFF", 
                      fontFamily: "Inter_700Bold", 
                    } : {
                      color: "rgba(255, 255, 255, 0.42)",
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

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen name="home" />
      <Tabs.Screen name="medicine" />
      <Tabs.Screen name="calendar" />
      <Tabs.Screen name="map" />
      <Tabs.Screen name="letters" />
      <Tabs.Screen name="profile" />

      {/* Gizli Alt Rotalar */}
      <Tabs.Screen name="meetings" options={{ href: null }} />
      <Tabs.Screen name="memories" options={{ href: null }} />
      <Tabs.Screen name="add-memory" options={{ href: null }} />
      <Tabs.Screen name="daily-notes" options={{ href: null }} />
      <Tabs.Screen name="period-tracker" options={{ href: null }} />
      <Tabs.Screen name="photos" options={{ href: null }} />
      <Tabs.Screen name="add-photo" options={{ href: null }} />
      <Tabs.Screen name="add-daily-note" options={{ href: null }} />
    </Tabs>
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

