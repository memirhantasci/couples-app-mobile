import React, { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";

export default function Index() {
  const { session, isLoading, profile } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    if (!session) {
      // Giriş yapılmamışsa giriş ekranına yönlendir
      router.replace("/(auth)/login");
    } else if (!profile?.isPaired) {
      // Eşleşme yapılmamışsa eşleşme ekranına yönlendir
      router.replace("/(setup)/pairing");
    } else if (!profile?.hasDates) {
      // Tarihler kurulmamışsa tarih kurulumuna yönlendir
      router.replace("/(setup)/dates");
    } else {
      // Her şey tamam ise ana sayfaya yönlendir
      router.replace("/(tabs)/home");
    }
  }, [session, isLoading, profile, router]);

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#080811" }}>
      <ActivityIndicator size="large" color="#E8002D" />
    </View>
  );
}
