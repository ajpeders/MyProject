import { useCallback, useEffect, useState } from "react";
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { ApiError, isAuthError } from "@/api/client";
import { logout } from "@/api/auth";
import {
  AIConfig,
  AIProvider,
  CreateAIConfigBody,
  createAIConfig,
  deleteAIConfig,
  listOllamaModels,
  listAIConfigs,
  UpdateAIConfigBody,
  updateAIConfig,
} from "@/api/aiConfigs";
import {
  ImapAccount,
  addImapAccount,
  deleteImapAccount,
  listImapAccounts,
} from "@/api/imap";
import { getMailConfig, setMailAIConfig } from "@/api/mailConfig";
import { PageHeader, SegmentedControl } from "@/ui/components";
import { colors, radius, space } from "@/ui/theme";

type Tab = "ai" | "mail";

export default function SettingsScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("ai");
  const [aiConfigs, setAIConfigs] = useState<AIConfig[]>([]);
  const [imapAccounts, setImapAccounts] = useState<ImapAccount[]>([]);
  const [selectedAIConfigId, setSelectedAIConfigId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoadError(null);
    try {
      const [configs, accounts, mailCfg] = await Promise.all([
        listAIConfigs(),
        listImapAccounts(),
        getMailConfig(),
      ]);
      setAIConfigs(configs);
      setImapAccounts(accounts);
      setSelectedAIConfigId(mailCfg.ai_config_id);
    } catch (err) {
      if (isAuthError(err)) {
        await logout();
        router.replace("/login");
        return;
      }
      setLoadError(err instanceof Error ? err.message : "Failed to load settings");
    }
  }, [router]);

  useEffect(() => { void reload(); }, [reload]);

  return (
    <View style={s.root}>
      <View style={s.headerPad}>
        <PageHeader
          eyebrow="Settings"
          title="Control room"
          subtitle="Connect providers, inboxes, and mail analysis preferences."
        />
        <SegmentedControl
          value={tab}
          onChange={setTab}
          options={[
            { value: "ai", label: "AI" },
            { value: "mail", label: "Mail" },
          ]}
          style={{ marginTop: space.lg }}
        />
      </View>
      {loadError && <Text style={s.error}>{loadError}</Text>}

      <ScrollView contentContainerStyle={s.panel}>
        {tab === "ai" ? (
          <AIConfigsPanel configs={aiConfigs} onChange={reload} />
        ) : (
          <MailPanel
            accounts={imapAccounts}
            aiConfigs={aiConfigs}
            selectedAIConfigId={selectedAIConfigId}
            onChange={reload}
            onSelectedChange={setSelectedAIConfigId}
          />
        )}
      </ScrollView>
    </View>
  );
}

// ─── AI tab ────────────────────────────────────────────────────────────────

function AIConfigsPanel({ configs, onChange }: { configs: AIConfig[]; onChange: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<AIConfig | null>(null);

  return (
    <View style={{ gap: 12 }}>
      <Text style={s.sectionHelp}>
        Each config is a named AI backend Mail can analyze with. The api_key is encrypted at rest
        and never returned by the server — only "has API key" yes/no.
      </Text>
      {configs.length === 0 ? (
        <Text style={s.empty}>No AI configs yet. Add one below.</Text>
      ) : null}
      {configs.map((c) => (
        <View key={c.id} style={s.card}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={[s.providerBadge, providerStyle(c.provider)]}>{c.provider}</Text>
            <Text style={s.cardTitle}>{c.name}</Text>
          </View>
          <Text style={s.meta}>model: {c.model}</Text>
          {c.host ? <Text style={s.meta}>host: {c.host}</Text> : null}
          {c.has_api_key ? <Text style={s.meta}>api key: ••••••</Text> : null}
          <View style={s.cardActions}>
            <Pressable
              onPress={() => { setEditing(c); setShowForm(true); }}
              style={[s.smallBtn, s.btnNeutral]}
            >
              <Text style={s.btnText}>edit</Text>
            </Pressable>
            <Pressable
              onPress={() => confirmDelete(c.name, () => deleteAIConfig(c.id).then(onChange))}
              style={[s.smallBtn, s.btnDanger]}
            >
              <Text style={s.btnText}>delete</Text>
            </Pressable>
          </View>
        </View>
      ))}
      <Pressable
        onPress={() => { setEditing(null); setShowForm(true); }}
        style={[s.btn, s.btnApply]}
      >
        <Text style={s.btnText}>+ Add AI config</Text>
      </Pressable>

      <AIConfigForm
        visible={showForm}
        editing={editing}
        onClose={() => setShowForm(false)}
        onSaved={() => { setShowForm(false); onChange(); }}
      />
    </View>
  );
}

function AIConfigForm({
  visible,
  editing,
  onClose,
  onSaved,
}: {
  visible: boolean;
  editing: AIConfig | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [provider, setProvider] = useState<AIProvider>("ollama");
  const [host, setHost] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [saving, setSaving] = useState(false);
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState("");
  const [modelsOpen, setModelsOpen] = useState(false);

  useEffect(() => {
    if (editing) {
      setName(editing.name);
      setProvider(editing.provider);
      setHost(editing.host);
      setApiKey("");
      setModel(editing.model);
    } else {
      setName("");
      setProvider("ollama");
      setHost("");
      setApiKey("");
      setModel("");
    }
  }, [editing, visible]);

  const needsHost = provider === "ollama" || provider === "openai_compatible";
  const needsKey = provider === "openai" || provider === "anthropic" || provider === "openai_compatible";

  useEffect(() => {
    if (!visible || provider !== "ollama") {
      setOllamaModels([]);
      setModelsError("");
      setModelsOpen(false);
      return;
    }
    void refreshOllamaModels();
    // Fetch on open/provider changes. Host edits use the explicit Refresh button
    // so typing a URL does not issue a request on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, provider]);

  async function refreshOllamaModels() {
    setModelsLoading(true);
    setModelsError("");
    try {
      const r = await listOllamaModels(host);
      setOllamaModels(r.models);
      if (!model && r.models.length > 0) setModel(r.models[0]);
    } catch (err) {
      setModelsError(err instanceof Error ? err.message : "Could not load Ollama models");
    } finally {
      setModelsLoading(false);
    }
  }

  async function save() {
    if (!name || !model) {
      Alert.alert("Missing fields", "Name and model are required.");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const body: UpdateAIConfigBody = { name, model };
        if (needsHost) body.host = host;
        if (apiKey) body.api_key = apiKey;
        await updateAIConfig(editing.id, body);
      } else {
        const body: CreateAIConfigBody = { name, provider, model };
        if (needsHost) body.host = host;
        if (apiKey) body.api_key = apiKey;
        await createAIConfig(body);
      }
      onSaved();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed";
      Alert.alert("Save failed", msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={s.modalRoot}
      >
        <ScrollView contentContainerStyle={{ gap: 12, padding: 16 }}>
          <Text style={s.modalTitle}>{editing ? "Edit AI config" : "Add AI config"}</Text>
          <Text style={s.label}>Name</Text>
          <TextInput style={s.input} value={name} onChangeText={setName} placeholder="My local Ollama" placeholderTextColor="#666" />

          <Text style={s.label}>Provider</Text>
          {!editing ? (
            <View style={s.providerRow}>
              {(["ollama", "openai", "anthropic", "openai_compatible"] as AIProvider[]).map((p) => (
                <Pressable
                  key={p}
                  onPress={() => setProvider(p)}
                  style={[s.providerChip, provider === p && s.providerChipActive]}
                >
                  <Text style={s.btnText}>{p}</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <Text style={s.meta}>{provider} (provider can't be changed; delete & recreate)</Text>
          )}

          {needsHost ? (
            <>
              <Text style={s.label}>Host</Text>
              <TextInput
                style={s.input}
                value={host}
                onChangeText={setHost}
                placeholder={provider === "ollama" ? "http://192.168.1.40:11434" : "https://api.example.com"}
                placeholderTextColor="#666"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </>
          ) : null}

          {needsKey ? (
            <>
              <Text style={s.label}>API key {editing ? "(leave blank to keep existing)" : ""}</Text>
              <TextInput
                style={s.input}
                value={apiKey}
                onChangeText={setApiKey}
                placeholder="sk-…"
                placeholderTextColor="#666"
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
              />
            </>
          ) : null}

          <Text style={s.label}>Model</Text>
          {provider === "ollama" ? (
            <>
              <Pressable
                onPress={() => setModelsOpen((open) => !open)}
                style={[s.input, s.selectInput]}
              >
                <Text style={[s.selectText, !model && s.selectPlaceholder]}>
                  {model || (modelsLoading ? "Loading Ollama models..." : "Choose an Ollama model")}
                </Text>
                <Text style={s.selectChevron}>{modelsOpen ? "▲" : "▼"}</Text>
              </Pressable>
              {modelsOpen ? (
                <View style={s.modelMenu}>
                  {modelsLoading ? <Text style={s.meta}>Loading models...</Text> : null}
                  {!modelsLoading && ollamaModels.length === 0 ? (
                    <Text style={s.meta}>No models found. Check the host or enter one manually.</Text>
                  ) : null}
                  {ollamaModels.map((name) => (
                    <Pressable
                      key={name}
                      onPress={() => { setModel(name); setModelsOpen(false); }}
                      style={[s.modelOption, model === name && s.modelOptionActive]}
                    >
                      <Text style={s.btnText}>{name}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
              <View style={s.modelTools}>
                <Pressable onPress={() => void refreshOllamaModels()} style={[s.smallBtn, s.btnNeutral]} disabled={modelsLoading}>
                  <Text style={s.btnText}>{modelsLoading ? "Refreshing..." : "Refresh models"}</Text>
                </Pressable>
                {modelsError ? <Text style={[s.meta, s.modelError]}>{modelsError}</Text> : null}
              </View>
            </>
          ) : null}
          <TextInput
            style={s.input}
            value={model}
            onChangeText={setModel}
            placeholder={
              provider === "ollama" ? "Manual model name"
              : provider === "openai" ? "gpt-4o-mini"
              : provider === "anthropic" ? "claude-haiku-4-5-20251001"
              : "model-name"
            }
            placeholderTextColor="#666"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <View style={s.modalActions}>
            <Pressable onPress={onClose} style={[s.btn, s.btnNeutral]} disabled={saving}>
              <Text style={s.btnText}>Cancel</Text>
            </Pressable>
            <Pressable onPress={save} style={[s.btn, s.btnApply, saving && { opacity: 0.5 }]} disabled={saving}>
              <Text style={s.btnText}>{saving ? "Saving…" : "Save"}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Mail tab ──────────────────────────────────────────────────────────────

function MailPanel({
  accounts,
  aiConfigs,
  selectedAIConfigId,
  onChange,
  onSelectedChange,
}: {
  accounts: ImapAccount[];
  aiConfigs: AIConfig[];
  selectedAIConfigId: string | null;
  onChange: () => void;
  onSelectedChange: (id: string | null) => void;
}) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);

  async function selectConfig(id: string | null) {
    const previous = selectedAIConfigId;
    onSelectedChange(id);
    try {
      await setMailAIConfig(id);
    } catch (err) {
      onSelectedChange(previous);
      if (isAuthError(err)) {
        await logout();
        router.replace("/login");
        return;
      }
      Alert.alert("Failed", err instanceof Error ? err.message : "Could not save");
    }
  }

  return (
    <View style={{ gap: 14 }}>
      <Text style={s.h2}>AI config for Mail</Text>
      {aiConfigs.length === 0 ? (
        <Text style={s.empty}>No AI configs yet. Create one on the AI tab first.</Text>
      ) : (
        <View style={{ gap: 6 }}>
          <Pressable onPress={() => selectConfig(null)} style={[s.chip, selectedAIConfigId === null && s.chipActive]}>
            <Text style={s.btnText}>None (use server default)</Text>
          </Pressable>
          {aiConfigs.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => selectConfig(c.id)}
              style={[s.chip, selectedAIConfigId === c.id && s.chipActive]}
            >
              <Text style={s.btnText}>{c.name}</Text>
              <Text style={s.metaInline}> {c.provider} · {c.model}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <Text style={s.h2}>IMAP accounts</Text>
      {accounts.length === 0 ? (
        <Text style={s.empty}>No IMAP accounts. Add one to start syncing mail.</Text>
      ) : (
        accounts.map((a) => (
          <View key={a.id} style={s.card}>
            <Text style={s.cardTitle}>{a.name}</Text>
            <Text style={s.meta}>{a.server}</Text>
            <Text style={s.meta}>{a.username}</Text>
            <View style={s.cardActions}>
              <Pressable
                onPress={() => confirmDelete(a.name, () => deleteImapAccount(a.id).then(onChange))}
                style={[s.smallBtn, s.btnDanger]}
              >
                <Text style={s.btnText}>delete</Text>
              </Pressable>
            </View>
          </View>
        ))
      )}
      <Pressable onPress={() => setShowAdd(true)} style={[s.btn, s.btnApply]}>
        <Text style={s.btnText}>+ Add IMAP account</Text>
      </Pressable>

      <IMAPForm visible={showAdd} onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); onChange(); }} />
    </View>
  );
}

function IMAPForm({
  visible,
  onClose,
  onSaved,
}: { visible: boolean; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [server, setServer] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) {
      setName(""); setServer(""); setUsername(""); setPassword("");
    }
  }, [visible]);

  async function save() {
    if (!name || !server || !username || !password) {
      Alert.alert("Missing fields", "All fields are required.");
      return;
    }
    setSaving(true);
    try {
      await addImapAccount(name, server, username, password);
      onSaved();
    } catch (err) {
      Alert.alert("Failed", err instanceof Error ? err.message : "Could not add");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.modalRoot}>
        <ScrollView contentContainerStyle={{ gap: 12, padding: 16 }}>
          <Text style={s.modalTitle}>Add IMAP account</Text>
          <Text style={s.label}>Account name</Text>
          <TextInput style={s.input} value={name} onChangeText={setName} placeholder="Gmail personal" placeholderTextColor="#666" />
          <Text style={s.label}>IMAP server</Text>
          <TextInput style={s.input} value={server} onChangeText={setServer} placeholder="imap.gmail.com" autoCapitalize="none" autoCorrect={false} placeholderTextColor="#666" />
          <Text style={s.label}>Username</Text>
          <TextInput style={s.input} value={username} onChangeText={setUsername} placeholder="you@gmail.com" autoCapitalize="none" autoCorrect={false} placeholderTextColor="#666" keyboardType="email-address" />
          <Text style={s.label}>Password (app password)</Text>
          <TextInput style={s.input} value={password} onChangeText={setPassword} secureTextEntry placeholderTextColor="#666" />
          <View style={s.modalActions}>
            <Pressable onPress={onClose} style={[s.btn, s.btnNeutral]} disabled={saving}>
              <Text style={s.btnText}>Cancel</Text>
            </Pressable>
            <Pressable onPress={save} style={[s.btn, s.btnApply, saving && { opacity: 0.5 }]} disabled={saving}>
              <Text style={s.btnText}>{saving ? "Saving…" : "Add"}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function confirmDelete(label: string, doDelete: () => Promise<unknown>) {
  Alert.alert(
    `Delete ${label}?`,
    "This can't be undone.",
    [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive", onPress: () => {
          void doDelete().catch((err) => Alert.alert("Failed", err instanceof Error ? err.message : "Delete failed"));
        },
      },
    ],
  );
}

function providerStyle(provider: AIProvider) {
  switch (provider) {
    case "ollama": return { backgroundColor: colors.accentSoft, borderColor: "#2E4C73" };
    case "openai": return { backgroundColor: colors.violetSoft, borderColor: "#4F3A75" };
    case "anthropic": return { backgroundColor: colors.warningSoft, borderColor: "#8C6B18" };
    case "openai_compatible": return { backgroundColor: colors.primarySoft, borderColor: "#236944" };
  }
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  headerPad: { paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.sm },
  tabs: { flexDirection: "row", gap: 8, padding: 10 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: "center" },
  tabActive: { backgroundColor: colors.primarySoft, borderColor: "#236944" },
  tabText: { color: colors.text, fontWeight: "700" },
  error: { color: colors.danger, paddingHorizontal: space.lg },
  panel: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },
  sectionHelp: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  h2: { color: colors.text, fontSize: 17, fontWeight: "800", marginTop: 6 },
  empty: { color: colors.textSubtle, fontStyle: "italic", lineHeight: 19 },
  card: {
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: 6,
    backgroundColor: colors.surface,
  },
  cardTitle: { color: colors.text, fontWeight: "800", fontSize: 16, flex: 1 },
  meta: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
  metaInline: { color: colors.textSubtle, fontSize: 12, flexShrink: 1 },
  cardActions: { flexDirection: "row", gap: space.sm, marginTop: space.sm },
  providerBadge: {
    color: colors.text,
    paddingHorizontal: 7,
    paddingVertical: 3,
    fontSize: 10,
    borderRadius: radius.sm,
    fontWeight: "800",
    overflow: "hidden",
    textTransform: "uppercase",
    borderWidth: 1,
  },
  providerRow: { flexDirection: "row", gap: space.sm, flexWrap: "wrap" },
  providerChip: {
    minHeight: 40,
    paddingVertical: 9,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgSoft,
  },
  providerChipActive: { backgroundColor: colors.primarySoft, borderColor: "#236944" },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgSoft,
  },
  chipActive: { backgroundColor: colors.primarySoft, borderColor: "#236944" },
  btn: {
    minHeight: 44,
    paddingVertical: 11,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  smallBtn: { minHeight: 36, paddingVertical: 8, paddingHorizontal: space.md, borderRadius: radius.md, borderWidth: 1 },
  btnApply: { backgroundColor: colors.primaryDeep, borderColor: colors.primaryDeep },
  btnNeutral: { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
  btnDanger: { backgroundColor: colors.dangerSoft, borderColor: "#6F2E35" },
  btnText: { color: colors.text, fontWeight: "700" },
  modalRoot: { flex: 1, backgroundColor: colors.bg },
  modalTitle: { color: colors.text, fontSize: 22, fontWeight: "900" },
  label: { color: colors.textMuted, fontSize: 12, fontWeight: "700", marginTop: 4 },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    color: colors.text,
    backgroundColor: colors.bgSoft,
    fontSize: 15,
  },
  selectInput: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    gap: space.sm,
  },
  selectText: { color: colors.text, fontSize: 15, flex: 1 },
  selectPlaceholder: { color: colors.textSubtle },
  selectChevron: { color: colors.textMuted, fontSize: 12, fontWeight: "900" },
  modelMenu: {
    gap: 6,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.md,
    backgroundColor: colors.bgSoft,
    padding: space.sm,
  },
  modelOption: {
    minHeight: 40,
    justifyContent: "center",
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    borderWidth: 1,
    borderColor: "transparent",
  },
  modelOptionActive: { backgroundColor: colors.primarySoft, borderColor: "#236944" },
  modelTools: { gap: 6 },
  modelError: { color: colors.danger },
  modalActions: { flexDirection: "row", gap: space.sm, marginTop: 16, justifyContent: "flex-end" },
});
