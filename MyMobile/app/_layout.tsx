import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { colors } from "@/ui/theme";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTitleStyle: { color: colors.text, fontWeight: "800" },
          headerTintColor: colors.primary,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ title: "Sign in" }} />
        <Stack.Screen name="home" options={{ title: "MyAgent" }} />
        <Stack.Screen name="mail" options={{ title: "Mail" }} />
        <Stack.Screen name="budget" options={{ title: "Budget" }} />
        <Stack.Screen name="settings" options={{ title: "Settings" }} />
      </Stack>
    </SafeAreaProvider>
  );
}
