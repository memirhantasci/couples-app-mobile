import { Tabs } from "expo-router";
import { StyleSheet, View } from "react-native";
import { Home, CalendarHeart, Pill, Heart, Settings } from "lucide-react-native";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 80,
          paddingBottom: 22,
          paddingTop: 10,
          borderTopWidth: 1,
          borderTopColor: "rgba(255,255,255,0.06)",
          elevation: 0,
          backgroundColor: "#160b0f",
        },
        tabBarActiveTintColor: "#ff4d6d",
        tabBarInactiveTintColor: "rgba(255, 255, 255, 0.35)",
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Ana Sayfa",
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="medicine"
        options={{
          title: "İlaçlar",
          tabBarIcon: ({ color, size }) => <Pill color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: "Takvim",
          tabBarIcon: ({ color, size }) => <CalendarHeart color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="letters"
        options={{
          title: "Mektuplar",
          tabBarIcon: ({ color, size }) => <Heart color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Ayarlar",
          tabBarIcon: ({ color, size }) => <Settings color={color} size={size} />,
        }}
      />
      <Tabs.Screen name="meetings" options={{ href: null }} />
      <Tabs.Screen name="memories" options={{ href: null }} />
      <Tabs.Screen name="add-memory" options={{ href: null }} />
      <Tabs.Screen name="daily-notes" options={{ href: null }} />
      <Tabs.Screen name="period-tracker" options={{ href: null }} />
      <Tabs.Screen name="photos" options={{ href: null }} />
      <Tabs.Screen name="add-photo" options={{ href: null }} />
    </Tabs>
  );
}
