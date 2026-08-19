import { Tabs } from "expo-router";
import { StyleSheet, View, Text } from "react-native";
import { Home, CalendarHeart, Pill, Heart, Settings, XCircle } from "lucide-react-native";
import React from "react";
import { useAuth } from "@/context/AuthContext";
import { getTheme } from "@/lib/theme";

const TabItem = React.memo(({ IconComponent, label, focused, theme }: { IconComponent: any, label: string, focused: boolean, theme: any }) => {
  return (
    <View style={[styles.tabItem, focused && { backgroundColor: theme.accent, paddingHorizontal: 10 }]}>
      <IconComponent color={focused ? "#fff" : "rgba(255, 255, 255, 0.4)"} size={20} strokeWidth={focused ? 2.5 : 2} />
      <Text
        style={[styles.tabLabel, focused && styles.tabLabelActive]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {label}
      </Text>
    </View>
  );
});

export default function TabsLayout() {
  const { profile } = useAuth();
  const theme = getTheme(profile?.gender);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false, // We're rendering the label inside the icon to wrap them both
        tabBarStyle: {
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 85,
          paddingBottom: 20,
          paddingTop: 10,
          borderTopWidth: 0,
          elevation: 0,
          backgroundColor: theme.cardBg, // Dynamic based on gender
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          tabBarIcon: ({ focused }) => <TabItem IconComponent={Home} label="Ana Sayfa" focused={focused} theme={theme} />,
        }}
      />
      <Tabs.Screen
        name="medicine"
        options={{
          tabBarIcon: ({ focused }) => <TabItem IconComponent={Pill} label="İlaçlar" focused={focused} theme={theme} />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          tabBarIcon: ({ focused }) => <TabItem IconComponent={CalendarHeart} label="Takvim" focused={focused} theme={theme} />,
        }}
      />
      <Tabs.Screen
        name="letters"
        options={{
          tabBarIcon: ({ focused }) => <TabItem IconComponent={XCircle} label="Mektuplar" focused={focused} theme={theme} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => <TabItem IconComponent={Settings} label="Ayarlar" focused={focused} theme={theme} />,
        }}
      />
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
  tabItem: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 18,
    minWidth: 54,
    maxWidth: 70,
  },
  tabLabel: {
    fontSize: 9,
    fontFamily: "Inter_500Medium",
    color: "rgba(255, 255, 255, 0.4)",
    marginTop: 4,
    textAlign: "center",
  },
  tabLabelActive: {
    color: "#fff",
    fontFamily: "Inter_700Bold",
  },
});
