import React from "react";
import { ActivityIndicator, View } from "react-native";

export default function Index() {
  // Routing is now handled globally by useProtectedRoute in _layout.tsx
  // This screen just serves as a passive entry point that renders a loader
  // until the route guard redirects the user.
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#080811" }}>
      <ActivityIndicator size="large" color="#E8002D" />
    </View>
  );
}
