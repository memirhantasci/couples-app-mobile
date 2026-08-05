import { Tabs } from "expo-router";
import { BlurView } from "expo-blur";
import { StyleSheet, View } from "react-native";
import { Home, CalendarHeart, Pill, Heart, Image as ImageIcon } from "lucide-react-native";

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
          height: 85,
          paddingBottom: 25,
          paddingTop: 10,
          borderTopWidth: 0,
          elevation: 0,
          backgroundColor: "transparent",
        },
        tabBarBackground: () => (
          <BlurView
            tint="dark"
            intensity={90}
            style={StyleSheet.absoluteFill}
          />
        ),
        tabBarActiveTintColor: "#E8002D",
        tabBarInactiveTintColor: "rgba(255, 255, 255, 0.4)",
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
        name="calendar"
        options={{
          title: "Takvim",
          tabBarIcon: ({ color, size }) => <CalendarHeart color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="medicine"
        options={{
          title: "Özel Alan",
          tabBarIcon: ({ color, size }) => <Pill color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="photos"
        options={{
          title: "Medya",
          tabBarIcon: ({ color, size }) => <ImageIcon color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
