import React, { useEffect } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { reportError } from "@/lib/errorReporting";

interface AppErrorScreenProps {
  error: Error;
  retry: () => void | Promise<void>;
}

/**
 * Bir ekran hata verdiğinde beyaz ekran yerine gösterilir. Tema/oturum sağlayıcılarına bağımlı değildir:
 * hatanın kendisi o sağlayıcılardan gelmiş olabilir.
 */
export function AppErrorScreen({ error, retry }: AppErrorScreenProps) {
  useEffect(() => {
    reportError(error, "error-boundary");
  }, [error]);

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>💔</Text>
      <Text style={styles.title}>Bir şeyler ters gitti</Text>
      <Text style={styles.body}>
        Beklenmedik bir hata oluştu. Verilerin güvende. Tekrar denemeyi ya da uygulamayı kapatıp açmayı dene.
      </Text>
      <TouchableOpacity style={styles.button} onPress={() => retry()} accessibilityRole="button" accessibilityLabel="Tekrar dene">
        <Text style={styles.buttonText}>Tekrar Dene</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    backgroundColor: "#0A0A0C",
  },
  emoji: { fontSize: 48, marginBottom: 16 },
  title: { color: "#FFFFFF", fontSize: 20, fontFamily: "Inter_700Bold", marginBottom: 8, textAlign: "center" },
  body: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginBottom: 24,
  },
  button: { backgroundColor: "#E8002D", paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14 },
  buttonText: { color: "#FFFFFF", fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
