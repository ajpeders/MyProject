import { useEffect, useReducer, useRef, useCallback, useState } from "react";
import {
  listTasks,
  createTask,
  editTask,
  listAgents,
  getCurrentUser,
  listProjects,
  createProject,
  deleteProject,
  createWebhook,
  listWebhooks,
  deleteWebhook,
  setDevTeamApiKey,
  getDevTeamApiKey,
  cancelTask,
  getNodeInfo,
  getAgentLogs,
  getAgentConfig,
  getDashboardStats,
  approveDeploy,
  devteamWsUrl,
  type Task,
  type TaskType,
  type TaskStatus,
  type Agent,
  type AgentConfig,
  type NodeInfo,
  type DevTeamProject,
  type DevTeamUser,
  type DashboardStats,
  type DevTeamWebhook,
} from "../../api/devteam";

import DevTeamHeader from "./components/DevTeamHeader";
import ConnectionPanel from "./components/ConnectionPanel";
import AgentsPanel from "./components/AgentsPanel";
import TaskToolbar from "./components/TaskToolbar";
import StatsBar from "./components/StatsBar";
import TaskList from "./components/TaskList";
import NewTaskModal from "./components/NewTaskModal";
import TaskDetailModal from "./components/TaskDetailModal";
import AgentLogsModal from "./components/AgentLogsModal";
import AgentConfigModal from "./components/AgentConfigModal";

const WS_RECONNECT_DELAY_MS = 5000;

const SELECTED_PROJECT_STORAGE = "devteam.project_id";

interface TaskGroup {
  id: string;
  name: string;
  repoUrl: string;
  tasks: Task[];
}

interface WsTaskUpdate {
  tasks: Task[];
  stats?: Partial<DashboardStats>;
}

// ─── State ───────────────────────────────────────────────────────────────────

interface DevTeamState {
  tasks: Task[];
  agents: Agent[];
  projects: DevTeamProject[];
  currentUser: DevTeamUser | null;
  stats: DashboardStats | null;
  loading: boolean;
  error: string;
  apiKey: string;
  apiKeyDraft: string;
  projectName: string;
  projectRepo: string;
  selectedProjectId: string;
  deletingProject: string;
  webhooks: DevTeamWebhook[];
  webhookUrl: string;
  webhookEvent: string;
  savingWebhook: boolean;
  deletingWebhook: string;
  createdWebhookSecret: string;
  connectionMessage: string;
  filterType: TaskType | "";
  filterStatus: TaskStatus | "";
  selectedTask: Task | null;
  showNewTask: boolean;
  agentsCollapsed: boolean;
  wsConnected: boolean;
  nodeInfo: NodeInfo | null;
  agentLogs: { agentId: string; lines: string[] } | null;
  agentConfig: AgentConfig | null;
  loadingConfig: string;
  loadingLogs: string;
  newTaskDesc: string;
  newTaskType: TaskType;
  creatingTask: boolean;
  createError: string;
}

function initialState(): DevTeamState {
  return {
    tasks: [],
    agents: [],
    projects: [],
    currentUser: null,
    stats: null,
    loading: false,
    error: "",
    apiKey: getDevTeamApiKey(),
    apiKeyDraft: getDevTeamApiKey(),
    projectName: "",
    projectRepo: "",
    selectedProjectId: localStorage.getItem(SELECTED_PROJECT_STORAGE) || "",
    deletingProject: "",
    webhooks: [],
    webhookUrl: "",
    webhookEvent: "task.completed",
    savingWebhook: false,
    deletingWebhook: "",
    createdWebhookSecret: "",
    connectionMessage: "",
    filterType: "",
    filterStatus: "",
    selectedTask: null,
    showNewTask: false,
    agentsCollapsed: true,
    wsConnected: false,
    nodeInfo: null,
    agentLogs: null,
    agentConfig: null,
    loadingConfig: "",
    loadingLogs: "",
    newTaskDesc: "",
    newTaskType: "dev",
    creatingTask: false,
    createError: "",
  };
}

// ─── Actions ─────────────────────────────────────────────────────────────────

type DevTeamAction =
  | { type: "SET_TASKS"; tasks: Task[] }
  | { type: "SET_AGENTS"; agents: Agent[] }
  | { type: "SET_PROJECTS"; projects: DevTeamProject[] }
  | { type: "SET_CURRENT_USER"; user: DevTeamUser | null }
  | { type: "SET_STATS"; stats: DashboardStats | null }
  | { type: "MERGE_STATS"; stats: Partial<DashboardStats>; fallbackTotal: number }
  | { type: "SET_LOADING"; loading: boolean }
  | { type: "SET_ERROR"; error: string }
  | { type: "SET_API_KEY"; apiKey: string }
  | { type: "SET_API_KEY_DRAFT"; draft: string }
  | { type: "SET_PROJECT_NAME"; name: string }
  | { type: "SET_PROJECT_REPO"; repo: string }
  | { type: "SET_SELECTED_PROJECT"; projectId: string }
  | { type: "SET_DELETING_PROJECT"; id: string }
  | { type: "SET_WEBHOOKS"; webhooks: DevTeamWebhook[] }
  | { type: "SET_WEBHOOK_URL"; url: string }
  | { type: "SET_WEBHOOK_EVENT"; event: string }
  | { type: "SET_SAVING_WEBHOOK"; saving: boolean }
  | { type: "SET_DELETING_WEBHOOK"; id: string }
  | { type: "SET_CREATED_WEBHOOK_SECRET"; secret: string }
  | { type: "SET_CONNECTION_MESSAGE"; message: string }
  | { type: "SET_FILTER_TYPE"; filterType: TaskType | "" }
  | { type: "SET_FILTER_STATUS"; filterStatus: TaskStatus | "" }
  | { type: "SET_SELECTED_TASK"; task: Task | null }
  | { type: "SET_SHOW_NEW_TASK"; show: boolean }
  | { type: "TOGGLE_AGENTS_COLLAPSED" }
  | { type: "SET_WS_CONNECTED"; connected: boolean }
  | { type: "SET_NODE_INFO"; info: NodeInfo | null }
  | { type: "SET_AGENT_LOGS"; logs: { agentId: string; lines: string[] } | null }
  | { type: "SET_AGENT_CONFIG"; config: AgentConfig | null }
  | { type: "SET_LOADING_CONFIG"; id: string }
  | { type: "SET_LOADING_LOGS"; id: string }
  | { type: "SET_NEW_TASK_DESC"; desc: string }
  | { type: "SET_NEW_TASK_TYPE"; taskType: TaskType }
  | { type: "SET_CREATING_TASK"; creating: boolean }
  | { type: "SET_CREATE_ERROR"; error: string }
  | { type: "SAVE_API_KEY"; apiKey: string; message: string }
  | { type: "CLEAR_API_KEY" }
  | { type: "PROJECT_CREATED"; projectId: string }
  | { type: "PROJECT_DELETED"; remaining: DevTeamProject[]; nextProjectId: string }
  | { type: "TASK_CREATED" }
  | { type: "WEBHOOK_CREATED"; secret: string }
  | { type: "SET_TASK_EDITING"; taskId: string | null }
  | { type: "TASK_UPDATED"; task: Task };

// ─── Reducer ─────────────────────────────────────────────────────────────────

function devteamReducer(state: DevTeamState, action: DevTeamAction): DevTeamState {
  switch (action.type) {
    case "SET_TASKS":
      return { ...state, tasks: action.tasks };
    case "SET_AGENTS":
      return { ...state, agents: action.agents };
    case "SET_PROJECTS":
      return { ...state, projects: action.projects };
    case "SET_CURRENT_USER":
      return { ...state, currentUser: action.user };
    case "SET_STATS":
      return { ...state, stats: action.stats };
    case "MERGE_STATS":
      return {
        ...state,
        stats: {
          total: action.stats.total ?? state.stats?.total ?? action.fallbackTotal,
          by_type: action.stats.by_type ?? state.stats?.by_type ?? {},
          by_status: action.stats.by_status ?? state.stats?.by_status ?? {},
          pending: action.stats.pending ?? state.stats?.pending ?? 0,
          in_progress: action.stats.in_progress ?? state.stats?.in_progress ?? 0,
          completed: action.stats.completed ?? state.stats?.completed ?? 0,
          failed: action.stats.failed ?? state.stats?.failed ?? 0,
        },
      };
    case "SET_LOADING":
      return { ...state, loading: action.loading };
    case "SET_ERROR":
      return { ...state, error: action.error };
    case "SET_API_KEY":
      return { ...state, apiKey: action.apiKey };
    case "SET_API_KEY_DRAFT":
      return { ...state, apiKeyDraft: action.draft };
    case "SET_PROJECT_NAME":
      return { ...state, projectName: action.name };
    case "SET_PROJECT_REPO":
      return { ...state, projectRepo: action.repo };
    case "SET_SELECTED_PROJECT":
      return { ...state, selectedProjectId: action.projectId, createdWebhookSecret: "" };
    case "SET_DELETING_PROJECT":
      return { ...state, deletingProject: action.id };
    case "SET_WEBHOOKS":
      return { ...state, webhooks: action.webhooks };
    case "SET_WEBHOOK_URL":
      return { ...state, webhookUrl: action.url };
    case "SET_WEBHOOK_EVENT":
      return { ...state, webhookEvent: action.event };
    case "SET_SAVING_WEBHOOK":
      return { ...state, savingWebhook: action.saving };
    case "SET_DELETING_WEBHOOK":
      return { ...state, deletingWebhook: action.id };
    case "SET_CREATED_WEBHOOK_SECRET":
      return { ...state, createdWebhookSecret: action.secret };
    case "SET_CONNECTION_MESSAGE":
      return { ...state, connectionMessage: action.message };
    case "SET_FILTER_TYPE":
      return { ...state, filterType: action.filterType };
    case "SET_FILTER_STATUS":
      return { ...state, filterStatus: action.filterStatus };
    case "SET_SELECTED_TASK":
      return { ...state, selectedTask: action.task };
    case "SET_SHOW_NEW_TASK":
      return { ...state, showNewTask: action.show };
    case "TOGGLE_AGENTS_COLLAPSED":
      return { ...state, agentsCollapsed: !state.agentsCollapsed };
    case "SET_WS_CONNECTED":
      return { ...state, wsConnected: action.connected };
    case "SET_NODE_INFO":
      return { ...state, nodeInfo: action.info };
    case "SET_AGENT_LOGS":
      return { ...state, agentLogs: action.logs };
    case "SET_AGENT_CONFIG":
      return { ...state, agentConfig: action.config };
    case "SET_LOADING_CONFIG":
      return { ...state, loadingConfig: action.id };
    case "SET_LOADING_LOGS":
      return { ...state, loadingLogs: action.id };
    case "SET_NEW_TASK_DESC":
      return { ...state, newTaskDesc: action.desc };
    case "SET_NEW_TASK_TYPE":
      return { ...state, newTaskType: action.taskType };
    case "SET_CREATING_TASK":
      return { ...state, creatingTask: action.creating };
    case "SET_CREATE_ERROR":
      return { ...state, createError: action.error };
    case "SAVE_API_KEY":
      return { ...state, apiKey: action.apiKey, connectionMessage: action.message };
    case "CLEAR_API_KEY":
      return {
        ...state,
        projects: [],
        selectedProjectId: "",
        currentUser: null,
        webhooks: [],
      };
    case "PROJECT_CREATED":
      return {
        ...state,
        projectName: "",
        projectRepo: "",
        selectedProjectId: action.projectId,
        connectionMessage: "Project created",
      };
    case "PROJECT_DELETED":
      return {
        ...state,
        projects: action.remaining,
        selectedProjectId: action.nextProjectId,
        connectionMessage: "Project deleted",
      };
    case "TASK_CREATED":
      return { ...state, newTaskDesc: "", newTaskType: "dev", showNewTask: false };
    case "WEBHOOK_CREATED":
      return {
        ...state,
        webhookUrl: "",
        createdWebhookSecret: action.secret,
        connectionMessage: "Webhook registered",
      };
    case "SET_TASK_EDITING":
      return { ...state };
    case "TASK_UPDATED": {
      const tasks = state.tasks.map((t) => (t.id === action.task.id ? action.task : t));
      const selectedTask = state.selectedTask?.id === action.task.id ? action.task : state.selectedTask;
      return { ...state, tasks, selectedTask };
    }
    default:
      return state;
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function DevTeamPage() {
  const [state, dispatch] = useReducer(devteamReducer, undefined, initialState);
  const wsRef = useRef<WebSocket | null>(null);

  // Local editing state (not in reducer — edit form lives in TaskDetailModal)
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState("");
  const [editPriority, setEditPriority] = useState(0);
  const [editRevision, setEditRevision] = useState(0);
  const [editError, setEditError] = useState("");

  const loadTasks = useCallback(async () => {
    if (!state.apiKey) {
      dispatch({ type: "SET_TASKS", tasks: [] });
      dispatch({ type: "SET_STATS", stats: null });
      dispatch({ type: "SET_ERROR", error: "" });
      return;
    }
    dispatch({ type: "SET_LOADING", loading: true });
    dispatch({ type: "SET_ERROR", error: "" });
    try {
      const data = await listTasks({
        ...(state.selectedProjectId ? { project_id: state.selectedProjectId } : {}),
        ...(state.filterType ? { type: state.filterType } : {}),
        ...(state.filterStatus ? { status: state.filterStatus } : {}),
      });
      dispatch({ type: "SET_TASKS", tasks: data });
      dispatch({ type: "SET_STATS", stats: await getDashboardStats() });
    } catch (err) {
      dispatch({ type: "SET_ERROR", error: err instanceof Error ? err.message : "Failed to load tasks" });
    } finally {
      dispatch({ type: "SET_LOADING", loading: false });
    }
  }, [state.apiKey, state.filterStatus, state.filterType, state.selectedProjectId]);

  const loadAgents = useCallback(async () => {
    if (!state.apiKey) {
      dispatch({ type: "SET_AGENTS", agents: [] });
      return;
    }
    try {
      dispatch({ type: "SET_AGENTS", agents: await listAgents() });
    } catch {
      // agents panel, don't show error
    }
  }, [state.apiKey]);

  const loadCurrentUser = useCallback(async () => {
    if (!state.apiKey) {
      dispatch({ type: "SET_CURRENT_USER", user: null });
      return null;
    }
    try {
      const user = await getCurrentUser();
      dispatch({ type: "SET_CURRENT_USER", user });
      return user;
    } catch (err) {
      dispatch({ type: "SET_CURRENT_USER", user: null });
      dispatch({ type: "SET_CONNECTION_MESSAGE", message: err instanceof Error ? err.message : "Failed to verify API key" });
      return null;
    }
  }, [state.apiKey]);

  const loadNodeInfo = useCallback(async () => {
    if (!state.apiKey) {
      dispatch({ type: "SET_NODE_INFO", info: null });
      return;
    }
    try {
      dispatch({ type: "SET_NODE_INFO", info: await getNodeInfo() });
    } catch {
      dispatch({ type: "SET_NODE_INFO", info: null });
    }
  }, [state.apiKey]);

  const loadProjects = useCallback(async () => {
    if (!state.apiKey) {
      dispatch({ type: "SET_PROJECTS", projects: [] });
      return;
    }
    try {
      dispatch({ type: "SET_PROJECTS", projects: await listProjects() });
    } catch (err) {
      dispatch({ type: "SET_CONNECTION_MESSAGE", message: err instanceof Error ? err.message : "Failed to load projects" });
    }
  }, [state.apiKey]);

  const loadWebhooks = useCallback(async () => {
    if (!state.apiKey || !state.selectedProjectId) {
      dispatch({ type: "SET_WEBHOOKS", webhooks: [] });
      return;
    }
    try {
      dispatch({ type: "SET_WEBHOOKS", webhooks: await listWebhooks(state.selectedProjectId) });
    } catch (err) {
      dispatch({ type: "SET_CONNECTION_MESSAGE", message: err instanceof Error ? err.message : "Failed to load webhooks" });
    }
  }, [state.apiKey, state.selectedProjectId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadTasks();
      void loadAgents();
      void loadNodeInfo();
      void loadProjects();
      void loadCurrentUser();
      void loadWebhooks();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadTasks, loadAgents, loadNodeInfo, loadProjects, loadCurrentUser, loadWebhooks]);

  // WebSocket real-time updates
  useEffect(() => {
    const wsUrl = devteamWsUrl("/ws/tasks");
    let reconnectTimer: ReturnType<typeof setTimeout>;

    function connect() {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => dispatch({ type: "SET_WS_CONNECTED", connected: true });
      ws.onclose = () => {
        dispatch({ type: "SET_WS_CONNECTED", connected: false });
        reconnectTimer = setTimeout(connect, WS_RECONNECT_DELAY_MS);
      };
      ws.onerror = () => ws.close();

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as WsTaskUpdate;
          if (data.tasks) {
            dispatch({ type: "SET_TASKS", tasks: data.tasks });
          }
          if (data.stats) {
            dispatch({ type: "MERGE_STATS", stats: data.stats, fallbackTotal: data.tasks?.length ?? 0 });
          }
        } catch {
          // ignore parse errors
        }
      };
    }

    connect();
    return () => {
      clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, []);

  async function handleCreateTask(e: React.FormEvent) {
    e.preventDefault();
    if (!state.newTaskDesc.trim()) return;
    if (!state.apiKey) {
      dispatch({ type: "SET_CREATE_ERROR", error: "Save or register a DevTeam API key first" });
      return;
    }
    if (!state.selectedProjectId) {
      dispatch({ type: "SET_CREATE_ERROR", error: "Select or create a DevTeam project first" });
      return;
    }
    dispatch({ type: "SET_CREATING_TASK", creating: true });
    dispatch({ type: "SET_CREATE_ERROR", error: "" });
    try {
      await createTask(state.newTaskDesc.trim(), {}, state.selectedProjectId, state.newTaskType);
      dispatch({ type: "TASK_CREATED" });
      await loadTasks();
    } catch (err) {
      dispatch({ type: "SET_CREATE_ERROR", error: err instanceof Error ? err.message : "Failed to create task" });
    } finally {
      dispatch({ type: "SET_CREATING_TASK", creating: false });
    }
  }

  async function handleSaveApiKey(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = state.apiKeyDraft.trim();
    setDevTeamApiKey(trimmed);
    dispatch({ type: "SAVE_API_KEY", apiKey: trimmed, message: trimmed ? "API key saved" : "API key cleared" });
    if (trimmed) {
      try {
        const user = await getCurrentUser();
        dispatch({ type: "SET_CURRENT_USER", user });
        dispatch({ type: "SET_PROJECTS", projects: await listProjects() });
        await loadWebhooks();
      } catch (err) {
        dispatch({ type: "SET_CONNECTION_MESSAGE", message: err instanceof Error ? err.message : "Failed to load projects" });
      }
    } else {
      dispatch({ type: "CLEAR_API_KEY" });
      localStorage.removeItem(SELECTED_PROJECT_STORAGE);
    }
    await loadTasks();
  }

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault();
    if (!state.projectName.trim() || !state.projectRepo.trim()) return;
    try {
      const projectId = await createProject(state.projectName.trim(), state.projectRepo.trim());
      dispatch({ type: "PROJECT_CREATED", projectId });
      localStorage.setItem(SELECTED_PROJECT_STORAGE, projectId);
      await loadProjects();
      await loadTasks();
    } catch (err) {
      dispatch({ type: "SET_CONNECTION_MESSAGE", message: err instanceof Error ? err.message : "Failed to create project" });
    }
  }

  function handleProjectChange(projectId: string) {
    dispatch({ type: "SET_SELECTED_PROJECT", projectId });
    if (projectId) {
      localStorage.setItem(SELECTED_PROJECT_STORAGE, projectId);
    } else {
      localStorage.removeItem(SELECTED_PROJECT_STORAGE);
    }
  }

  async function handleCreateWebhook(e: React.FormEvent) {
    e.preventDefault();
    if (!state.selectedProjectId || !state.webhookUrl.trim()) return;
    dispatch({ type: "SET_SAVING_WEBHOOK", saving: true });
    try {
      const webhook = await createWebhook(state.selectedProjectId, state.webhookUrl.trim(), state.webhookEvent ? [state.webhookEvent] : []);
      dispatch({ type: "WEBHOOK_CREATED", secret: webhook.secret });
      await loadWebhooks();
    } catch (err) {
      dispatch({ type: "SET_CONNECTION_MESSAGE", message: err instanceof Error ? err.message : "Failed to register webhook" });
    } finally {
      dispatch({ type: "SET_SAVING_WEBHOOK", saving: false });
    }
  }

  async function handleDeleteWebhook(webhook: DevTeamWebhook) {
    dispatch({ type: "SET_DELETING_WEBHOOK", id: webhook.id });
    try {
      await deleteWebhook(webhook.id);
      dispatch({ type: "SET_CONNECTION_MESSAGE", message: "Webhook deleted" });
      await loadWebhooks();
    } catch (err) {
      dispatch({ type: "SET_CONNECTION_MESSAGE", message: err instanceof Error ? err.message : "Failed to delete webhook" });
    } finally {
      dispatch({ type: "SET_DELETING_WEBHOOK", id: "" });
    }
  }

  async function handleDeleteProject() {
    if (!state.selectedProjectId) return;
    dispatch({ type: "SET_DELETING_PROJECT", id: state.selectedProjectId });
    try {
      await deleteProject(state.selectedProjectId);
      const remaining = state.projects.filter((p) => p.id !== state.selectedProjectId);
      const nextProjectId = remaining[0]?.id ?? "";
      dispatch({ type: "PROJECT_DELETED", remaining, nextProjectId });
      if (nextProjectId) {
        localStorage.setItem(SELECTED_PROJECT_STORAGE, nextProjectId);
      } else {
        localStorage.removeItem(SELECTED_PROJECT_STORAGE);
      }
      await loadTasks();
    } catch (err) {
      dispatch({ type: "SET_CONNECTION_MESSAGE", message: err instanceof Error ? err.message : "Failed to delete project" });
    } finally {
      dispatch({ type: "SET_DELETING_PROJECT", id: "" });
    }
  }

  async function handleCancelTask(task: Task) {
    try {
      await cancelTask(task.id);
      dispatch({ type: "SET_SELECTED_TASK", task: null });
      await loadTasks();
    } catch (err) {
      dispatch({ type: "SET_ERROR", error: err instanceof Error ? err.message : "Failed to cancel task" });
    }
  }

  async function handleApproveDeploy(task: Task) {
    try {
      const deployTaskId = await approveDeploy(task.id);
      dispatch({ type: "SET_SELECTED_TASK", task: null });
      await loadTasks();
      dispatch({ type: "SET_CONNECTION_MESSAGE", message: deployTaskId ? `Deploy task created: ${deployTaskId}` : "Deploy task created" });
    } catch (err) {
      dispatch({ type: "SET_ERROR", error: err instanceof Error ? err.message : "Failed to approve deployment" });
    }
  }

  function handleStartEdit(task: Task) {
    setEditingTaskId(task.id);
    setEditDescription(task.description);
    setEditPriority(task.priority);
    setEditRevision(task.revision);
    setEditError("");
  }

  function handleEditDescriptionChange(v: string) {
    setEditDescription(v);
  }

  function handleEditPriorityChange(v: number) {
    setEditPriority(v);
  }

  async function handleSaveEdit(task: Task) {
    setEditError("");
    try {
      const updated = await editTask(task.id, { description: editDescription, priority: editPriority }, editRevision);
      dispatch({ type: "TASK_UPDATED", task: updated });
      setEditingTaskId(null);
    } catch (err) {
      if (err instanceof Error && err.message.includes("revision")) {
        setEditError("Task was modified by another client. Please re-edit.");
      } else {
        setEditError(err instanceof Error ? err.message : "Failed to save task");
      }
    }
  }

  function handleCancelEdit() {
    setEditingTaskId(null);
    setEditError("");
  }

  async function handleShowAgentLogs(agent: Agent) {
    dispatch({ type: "SET_LOADING_LOGS", id: agent.id });
    try {
      const lines = await getAgentLogs(agent.id);
      dispatch({ type: "SET_AGENT_LOGS", logs: { agentId: agent.id, lines } });
    } catch (err) {
      dispatch({ type: "SET_ERROR", error: err instanceof Error ? err.message : "Failed to load agent logs" });
    } finally {
      dispatch({ type: "SET_LOADING_LOGS", id: "" });
    }
  }

  async function handleShowAgentConfig(agent: Agent) {
    dispatch({ type: "SET_LOADING_CONFIG", id: agent.type });
    try {
      const config = await getAgentConfig(agent.type);
      dispatch({ type: "SET_AGENT_CONFIG", config });
    } catch (err) {
      dispatch({ type: "SET_ERROR", error: err instanceof Error ? err.message : "Failed to load agent config" });
    } finally {
      dispatch({ type: "SET_LOADING_CONFIG", id: "" });
    }
  }

  const filtered = state.tasks.filter((t) => {
    if (state.filterType && t.type !== state.filterType) return false;
    if (state.filterStatus && t.status !== state.filterStatus) return false;
    return true;
  });

  const projectById = new Map(state.projects.map((project) => [project.id, project]));
  const projectGroups = state.projects
    .filter((project) => !state.selectedProjectId || project.id === state.selectedProjectId)
    .map((project) => ({
      id: project.id,
      name: project.name,
      repoUrl: project.repo_url,
      tasks: filtered.filter((task) => task.project_id === project.id),
    }))
    .filter((group) => group.tasks.length > 0 || Boolean(state.selectedProjectId));
  const ungroupedTasks = filtered.filter((task) => !task.project_id || !projectById.has(task.project_id));
  const groupedTaskSections: TaskGroup[] = [
    ...projectGroups,
    ...(ungroupedTasks.length > 0
      ? [{ id: "unassigned", name: "Unassigned Project", repoUrl: "", tasks: ungroupedTasks }]
      : []),
  ];

  return (
    <section className="devteam-page">
      <DevTeamHeader nodeInfo={state.nodeInfo} wsConnected={state.wsConnected} />

      <ConnectionPanel
        apiKeyDraft={state.apiKeyDraft}
        onApiKeyDraftChange={(v) => dispatch({ type: "SET_API_KEY_DRAFT", draft: v })}
        onSaveApiKey={handleSaveApiKey}
        apiKey={state.apiKey}
        currentUser={state.currentUser}
        projects={state.projects}
        selectedProjectId={state.selectedProjectId}
        onProjectChange={handleProjectChange}
        projectName={state.projectName}
        onProjectNameChange={(v) => dispatch({ type: "SET_PROJECT_NAME", name: v })}
        projectRepo={state.projectRepo}
        onProjectRepoChange={(v) => dispatch({ type: "SET_PROJECT_REPO", repo: v })}
        onCreateProject={handleCreateProject}
        onDeleteProject={handleDeleteProject}
        deletingProject={state.deletingProject}
        webhooks={state.webhooks}
        webhookUrl={state.webhookUrl}
        onWebhookUrlChange={(v) => dispatch({ type: "SET_WEBHOOK_URL", url: v })}
        webhookEvent={state.webhookEvent}
        onWebhookEventChange={(v) => dispatch({ type: "SET_WEBHOOK_EVENT", event: v })}
        onCreateWebhook={handleCreateWebhook}
        onDeleteWebhook={handleDeleteWebhook}
        savingWebhook={state.savingWebhook}
        deletingWebhook={state.deletingWebhook}
        createdWebhookSecret={state.createdWebhookSecret}
        connectionMessage={state.connectionMessage}
      />

      <AgentsPanel
        agents={state.agents}
        agentsCollapsed={state.agentsCollapsed}
        onToggleCollapse={() => dispatch({ type: "TOGGLE_AGENTS_COLLAPSED" })}
        onShowConfig={handleShowAgentConfig}
        onShowLogs={handleShowAgentLogs}
        loadingConfig={state.loadingConfig}
        loadingLogs={state.loadingLogs}
      />

      <TaskToolbar
        filterType={state.filterType}
        onFilterTypeChange={(v) => dispatch({ type: "SET_FILTER_TYPE", filterType: v })}
        filterStatus={state.filterStatus}
        onFilterStatusChange={(v) => dispatch({ type: "SET_FILTER_STATUS", filterStatus: v })}
        onRefresh={() => void loadTasks()}
        onNewTask={() => dispatch({ type: "SET_SHOW_NEW_TASK", show: true })}
        loading={state.loading}
        apiKey={state.apiKey}
        selectedProjectId={state.selectedProjectId}
      />

      <StatsBar stats={state.stats} />

      {state.loading && state.tasks.length === 0 ? <p>Loading...</p> : null}
      {state.error ? <p className="devteam-error">{state.error}</p> : null}

      <TaskList
        groupedTaskSections={groupedTaskSections}
        onSelectTask={(task) => dispatch({ type: "SET_SELECTED_TASK", task })}
        loading={state.loading && state.tasks.length === 0}
      />

      {state.showNewTask && (
        <NewTaskModal
          onClose={() => dispatch({ type: "SET_SHOW_NEW_TASK", show: false })}
          onSubmit={handleCreateTask}
          newTaskDesc={state.newTaskDesc}
          onNewTaskDescChange={(v) => dispatch({ type: "SET_NEW_TASK_DESC", desc: v })}
          newTaskType={state.newTaskType}
          onNewTaskTypeChange={(v) => dispatch({ type: "SET_NEW_TASK_TYPE", taskType: v })}
          createError={state.createError}
          creatingTask={state.creatingTask}
        />
      )}

      {state.selectedTask && (
        <TaskDetailModal
          task={state.selectedTask}
          onClose={() => dispatch({ type: "SET_SELECTED_TASK", task: null })}
          onCancel={handleCancelTask}
          onApproveDeploy={handleApproveDeploy}
          editingTaskId={editingTaskId}
          editDescription={editDescription}
          editPriority={editPriority}
          editRevision={editRevision}
          editError={editError}
          onStartEdit={handleStartEdit}
          onEditDescriptionChange={handleEditDescriptionChange}
          onEditPriorityChange={handleEditPriorityChange}
          onSaveEdit={handleSaveEdit}
          onCancelEdit={handleCancelEdit}
        />
      )}

      {state.agentLogs && (
        <AgentLogsModal
          agentId={state.agentLogs.agentId}
          lines={state.agentLogs.lines}
          onClose={() => dispatch({ type: "SET_AGENT_LOGS", logs: null })}
        />
      )}

      {state.agentConfig && (
        <AgentConfigModal
          config={state.agentConfig}
          onClose={() => dispatch({ type: "SET_AGENT_CONFIG", config: null })}
        />
      )}
    </section>
  );
}
