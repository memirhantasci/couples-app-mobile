import { Tabs } from "expo-router";
import { StyleSheet, View, Text, Platform } from "react-native";
import { 
  Home, CalendarHeart, Pill, Mail, Settings, 
  Sparkles, Heart 
} from "lucide-react-native";
import React from "react";
import { useAuth } from "@/context/AuthContext";
import { getTheme } from "@/lib/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface TabItemProps {
  IconComponent: any;
  label: string;
  focused: boolean;
  theme: any;
}

const TabItem = React.memo(({ IconComponent, label, focused, theme }: TabItemProps) => {
  return (
    <View style={styles.tabItemWrapper}>
      {/* Aktif olduğunda arkada beliren yumuşak renkli ışık kapsülü */}
      <View 
        style={[
          styles.iconPill, 
          focused && { 
            backgroundColor: theme.pillAccentBg,
            borderColor: "rgba(255,255,255,0.12)",
            borderWidth: 1,
          }
        ]}
      >
        <IconComponent 
          color={focused ? theme.accent : "rgba(255, 255, 255, 0.45)"} 
          size={20} 
          strokeWidth={focused ? 2.4 : 1.8} 
        />
      </View>

      <Text
        style={[
          styles.tabLabel, 
          focused && { color: "#ffffff", fontFamily: "Inter_700Bold" }
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>

      {/* Aktif sekmenin altında beliren minik parlak aşk noktası */}
      {focused && (
        <View style={[styles.activeIndicatorDot, { backgroundColor: theme.accent }]} />
      )}
    </View>
  );
});

export default function TabsLayout() {
  const { profile } = useAuth();
  const theme = getTheme(profile?.gender);
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          position: "absolute",
          bottom: Platform.OS === "ios" ? insets.bottom + 6 : 14,
          left: 16,
          right: 16,
          height: 68,
          borderRadius: 24,
          backgroundColor: theme.cardBg,
          borderWidth: 1,
          borderColor: theme.cardBorder,
          elevation: 12,
          shadowColor: "#000000",
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.35,
          shadowRadius: 12,
          paddingHorizontal: 6,
          paddingBottom: 0,
          paddingTop: 0,
          alignItems: "center",
          justifyContent: "space-around",
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabItem IconComponent={Home} label="Ana Sayfa" focused={focused} theme={theme} />
          ),
        }}
      />
      <Tabs.Screen
        name="medicine"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabItem IconComponent={Pill} label="İlaçlar" focused={focused} theme={theme} />
          ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabItem IconComponent={CalendarHeart} label="Takvim" focused={focused} theme={theme} />
          ),
        }}
      />
      <Tabs.Screen
        name="letters"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabItem IconComponent={Mail} label="Mektuplar" focused={focused} theme={theme} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabItem IconComponent={Settings} label="Ayarlar" focused={focused} theme={theme} />
          ),
        }}
      />

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
  tabItemWrapper: {
    alignItems: "center",
    justifyContent: "center",
    width: 60,
    height: "100%",
    position: "relative",
  },
  iconPill: {
    width: 38,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  tabLabel: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    color: "rgba(255, 255, 255, 0.45)",
    textAlign: "center",
    letterSpacing: -0.2,
  },
  activeIndicatorDot: {
    position: "absolute",
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});
