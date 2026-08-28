/**
 * Mirror of MyWeb/src/tools/budget/BudgetPage.tsx — chat-driven Budget UI.
 * Four panels (Summary / Accounts / Transactions / Categorize) each ask the
 * backend's BudgetAgent via /api/chat and render its markdown response.
 *
 * We don't pull in a markdown library here — the responses are typically a
 * couple of short paragraphs / tables and read fine in monospaced plaintext.
 * If we end up wanting headings/lists styled, add `react-native-markdown-display`.
 */
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { isAuthError } from "@/api/client";
import { logout } from "@/api/auth";
import {
  categorizeBudgetTransactions,
  getBudgetSummary,
  listBudgetAccounts,
  listBudgetTransactions,
} from "@/api/budget";
import { Button, Card, PageHeader, SegmentedControl, TextField } from "@/ui/components";
import { colors, radius, space } from "@/ui/theme";

type Section = "summary" | "accounts" | "transactions" | "categorize";

interface PanelState {
  content: string;
  loading: boolean;
  error: string;
}

const empty: PanelState = { content: "", loading: false, error: "" };

export default function BudgetScreen() {
  const router = useRouter();
  const [section, setSection] = useState<Section>("summary");
  const [summary, setSummary] = useState<PanelState>(empty);
  const [accounts, setAccounts] = useState<PanelState>(empty);
  const [transactions, setTransactions] = useState<PanelState>(empty);
  const [categoryResult, setCategoryResult] = useState<PanelState>(empty);
  const [accountId, setAccountId] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [limit, setLimit] = useState("25");
  const [categoryIds, setCategoryIds] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [previewReady, setPreviewReady] = useState(false);

  async function redirectIfAuthExpired(err: unknown): Promise<boolean> {
    if (!isAuthError(err)) return false;
    await logout();
    router.replace("/login");
    return true;
  }

  async function loadSummary(nextId = accountId) {
    setSummary({ content: "", loading: true, error: "" });
    try {
      const r = await getBudgetSummary(nextId);
      setSummary({ content: r.content, loading: false, error: "" });
    } catch (err) {
      if (await redirectIfAuthExpired(err)) return;
      setSummary({ content: "", loading: false, error: err instanceof Error ? err.message : "Failed" });
    }
  }

  async function loadAccounts() {
    setAccounts({ content: "", loading: true, error: "" });
    try {
      const r = await listBudgetAccounts();
      setAccounts({ content: r.content, loading: false, error: "" });
    } catch (err) {
      if (await redirectIfAuthExpired(err)) return;
      setAccounts({ content: "", loading: false, error: err instanceof Error ? err.message : "Failed" });
    }
  }

  useEffect(() => {
    void loadSummary("");
    void loadAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadTransactions() {
    setSection("transactions");
    setTransactions({ content: "", loading: true, error: "" });
    try {
      const r = await listBudgetTransactions({
        accountId,
        category,
        search,
        limit: Number(limit) || 25,
      });
      setTransactions({ content: r.content, loading: false, error: "" });
    } catch (err) {
      if (await redirectIfAuthExpired(err)) return;
      setTransactions({ content: "", loading: false, error: err instanceof Error ? err.message : "Failed" });
    }
  }

  async function categorize(confirmed: boolean) {
    if (!categoryIds.trim() || !newCategory.trim()) return;
    setSection("categorize");
    setCategoryResult({ content: "", loading: true, error: "" });
    try {
      const r = await categorizeBudgetTransactions(categoryIds, newCategory, confirmed);
      setCategoryResult({ content: r.content, loading: false, error: "" });
      setPreviewReady(!confirmed);
      if (confirmed) void loadSummary(accountId);
    } catch (err) {
      if (await redirectIfAuthExpired(err)) return;
      setCategoryResult({ content: "", loading: false, error: err instanceof Error ? err.message : "Failed" });
    }
  }

  const canCategorize = !!categoryIds.trim() && !!newCategory.trim();

  return (
    <ScrollView contentContainerStyle={s.scroll}>
      <PageHeader
        eyebrow="Budget"
        title="Money desk"
        subtitle="Summaries, transaction search, and quick recategorization."
      />
      <SegmentedControl
        value={section}
        onChange={setSection}
        options={[
          { value: "summary", label: "Summary" },
          { value: "accounts", label: "Accounts" },
          { value: "transactions", label: "Txns" },
          { value: "categorize", label: "Cat." },
        ]}
      />

      {section === "summary" || section === "accounts" ? (
        <Card style={s.formRow}>
          <TextField
            label="Account"
            value={accountId}
            onChangeText={setAccountId}
            placeholder="Account ID (blank = all)"
            keyboardType="numeric"
          />
          <View style={s.actionRow}>
            <Button title="Summary" onPress={() => void loadSummary(accountId)} style={s.flex} />
            <Button title="Accounts" variant="secondary" onPress={() => { setSection("accounts"); void loadAccounts(); }} style={s.flex} />
          </View>
        </Card>
      ) : null}

      {section === "transactions" ? (
        <Card style={s.formRow}>
          <TextField label="Description" value={search} onChangeText={setSearch} placeholder="Search text" />
          <TextField label="Category" value={category} onChangeText={setCategory} placeholder="Category" />
          <TextField label="Limit" value={limit} onChangeText={setLimit} placeholder="25" keyboardType="numeric" />
          <Button title="Search transactions" onPress={() => void loadTransactions()} />
        </Card>
      ) : null}

      {section === "categorize" ? (
        <Card style={s.formRow}>
          <TextField
            label="Transaction IDs"
            value={categoryIds}
            onChangeText={(t) => { setCategoryIds(t); setPreviewReady(false); }}
            placeholder="Comma-separated IDs"
          />
          <TextField
            label="New category"
            value={newCategory}
            onChangeText={(t) => { setNewCategory(t); setPreviewReady(false); }}
            placeholder="New category"
          />
          <View style={s.actionRow}>
            <Button title="Preview" variant="secondary" onPress={() => void categorize(false)} disabled={!canCategorize} style={s.flex} />
            <Button
              title="Apply"
              onPress={() => void categorize(true)}
              disabled={!canCategorize || !previewReady}
              style={s.flex}
            />
          </View>
        </Card>
      ) : null}

      <Panel title={titleFor(section)} state={stateFor(section)} />
    </ScrollView>
  );

  function titleFor(k: Section): string {
    return k === "summary" ? "Summary" : k === "accounts" ? "Accounts" : k === "transactions" ? "Transactions" : "Categorization";
  }

  function stateFor(k: Section): PanelState {
    return k === "summary" ? summary : k === "accounts" ? accounts : k === "transactions" ? transactions : categoryResult;
  }
}

function Panel({ title, state }: { title: string; state: PanelState }) {
  return (
    <Card style={panelStyles.panel}>
      <Text style={panelStyles.h2}>{title}</Text>
      {state.loading ? <ActivityIndicator color={colors.primary} /> : null}
      {state.error ? <Text style={panelStyles.error}>{state.error}</Text> : null}
      {state.content ? <Text style={panelStyles.body}>{state.content}</Text> : null}
      {!state.loading && !state.error && !state.content ? (
        <View style={panelStyles.emptyWrap}>
          <Text style={panelStyles.emptyTitle}>No data yet</Text>
          <Text style={panelStyles.emptyBody}>Use the controls above to load this panel.</Text>
        </View>
      ) : null}
    </Card>
  );
}

const panelStyles = StyleSheet.create({
  panel: { gap: space.md },
  h2: { color: colors.text, fontSize: 18, fontWeight: "800" },
  body: {
    color: colors.textMuted,
    fontFamily: "monospace",
    fontSize: 13,
    lineHeight: 19,
    backgroundColor: colors.bgSoft,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: space.md,
  },
  error: { color: colors.danger },
  emptyWrap: {
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.md,
    backgroundColor: colors.bgSoft,
    padding: space.lg,
  },
  emptyTitle: { color: colors.text, fontWeight: "800" },
  emptyBody: { color: colors.textMuted, textAlign: "center", lineHeight: 19 },
});

const s = StyleSheet.create({
  scroll: { flexGrow: 1, padding: space.lg, gap: space.lg, backgroundColor: colors.bg },
  formRow: { gap: space.md },
  actionRow: { flexDirection: "row", gap: space.sm },
  flex: { flex: 1 },
});
