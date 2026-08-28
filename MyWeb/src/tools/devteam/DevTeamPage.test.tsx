import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DevTeamPage from "./DevTeamPage";
import * as devteam from "../../api/devteam";

const MOCK_TASKS: devteam.Task[] = [
  {
    id: "task-1",
    project_id: "project-1",
    description: "Build the login page",
    status: "pending",
    priority: 3,
    type: "dev",
    parent_id: "",
    revision: 1,
    created_at: "2026-04-19T10:00:00Z",
    updated_at: "2026-04-19T10:00:00Z",
  },
  {
    id: "task-2",
    project_id: "project-2",
    description: "Review PR #42",
    status: "in_progress",
    priority: 2,
    type: "review",
    parent_id: "",
    revision: 1,
    created_at: "2026-04-19T09:00:00Z",
    updated_at: "2026-04-19T11:00:00Z",
  },
];

const MOCK_AGENTS: devteam.Agent[] = [
  {
    id: "dev-0",
    type: "dev",
    status: "running",
    last_heart: "2026-04-19T10:00:00Z",
    max_memory_mb: 4096,
    max_cpu_percent: 75,
  },
  {
    id: "review-0",
    type: "review",
    status: "running",
    last_heart: "2026-04-19T10:00:00Z",
    max_memory_mb: 2048,
    max_cpu_percent: 50,
  },
];

describe("DevTeamPage", () => {
  let storage: Map<string, string>;

  beforeEach(() => {
    vi.clearAllMocks();
    storage = new Map<string, string>([["devteam.api_key", "test-key"]]);
    Object.defineProperty(globalThis, "localStorage", {
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
        clear: () => storage.clear(),
      },
      writable: true,
    });
    vi.spyOn(devteam, "getCurrentUser").mockResolvedValue({
      id: "user-1",
      name: "admin",
      email: "",
      is_admin: true,
      created_at: "2026-04-19T10:00:00Z",
    });
    vi.spyOn(devteam, "listTasks").mockResolvedValue([]);
    vi.spyOn(devteam, "listAgents").mockResolvedValue([]);
    vi.spyOn(devteam, "listProjects").mockResolvedValue([
      {
        id: "project-1",
        user_id: "user-1",
        name: "Demo project",
        repo_url: "file:///tmp/demo",
        created_at: "2026-04-19T10:00:00Z",
      },
      {
        id: "project-2",
        user_id: "user-1",
        name: "API project",
        repo_url: "file:///tmp/api",
        created_at: "2026-04-19T10:00:00Z",
      },
    ]);
    vi.spyOn(devteam, "listWebhooks").mockResolvedValue([]);
    vi.spyOn(devteam, "createWebhook").mockResolvedValue({
      id: "webhook-1",
      project_id: "project-1",
      url: "https://example.com/devteam",
      events: ["task.completed"],
      secret: "secret",
      active: true,
      created_at: "2026-04-19T10:00:00Z",
    });
    vi.spyOn(devteam, "deleteWebhook").mockResolvedValue();
    vi.spyOn(devteam, "getNodeInfo").mockResolvedValue({
      node_id: "local",
      agent_count: 0,
      nats_connected: false,
      api_address: "localhost:4223",
    });
    vi.spyOn(devteam, "getDashboardStats").mockResolvedValue({
      total: 0,
      by_type: {},
      by_status: {},
      pending: 0,
      in_progress: 0,
      completed: 0,
      failed: 0,
    });
    vi.spyOn(devteam, "getAgentConfig").mockResolvedValue({
      type: "dev",
      llm_model: "qwen3:8b",
      max_memory_mb: 4096,
      max_cpu_percent: 75,
    });
  });

  it("renders dashboard header", async () => {
    render(<DevTeamPage />);
    expect(screen.getByRole("heading", { name: "DevTeam Agent Dashboard" })).toBeVisible();
    expect(screen.getByText("Task pipeline: Dev → Review → QA → Deploy")).toBeInTheDocument();
  });

  it("renders toolbar with refresh and new task buttons", async () => {
    render(<DevTeamPage />);
    expect(screen.getByRole("button", { name: "refresh" })).toBeVisible();
    expect(screen.getByRole("button", { name: "+ New Task" })).toBeVisible();
  });

  it("renders task list when data loads", async () => {
    vi.spyOn(devteam, "listTasks").mockResolvedValue(MOCK_TASKS);
    render(<DevTeamPage />);
    await waitFor(() => {
      expect(screen.getByText("Build the login page")).toBeInTheDocument();
    });
    expect(screen.getByRole("heading", { name: "Demo project" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "API project" })).toBeInTheDocument();
    expect(screen.getByText("Review PR #42")).toBeInTheDocument();
  });

  it("filters by type", async () => {
    vi.spyOn(devteam, "listTasks").mockResolvedValue(MOCK_TASKS);
    render(<DevTeamPage />);
    await waitFor(() => expect(screen.getByText("Build the login page")).toBeInTheDocument());

    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Filter by type" }), "dev");
    expect(screen.getByText("Build the login page")).toBeInTheDocument();
    expect(screen.queryByText("Review PR #42")).not.toBeInTheDocument();
  });

  it("filters by status", async () => {
    vi.spyOn(devteam, "listTasks").mockResolvedValue(MOCK_TASKS);
    render(<DevTeamPage />);
    await waitFor(() => expect(screen.getByText("Build the login page")).toBeInTheDocument());

    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Filter by status" }), "in_progress");
    expect(screen.queryByText("Build the login page")).not.toBeInTheDocument();
    expect(screen.getByText("Review PR #42")).toBeInTheDocument();
  });

  it("opens task detail modal on row click", async () => {
    vi.spyOn(devteam, "listTasks").mockResolvedValue(MOCK_TASKS);
    render(<DevTeamPage />);
    await waitFor(() => expect(screen.getByText("Build the login page")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Build the login page"));
    await waitFor(() => {
      expect(screen.getAllByText("task-1").length).toBeGreaterThan(0);
    });
    expect(screen.getByRole("button", { name: "Close" })).toBeVisible();
  });

  it("opens agents panel and shows agents", async () => {
    vi.spyOn(devteam, "listTasks").mockResolvedValue([]);
    vi.spyOn(devteam, "listAgents").mockResolvedValue(MOCK_AGENTS);
    render(<DevTeamPage />);

    fireEvent.click(screen.getByRole("button", { name: /Agents \(0\) ▶/ }));
    await waitFor(() => {
      expect(screen.getByText("dev-0")).toBeInTheDocument();
    });
    expect(screen.getByText("4096 MB")).toBeInTheDocument();
    expect(screen.getByText("75%")).toBeInTheDocument();
  });

  it("opens agent config modal", async () => {
    vi.spyOn(devteam, "listTasks").mockResolvedValue([]);
    vi.spyOn(devteam, "listAgents").mockResolvedValue(MOCK_AGENTS);
    render(<DevTeamPage />);

    fireEvent.click(screen.getByRole("button", { name: /Agents \(0\) ▶/ }));
    await waitFor(() => {
      expect(screen.getByText("dev-0")).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole("button", { name: "Config" })[0]);
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Agent Config" })).toBeInTheDocument();
    });
    expect(devteam.getAgentConfig).toHaveBeenCalledWith("dev");
    expect(screen.getByText("qwen3:8b")).toBeInTheDocument();
  });

  it("opens new task modal", async () => {
    storage.set("devteam.project_id", "project-1");
    render(<DevTeamPage />);

    fireEvent.click(screen.getByRole("button", { name: "+ New Task" }));
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Create New Task" })).toBeInTheDocument();
    });
    expect(screen.getByPlaceholderText("Describe the task to be done...")).toBeInTheDocument();
  });

  it("registers project webhooks for the selected project", async () => {
    storage.set("devteam.project_id", "project-1");
    render(<DevTeamPage />);

    await waitFor(() => expect(screen.getByText("No webhooks registered for this project.")).toBeInTheDocument());
    await userEvent.type(screen.getByPlaceholderText("https://example.com/devteam"), "https://example.com/devteam");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Webhook event" }), "task.completed");
    fireEvent.click(screen.getByRole("button", { name: "Register Webhook" }));

    await waitFor(() => {
      expect(devteam.createWebhook).toHaveBeenCalledWith("project-1", "https://example.com/devteam", ["task.completed"]);
    });
    expect(screen.getByText("secret")).toBeInTheDocument();
  });

  it("verifies the saved API key and shows current user", async () => {
    render(<DevTeamPage />);

    await waitFor(() => expect(screen.getByText("Signed in as admin (admin)")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Create User" })).not.toBeInTheDocument();
  });

  it("shows error when API fails", async () => {
    vi.spyOn(devteam, "listTasks").mockRejectedValue(new Error("Server error"));
    render(<DevTeamPage />);
    await waitFor(() => {
      expect(screen.getByText("Server error")).toBeInTheDocument();
    });
  });

  it("refresh button reloads tasks", async () => {
    const spy = vi.spyOn(devteam, "listTasks").mockResolvedValue([]);
    render(<DevTeamPage />);
    // Initial load
    await waitFor(() => expect(spy).toHaveBeenCalled());
    const firstCount = spy.mock.calls.length;

    fireEvent.click(screen.getByRole("button", { name: "refresh" }));
    await waitFor(() => expect(spy.mock.calls.length).toBeGreaterThanOrEqual(firstCount));
  });
});
