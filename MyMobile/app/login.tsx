import { useEffect, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { demoLogin, getDemoLoginStatus, loginAccount, registerAccount, storeAuthResponse } from "@/api/auth";
import { ApiError } from "@/api/client";
import { Button, Card, SegmentedControl, TextField } from "@/ui/components";
import { colors, radius, space } from "@/ui/theme";

export default function LoginScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [demoEnabled, setDemoEnabled] = useState(false);

  useEffect(() => {
    getDemoLoginStatus().then((s) => setDemoEnabled(s.enabled)).catch(() => {});
  }, []);

  async function loginAsDemo() {
    setBusy(true);
    try {
      const r = await demoLogin();
      await storeAuthResponse(r);
      router.replace("/home");
    } catch (err) {
      Alert.alert("Demo login failed", err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!email || !password) return;
    setBusy(true);
    try {
      const r = mode === "login"
        ? await loginAccount(email, password)
        : await registerAccount(email, password);
      await storeAuthResponse(r);
      router.replace("/home");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed";
      Alert.alert(mode === "login" ? "Login failed" : "Register failed", msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={s.root}
    >
      <View style={s.shell}>
        <View style={s.brandMark}>
          <Text style={s.brandMarkText}>M</Text>
        </View>
        <Text style={s.title}>MyAgent</Text>
        <Text style={s.subtitle}>Your private assistant console, tuned for quick mobile work.</Text>
      </View>
      <Card style={s.card}>
        <SegmentedControl
          value={mode}
          onChange={setMode}
          options={[
            { value: "login", label: "Sign in" },
            { value: "register", label: "Register" },
          ]}
        />
        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextField
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="Enter password"
          secureTextEntry
        />
        <Button
          title={mode === "login" ? "Sign in" : "Create account"}
          onPress={submit}
          busy={busy}
          disabled={!email || !password}
        />
        {demoEnabled ? (
          <>
            <View style={s.divider} />
            <Button title="Try demo account" variant="secondary" onPress={loginAsDemo} busy={busy} />
            <Text style={s.demoHint}>Skip signup and log in as a shared demo user.</Text>
          </>
        ) : null}
      </Card>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, justifyContent: "center", padding: 20, gap: space.xl },
  shell: { alignItems: "center", gap: space.sm },
  brandMark: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: "#236944",
    alignItems: "center",
    justifyContent: "center",
  },
  brandMarkText: { color: colors.primary, fontSize: 24, fontWeight: "900" },
  card: { gap: 14 },
  title: { color: colors.text, fontSize: 32, fontWeight: "900", textAlign: "center" },
  subtitle: { color: colors.textMuted, fontSize: 14, lineHeight: 20, textAlign: "center", maxWidth: 300 },
  divider: { height: 1, backgroundColor: colors.borderSoft, marginTop: 2 },
  demoHint: { color: colors.textSubtle, fontSize: 12, textAlign: "center", lineHeight: 17 },
});
