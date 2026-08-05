import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: "#0A0A0C", borderTopColor: "rgba(255,255,255,0.08)" },
        tabBarActiveTintColor: "#E8002D",
        tabBarInactiveTintColor: "rgba(255,255,255,0.4)",
      }}
    />
  );
}
