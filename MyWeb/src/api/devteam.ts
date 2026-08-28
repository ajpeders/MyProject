export type TaskType = "dev" | "review" | "qa" | "deploy" | "orchestrator";
export type TaskStatus =
  | "pending"
  | "assigned"
  | "in_progress"
  | "blocked"
  | "needs_changes"
  | "completed"
  | "failed"
  | "cancelled";

const DEFAULT_TAIL_LINES = 100;

export interface Task {
  id: string;
  project_id: string;
  description: string;
  status: TaskStatus;
  priority: number;
  type: TaskType;
  parent_id: string; // "" if no parent
  revision: number; // increments on edit
  created_at: string;
  updated_at: string;
  result?: string;
  error?: string;
  // Orchestrator-only fields
  plan?: string;
  decompose_prompt?: string;
  sub_tasks?: string[];
  node_id?: string;
}

export interface ListTasksRequest {
  project_id?: string;
  type?: TaskType;
  status?: TaskStatus;
  node_id?: string;
  assigned_to?: string;
}

export interface Agent {
  id: string;
  type: string;
  status: "running" | "exited" | "dead";
  started_at?: string;
  last_heart?: string;
  restarts?: number;
  llm_model?: string;
  max_memory_mb?: number;
  max_cpu_percent?: number;
  log_path?: string;
}

export interface AgentConfig {
  type: string;
  max_memory_mb?: number;
  max_cpu_percent?: number;
  llm_model?: string;
}

export interface DevTeamUser {
  id: string;
  name: string;
  email: string;
  is_admin: boolean;
  created_at: string;
}

export interface DevTeamProject {
  id: string;
  user_id?: string;
  name: string;
  repo_url: string;
  created_at: string;
}

export interface DashboardStats {
  total: number;
  by_type: Record<string, number>;
  by_status: Record<string, number>;
  pending: number;
  in_progress: number;
  completed: number;
  failed: number;
}

export interface DevTeamWebhook {
  id: string;
  project_id: string;
  url: string;
  events: string[];
  secret: string;
  active: boolean;
  created_at: string;
}

import { ApiError } from "./client";

const DEVTEAM_BASE_URL = (import.meta.env.VITE_DEVTEAM_API_URL ?? "http://localhost:4223").replace(/\/$/, "");
const DEVTEAM_API_KEY = import.meta.env.VITE_DEVTEAM_API_KEY ?? "";
const DEVTEAM_API_KEY_STORAGE = "devteam.api_key";

function devteamUrl(path: string): string {
  return `${DEVTEAM_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

async function devteamFetch<T>(path: string, body: unknown): Promise<T> {
  const headers = new Headers({ "Content-Type": "application/json" });
  const apiKey = getDevTeamApiKey();
  if (apiKey) {
    headers.set("X-Api-Key", apiKey);
  }

  let res: Response;
  try {
    res = await fetch(devteamUrl(path), {
      method: "POST",
      body: JSON.stringify(body),
      headers,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Network request failed";
    throw new ApiError(0, `Could not reach DevTeam server: ${message}`);
  }

  if (!res.ok) {
    const text = await res.text();
    try {
      const parsed = JSON.parse(text) as { detail?: unknown; error?: unknown };
      const detail = parsed.detail ?? parsed.error;
      if (typeof detail === "string") {
        throw new ApiError(res.status, detail);
      }
    } catch (err) {
      if (err instanceof ApiError) throw err;
    }
    throw new ApiError(res.status, text || res.statusText);
  }

  return res.json();
}

export function getDevTeamApiKey(): string {
  return DEVTEAM_API_KEY || localStorage.getItem(DEVTEAM_API_KEY_STORAGE) || "";
}

export function setDevTeamApiKey(apiKey: string): void {
  const trimmed = apiKey.trim();
  if (trimmed) {
    localStorage.setItem(DEVTEAM_API_KEY_STORAGE, trimmed);
  } else {
    localStorage.removeItem(DEVTEAM_API_KEY_STORAGE);
  }
}

export function devteamWsUrl(path: string): string {
  const url = new URL(devteamUrl(path));
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

// Loose record for defensive response parsing — DevTeam backend shapes can vary
type AnyResponse = Record<string, unknown>;

export async function getCurrentUser(): Promise<DevTeamUser> {
  return devteamFetch<DevTeamUser>("/api/user/me", {});
}

export async function listProjects(): Promise<DevTeamProject[]> {
  const data = await devteamFetch<AnyResponse>("/api/project/list", {});
  return Array.isArray(data) ? data : ((data?.projects as DevTeamProject[]) ?? []);
}

export async function createProject(name: string, repoUrl: string): Promise<string> {
  const data = await devteamFetch<AnyResponse>("/api/project/create", { name, repo_url: repoUrl });
  return (data?.project_id as string) ?? "";
}

export async function deleteProject(projectId: string): Promise<void> {
  await devteamFetch<void>("/api/project/delete", { project_id: projectId });
}

export async function createWebhook(
  projectId: string,
  url: string,
  events: string[] = [],
  active = true
): Promise<DevTeamWebhook> {
  return devteamFetch<DevTeamWebhook>("/api/webhook/create", { project_id: projectId, url, events, active });
}

export async function listWebhooks(projectId: string): Promise<DevTeamWebhook[]> {
  const data = await devteamFetch<AnyResponse>("/api/webhook/list", { project_id: projectId });
  return Array.isArray(data) ? data : ((data?.webhooks as DevTeamWebhook[]) ?? []);
}

export async function deleteWebhook(webhookId: string): Promise<void> {
  await devteamFetch<void>("/api/webhook/delete", { webhook_id: webhookId });
}

export async function listTasks(req: ListTasksRequest = {}): Promise<Task[]> {
  const data = await devteamFetch<AnyResponse>("/api/task/list", req);
  return Array.isArray(data) ? data : ((data?.tasks as Task[]) ?? []);
}

export async function getTask(taskId: string): Promise<Task> {
  const data = await devteamFetch<AnyResponse>("/api/task/get", { task_id: taskId });
  return Array.isArray(data) ? data[0] : ((data?.task as Task) ?? data as unknown as Task);
}

export async function createTask(
  description: string,
  params: Record<string, unknown> = {},
  projectId = "",
  type: TaskType = "dev"
): Promise<Task> {
  const data = await devteamFetch<AnyResponse>("/api/task/create", {
    project_id: projectId,
    description,
    type,
    params,
  });
  if (data?.task) return data.task as Task;
  if (data?.task_id) return getTask(data.task_id as string);
  return data as unknown as Task;
}

export async function editTask(
  taskId: string,
  updates: {
    description?: string;
    params?: Record<string, unknown>;
    priority?: number;
  },
  expectedRevision: number
): Promise<Task> {
  const data = await devteamFetch<AnyResponse>("/api/task/edit", {
    task_id: taskId,
    ...updates,
    revision: expectedRevision,
  });
  return (data?.task as Task) ?? (data as unknown as Task);
}

export async function cancelTask(taskId: string): Promise<void> {
  await devteamFetch<void>("/api/task/cancel", { task_id: taskId });
}

export async function listAgents(): Promise<Agent[]> {
  const data = await devteamFetch<AnyResponse>("/api/agents/list", {});
  return Array.isArray(data) ? data : ((data?.agents as Agent[]) ?? []);
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const data = await devteamFetch<AnyResponse>("/api/dashboard/stats", {});
  return {
    total: (data?.total as number) ?? 0,
    by_type: (data?.by_type as Record<string, number>) ?? {},
    by_status: (data?.by_status as Record<string, number>) ?? {},
    pending: (data?.pending as number) ?? 0,
    in_progress: (data?.in_progress as number) ?? 0,
    completed: (data?.completed as number) ?? 0,
    failed: (data?.failed as number) ?? 0,
  };
}

export interface NodeInfo {
  node_id?: string;
  status?: string;
  started_at?: string;
  version?: string;
  [key: string]: unknown;
}

export async function getNodeInfo(): Promise<NodeInfo> {
  const data = await devteamFetch<AnyResponse>("/api/node/info", {});
  return (data?.node as NodeInfo) ?? data ?? {};
}

export async function getAgentLogs(agentId: string): Promise<string[]> {
  const data = await devteamFetch<AnyResponse>("/api/agent/logs", { agent_id: agentId, tail_lines: DEFAULT_TAIL_LINES });
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.logs)) return data.logs as string[];
  if (typeof data?.logs === "string") return data.logs.split("\n");
  if (typeof data?.log === "string") return data.log.split("\n");
  return [];
}

export async function getAgentConfig(agentType: string): Promise<AgentConfig> {
  const data = await devteamFetch<AnyResponse>("/api/agent/config", { type: agentType });
  return {
    type: (data?.type as string) ?? agentType,
    max_memory_mb: data?.max_memory_mb as number | undefined,
    max_cpu_percent: data?.max_cpu_percent as number | undefined,
    llm_model: data?.llm_model as string | undefined,
  };
}

export async function approveDeploy(taskId: string): Promise<string> {
  const data = await devteamFetch<AnyResponse>("/api/deploy/approve", { task_id: taskId });
  return (data?.deploy_task_id as string) ?? "";
}
