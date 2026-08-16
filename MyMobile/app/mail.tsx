import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { ApiError, isAuthError } from "@/api/client";
import { fetchMail, getMailPage, MailSummary, readMail, type MailReadResponse } from "@/api/mail";
import { getMailConfig } from "@/api/mailConfig";
import { applyRecommendation, isActionable } from "@/lib/applyRecommendation";
import { logout } from "@/api/auth";
import { Button, EmptyState, PageHeader, Pill } from "@/ui/components";
import { colors, radius, space } from "@/ui/theme";

export default function MailScreen() {
  const router = useRouter();
  const [emails, setEmails] = useState<MailSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiConfigId, setAIConfigId] = useState<string | null>(null);
  const [aiConfigLoaded, setAIConfigLoaded] = useState(false);

  // Detail view — opened by tapping a row. Body is fetched lazily so the
  // list response can stay small (summaries only).
  const [openEmail, setOpenEmail] = useState<MailReadResponse | null>(null);
  const [openLoading, setOpenLoading] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);

  async function openRow(index: number) {
    setOpenLoading(true);
    setOpenError(null);
    setOpenEmail({ index, from: "", subject: "", date: "", body: "", account: "" });
    try {
      const r = await readMail(index);
      setOpenEmail(r);
    } catch (err) {
      if (await redirectIfAuthExpired(err)) return;
      setOpenError(err instanceof Error ? err.message : "Failed to load email");
    } finally {
      setOpenLoading(false);
    }
  }

  const redirectIfAuthExpired = useCallback(async (err: unknown): Promise<boolean> => {
    if (!isAuthError(err)) return false;
    await logout();
    router.replace("/login");
    return true;
  }, [router]);

  // Mirror the web warning. Pull the user's selected ai_config_id on focus
  // so returning from Settings immediately updates the banner. When null we show a
  // banner since recommendations either silently fall back to the server
  // default LLM or all bucket as "review" if that default fails.
  useFocusEffect(useCallback(() => {
    let active = true;
    setAIConfigLoaded(false);
    void getMailConfig()
      .then((r) => {
        if (active) setAIConfigId(r.ai_config_id);
      })
      .catch((err) => {
        void redirectIfAuthExpired(err);
      })
      .finally(() => {
        if (active) setAIConfigLoaded(true);
      });
    return () => { active = false; };
  }, [redirectIfAuthExpired]));

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await getMailPage(1);
      setEmails(r.emails);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        // No saved mailbox — leave empty list, user must press Sync.
        setEmails([]);
      } else if (await redirectIfAuthExpired(err)) {
        return;
      } else {
        setError(err instanceof Error ? err.message : "Failed to load");
      }
    } finally {
      setLoading(false);
    }
  }, [redirectIfAuthExpired]);

  useEffect(() => { void load(); }, [load]);

  async function sync() {
    setSyncing(true);
    setError(null);
    try {
      const r = await fetchMail({ count: 100, incremental: true });
      setEmails(r.emails);
    } catch (err) {
      if (!(await redirectIfAuthExpired(err))) {
        setError(err instanceof Error ? err.message : "Sync failed");
      }
    } finally {
      setSyncing(false);
    }
  }

  async function apply(email: MailSummary) {
    setApplying(true);
    try {
      const folder = await applyRecommendation(email);
      if (folder) setEmails((prev) => prev.filter((e) => e.index !== email.index));
    } catch (err) {
      if (!(await redirectIfAuthExpired(err))) {
        Alert.alert("Failed", err instanceof Error ? err.message : "Apply failed");
      }
    } finally {
      setApplying(false);
    }
  }

  async function applyAll() {
    const targets = emails.filter(isActionable);
    if (targets.length === 0) return;
    const ok = await new Promise<boolean>((resolve) => {
      Alert.alert(
        "Apply all recommendations",
        `Move ${targets.length} email${targets.length === 1 ? "" : "s"}? Delete goes to Trash, never permanent.`,
        [
          { text: "Cancel", onPress: () => resolve(false), style: "cancel" },
          { text: "Apply", onPress: () => resolve(true) },
        ],
      );
    });
    if (!ok) return;
    setApplying(true);
    let failed = 0;
    let authExpired = false;
    for (const email of targets) {
      try {
        await applyRecommendation(email);
        setEmails((prev) => prev.filter((e) => e.index !== email.index));
      } catch (err) {
        if (await redirectIfAuthExpired(err)) {
          authExpired = true;
          break;
        }
        failed++;
      }
    }
    setApplying(false);
    if (authExpired) return;
    if (failed > 0) Alert.alert("Done with errors", `${failed} action(s) failed.`);
  }

  const actionableCount = useMemo(() => emails.filter(isActionable).length, [emails]);

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={s.root}>
      <View style={s.headerPad}>
        <PageHeader
          eyebrow="Inbox"
          title="Mail triage"
          subtitle={`${emails.length} loaded, ${actionableCount} ready to apply.`}
        />
      </View>
      {aiConfigLoaded && !aiConfigId ? (
        <Pressable onPress={() => router.push("/settings")} style={s.banner}>
          <Text style={s.bannerIcon}>!</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.bannerTitle}>No AI config selected</Text>
            <Text style={s.bannerBody}>
              Emails won't be analyzed until you pick one. Tap to open Settings &gt; AI.
            </Text>
          </View>
        </Pressable>
      ) : null}
      <View style={s.toolbar}>
        <Button title="Sync" onPress={sync} busy={syncing} variant="secondary" style={s.toolbarButton} />
        <Button
          title={`Apply all${actionableCount > 0 ? ` (${actionableCount})` : ""}`}
          onPress={applyAll}
          disabled={applying || actionableCount === 0}
          busy={applying}
          style={s.toolbarButton}
        />
        <Button title="Settings" onPress={() => router.push("/settings")} variant="ghost" />
      </View>
      {error && <Text style={s.error}>{error}</Text>}
      <FlatList
        data={emails}
        keyExtractor={(e) => `${e.account ?? ""}-${e.index}`}
        contentContainerStyle={s.listContent}
        refreshControl={<RefreshControl tintColor={colors.primary} refreshing={syncing} onRefresh={sync} />}
        ListEmptyComponent={
          <EmptyState title="No mail loaded" body="Sync your inbox to start reviewing recommendations." />
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => void openRow(item.index)}
            android_ripple={{ color: colors.borderSoft }}
            style={({ pressed }) => [s.row, pressed && s.rowPressed]}
          >
            <View style={s.rowHeader}>
              {item.recommendation && (
                <Pill tone={badgeTone(item.recommendation)}>{item.recommendation}</Pill>
              )}
              {item.account && <Text style={s.acct}>{item.account}</Text>}
              <Text style={s.date}>{item.date || ""}</Text>
            </View>
            <Text style={s.subject} numberOfLines={2}>
              {item.subject || "(no subject)"}
            </Text>
            <Text style={s.from} numberOfLines={1}>
              {item.from || "unknown"}
            </Text>
            {item.summary ? (
              <Text style={s.summary} numberOfLines={3}>
                {item.summary}
              </Text>
            ) : null}
            {item.recommended_todo ? (
              <Text style={s.todo}>Todo: {item.recommended_todo}</Text>
            ) : null}
            <View style={s.actions}>
              {/*
                The Apply button must NOT propagate its press to the row's
                Pressable, otherwise the email detail modal flashes open on
                every action. Pressable swallows the parent gesture by default,
                but we keep this comment as a tripwire for future maintainers.
              */}
              <Pressable
                onPress={() => apply(item)}
                disabled={applying}
                style={({ pressed }) => [s.smallBtn, applying && s.btnDisabled, pressed && s.rowPressed]}
              >
                <Text style={s.smallBtnText}>Apply</Text>
              </Pressable>
            </View>
          </Pressable>
        )}
      />

      <Modal
        visible={openEmail !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOpenEmail(null)}
      >
        <View style={s.modalRoot}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle} numberOfLines={2}>
              {openEmail?.subject || "(no subject)"}
            </Text>
            <Button title="Close" variant="ghost" onPress={() => setOpenEmail(null)} />
          </View>
          {openEmail ? (
            <ScrollView contentContainerStyle={s.modalScroll}>
              <View style={s.modalMeta}>
                <Text style={s.metaLabel}>From</Text>
                <Text style={s.metaValue}>{openEmail.from || "unknown"}</Text>
                <Text style={s.metaLabel}>Date</Text>
                <Text style={s.metaValue}>{openEmail.date || "-"}</Text>
                {openEmail.account ? (
                  <>
                    <Text style={s.metaLabel}>Account</Text>
                    <Text style={s.metaValue}>{openEmail.account}</Text>
                  </>
                ) : null}
              </View>
              {openEmail.summary ? (
                <Text style={s.modalSummary}>{openEmail.summary}</Text>
              ) : null}
              {openLoading ? (
                <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
              ) : openError ? (
                <Text style={s.error}>{openError}</Text>
              ) : (
                <Text style={s.modalBody}>{openEmail.body || "(empty body)"}</Text>
              )}
            </ScrollView>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

function badgeTone(rec: string): "primary" | "accent" | "warning" | "danger" | "neutral" | "violet" {
  const k = rec.trim().toLowerCase();
  if (k === "delete") return "danger";
  if (k === "archive") return "accent";
  if (k === "reply") return "violet";
  if (k === "todo") return "warning";
  if (k === "calendar") return "primary";
  return "neutral";
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.bg },
  headerPad: { paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.sm },
  toolbar: { flexDirection: "row", paddingHorizontal: space.lg, paddingVertical: space.sm, gap: space.sm },
  toolbarButton: { flex: 1 },
  btnDisabled: { opacity: 0.5 },
  smallBtn: {
    minHeight: 34,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: "#236944",
    alignItems: "center",
  },
  smallBtnText: { color: colors.primary, fontWeight: "800" },
  error: { color: colors.danger, paddingHorizontal: space.lg, paddingVertical: 6 },
  banner: {
    flexDirection: "row",
    gap: space.md,
    padding: space.md,
    borderWidth: 1,
    borderColor: "#8C6B18",
    backgroundColor: colors.warningSoft,
    marginHorizontal: space.lg,
    marginTop: space.sm,
    borderRadius: radius.lg,
    alignItems: "center",
  },
  bannerIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    color: "#1D1A12",
    backgroundColor: colors.warning,
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
    lineHeight: 28,
    overflow: "hidden",
  },
  bannerTitle: { color: colors.text, fontWeight: "800" },
  bannerBody: { color: colors.textMuted, fontSize: 13, marginTop: 2, lineHeight: 18 },
  listContent: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },
  row: {
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: 6,
    backgroundColor: colors.surface,
  },
  rowPressed: { opacity: 0.74 },
  modalRoot: { flex: 1, backgroundColor: colors.bg },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: space.lg,
    gap: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSoft,
  },
  modalTitle: { color: colors.text, fontWeight: "800", fontSize: 17, flex: 1 },
  modalScroll: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },
  modalMeta: {
    gap: 3,
    padding: space.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  metaLabel: { color: colors.textSubtle, fontSize: 11, textTransform: "uppercase", marginTop: 4, fontWeight: "800" },
  metaValue: { color: colors.textMuted, fontSize: 13 },
  modalSummary: { color: colors.primary, fontStyle: "italic", marginTop: 2, lineHeight: 20 },
  modalBody: { color: colors.textMuted, fontFamily: "monospace", fontSize: 13, lineHeight: 19, marginTop: 2 },
  rowHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  acct: { color: colors.textSubtle, fontSize: 12, flexShrink: 1 },
  date: { color: colors.textSubtle, marginLeft: "auto", fontSize: 12 },
  subject: { color: colors.text, fontWeight: "800", fontSize: 16, lineHeight: 21 },
  from: { color: colors.textMuted, fontSize: 13 },
  summary: { color: colors.textMuted, fontSize: 13, marginTop: 2, lineHeight: 19 },
  todo: { color: colors.primary, fontSize: 13, marginTop: 2, fontStyle: "italic", lineHeight: 18 },
  actions: { flexDirection: "row", justifyContent: "flex-end", marginTop: 6 },
});
