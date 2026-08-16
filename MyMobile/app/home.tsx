/**
 * Mirror of MyWeb/src/tools/HomePage.tsx. Renders the same tools registry
 * (`src/tools/registry.ts`) as tappable cards. Tapping pushes to the matching
 * mobile route.
 */
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { tools } from "@/tools/registry";
import { logout } from "@/api/auth";
import { Button, Card, PageHeader, Pill } from "@/ui/components";
import { colors, radius, space } from "@/ui/theme";

const toolMeta: Record<string, { marker: string; tone: "accent" | "primary" | "violet"; stat: string }> = {
  "/mail": { marker: "M", tone: "accent", stat: "Triage" },
  "/budget": { marker: "B", tone: "primary", stat: "Spending" },
  "/settings": { marker: "S", tone: "violet", stat: "Setup" },
};

export default function HomeScreen() {
  const router = useRouter();

  async function signOut() {
    await logout();
    router.replace("/login");
  }

  return (
    <ScrollView contentContainerStyle={s.scroll}>
      <PageHeader
        eyebrow="MyAgent"
        title="Command center"
        subtitle="A fast mobile cockpit for mail, budget checks, and account setup."
      />
      <Card style={s.hero}>
        <Text style={s.heroKicker}>Today</Text>
        <Text style={s.heroTitle}>Choose a tool and keep moving.</Text>
        <Text style={s.heroBody}>Sync mail, review spending, or tune your AI and inbox settings from one place.</Text>
      </Card>
      <View style={s.grid}>
        {tools.map((tool) => (
          <Pressable
            key={tool.path}
            style={({ pressed }) => [s.toolCard, pressed && s.pressed]}
            onPress={() => router.push(tool.path as never)}
          >
            <View style={s.toolTop}>
              <View style={s.marker}>
                <Text style={s.markerText}>{toolMeta[tool.path]?.marker ?? tool.name[0]}</Text>
              </View>
              <Pill tone={toolMeta[tool.path]?.tone ?? "neutral"}>{toolMeta[tool.path]?.stat ?? "Open"}</Pill>
            </View>
            <Text style={s.cardTitle}>{tool.name}</Text>
            <Text style={s.cardDesc}>{tool.description}</Text>
            <Text style={s.cardAction}>Open</Text>
          </Pressable>
        ))}
      </View>
      <Button title="Sign out" variant="ghost" onPress={() => void signOut()} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { flexGrow: 1, padding: space.lg, gap: space.lg, backgroundColor: colors.bg },
  hero: { gap: 8, backgroundColor: colors.surfaceElevated },
  heroKicker: { color: colors.primary, fontSize: 12, fontWeight: "800", textTransform: "uppercase" },
  heroTitle: { color: colors.text, fontSize: 20, fontWeight: "800" },
  heroBody: { color: colors.textMuted, lineHeight: 20 },
  grid: { gap: space.md },
  toolCard: {
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.lg,
    padding: space.lg,
    backgroundColor: colors.surface,
    gap: space.sm,
  },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  toolTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md },
  marker: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.bgSoft,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  markerText: { color: colors.text, fontSize: 16, fontWeight: "900" },
  cardTitle: { color: colors.text, fontSize: 19, fontWeight: "800" },
  cardDesc: { color: colors.textMuted, lineHeight: 20 },
  cardAction: { color: colors.primary, fontWeight: "800", marginTop: 2 },
});
