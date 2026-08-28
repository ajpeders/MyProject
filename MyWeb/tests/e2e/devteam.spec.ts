import { test, expect, type Page } from "@playwright/test";

const MOCK_PROJECTS = [
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
];

const MOCK_TASKS = [
  {
    id: "task-1",
    project_id: "project-1",
    type: "dev",
    status: "pending",
    assigned_to: null,
    input: { description: "Build the login page", params: { repo_url: "https://github.com/test/repo", branch: "main" } },
    created_at: "2026-04-19T10:00:00Z",
    updated_at: "2026-04-19T10:00:00Z",
  },
  {
    id: "task-2",
    project_id: "project-2",
    type: "review",
    status: "in_progress",
    assigned_to: "agent-1",
    input: { description: "Review PR #42", params: {} },
    created_at: "2026-04-19T09:00:00Z",
    updated_at: "2026-04-19T11:00:00Z",
  },
  {
    id: "task-3",
    project_id: "project-1",
    type: "qa",
    status: "completed",
    assigned_to: "qa-0",
    input: { description: "Run final QA", params: {} },
    created_at: "2026-04-19T12:00:00Z",
    updated_at: "2026-04-19T12:30:00Z",
  },
];

const MOCK_AGENTS = [
  {
    id: "dev-0",
    type: "dev",
    status: "running",
    last_heart: "2026-04-19T10:00:00Z",
    restarts: 0,
    llm_model: "qwen3:8b",
    max_memory_mb: 4096,
    max_cpu_percent: 75,
  },
];

async function mockDevTeamApi(page: Page) {
  let webhooks = [
    {
      id: "webhook-1",
      project_id: "project-1",
      url: "https://hooks.example/current",
      events: ["task.failed"],
      secret: "list-secret-not-for-display",
      active: true,
      created_at: "2026-04-19T10:00:00Z",
    },
  ];

  await page.route("http://localhost:4223/api/user/me", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: "user-1", name: "admin", email: "", is_admin: true, created_at: "2026-04-19T10:00:00Z" }),
    });
  });
  await page.route("http://localhost:4223/api/project/list", (route) => {
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ projects: MOCK_PROJECTS }) });
  });
  await page.route("http://localhost:4223/api/task/list", async (route) => {
    const body = route.request().postDataJSON() as { project_id?: string; type?: string; status?: string };
    let tasks = MOCK_TASKS;
    if (body.project_id) tasks = tasks.filter((task) => task.project_id === body.project_id);
    if (body.type) tasks = tasks.filter((task) => task.type === body.type);
    if (body.status) tasks = tasks.filter((task) => task.status === body.status);
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ tasks }) });
  });
  await page.route("http://localhost:4223/api/dashboard/stats", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ total: 3, pending: 1, in_progress: 1, completed: 1, failed: 0, by_type: {}, by_status: {} }),
    });
  });
  await page.route("http://localhost:4223/api/node/info", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ node_id: "local", uptime_seconds: 60, agent_count: 1, nats_connected: false, api_address: "localhost:4223" }),
    });
  });
  await page.route("http://localhost:4223/api/agents/list", (route) => {
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ agents: MOCK_AGENTS }) });
  });
  await page.route("http://localhost:4223/api/agent/config", async (route) => {
    const body = route.request().postDataJSON() as { type: string };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        type: body.type,
        llm_model: "qwen3:8b",
        max_memory_mb: 4096,
        max_cpu_percent: 75,
      }),
    });
  });
  await page.route("http://localhost:4223/api/agent/logs", (route) => {
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ agent_id: "dev-0", log: "agent started\nclaimed task" }) });
  });
  await page.route("http://localhost:4223/api/webhook/list", async (route) => {
    const body = route.request().postDataJSON() as { project_id?: string };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ webhooks: webhooks.filter((webhook) => webhook.project_id === body.project_id) }),
    });
  });
  await page.route("http://localhost:4223/api/webhook/create", async (route) => {
    const body = route.request().postDataJSON() as { project_id: string; url: string; events: string[] };
    const webhook = {
      id: "webhook-created",
      project_id: body.project_id,
      url: body.url,
      events: body.events,
      secret: "create-only-secret",
      active: true,
      created_at: "2026-04-20T10:00:00Z",
    };
    webhooks = [...webhooks, webhook];
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(webhook) });
  });
  await page.route("http://localhost:4223/api/webhook/delete", async (route) => {
    const body = route.request().postDataJSON() as { webhook_id: string };
    webhooks = webhooks.filter((webhook) => webhook.id !== body.webhook_id);
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  await page.route("http://localhost:4223/api/task/create", (route) => {
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ task_id: "task-created" }) });
  });
  await page.route("http://localhost:4223/api/task/get", (route) => {
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ task: { ...MOCK_TASKS[0], id: "task-created" } }) });
  });
  await page.route("http://localhost:4223/api/task/cancel", (route) => {
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  await page.route("http://localhost:4223/api/deploy/approve", (route) => {
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ deploy_task_id: "deploy-1", message: "deploy task created" }) });
  });
}

test.describe("DevTeam page", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("myagent.session_id", "test-session");
      localStorage.setItem("devteam.api_key", "test-key");
      const sockets: ControlledWs[] = [];
      class ControlledWs extends EventTarget {
        static readonly CONNECTING = 0;
        static readonly OPEN = 1;
        static readonly CLOSING = 2;
        static readonly CLOSED = 3;
        readonly CONNECTING = 0;
        readonly OPEN = 1;
        readonly CLOSING = 2;
        readonly CLOSED = 3;
        binaryType: BinaryType = "blob";
        bufferedAmount = 0;
        extensions = "";
        onclose: ((this: WebSocket, ev: CloseEvent) => unknown) | null = null;
        onerror: ((this: WebSocket, ev: Event) => unknown) | null = null;
        onmessage: ((this: WebSocket, ev: MessageEvent) => unknown) | null = null;
        onopen: ((this: WebSocket, ev: Event) => unknown) | null = null;
        protocol = "";
        readyState = WebSocket.OPEN;
        url: string;
        constructor(url: string) {
          super();
          this.url = url;
          sockets.push(this);
          window.setTimeout(() => this.onopen?.call(this as unknown as WebSocket, new Event("open")), 0);
        }
        close() {}
        send() {}
      }
      (window as Window & { __emitDevteamWs?: (message: unknown) => void }).__emitDevteamWs = (message: unknown) => {
        for (const socket of sockets) {
          socket.onmessage?.call(
            socket as unknown as WebSocket,
            new MessageEvent("message", { data: JSON.stringify(message) })
          );
        }
      };
      window.WebSocket = ControlledWs as unknown as typeof WebSocket;
    });
    await mockDevTeamApi(page);
    await page.goto("/devteam");
  });

  test("connects with an API key and shows project sections", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "DevTeam Agent Dashboard" })).toBeVisible();
    await expect(page.getByText("Signed in as admin (admin)")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Demo project" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "API project" })).toBeVisible();
    await expect(page.getByText("Build the login page")).toBeVisible();
    await expect(page.getByText("Review PR #42")).toBeVisible();
    await expect(page.getByLabel("Demo project pipeline")).toBeVisible();
  });

  test("filters tasks by type across project sections", async ({ page }) => {
    await page.selectOption('select[aria-label="Filter by type"]', "dev");
    await expect(page.getByText("Build the login page")).toBeVisible();
    await expect(page.getByText("Review PR #42")).not.toBeVisible();
  });

  test("updates tasks and stats from WebSocket messages", async ({ page }) => {
    await expect(page.getByText("Build the login page")).toBeVisible();

    await page.evaluate(() => {
      (window as Window & { __emitDevteamWs: (message: unknown) => void }).__emitDevteamWs({
        tasks: [
          {
            id: "task-ws",
            project_id: "project-2",
            type: "deploy",
            status: "pending",
            assigned_to: null,
            input: { description: "Deploy from websocket", params: {} },
            created_at: "2026-04-20T10:00:00Z",
            updated_at: "2026-04-20T10:00:00Z",
          },
        ],
        stats: {
          total: 1,
          pending: 1,
          in_progress: 0,
          completed: 0,
          failed: 0,
          by_type: { deploy: 1 },
          by_status: { pending: 1 },
        },
      });
    });

    await expect(page.getByText("Deploy from websocket")).toBeVisible();
    await expect(page.getByText("Build the login page")).not.toBeVisible();
    await expect(page.getByLabel("Dashboard stats")).toContainText("Total 1");
    await expect(page.getByLabel("Dashboard stats")).toContainText("Pending 1");
  });

  test("requires a selected project for new task creation", async ({ page }) => {
    await expect(page.getByRole("button", { name: "+ New Task" })).toBeDisabled();
    await page.getByLabel("DevTeam project").selectOption("project-1");
    await expect(page.getByRole("button", { name: "+ New Task" })).toBeEnabled();
    await page.getByRole("button", { name: "+ New Task" }).click();
    await expect(page.getByRole("heading", { name: "Create New Task" })).toBeVisible();
  });

  test("registers webhooks and only shows the create-time secret", async ({ page }) => {
    await page.getByLabel("DevTeam project").selectOption("project-1");
    await expect(page.getByText("https://hooks.example/current")).toBeVisible();
    await expect(page.getByText("list-secret-not-for-display")).not.toBeVisible();

    await page.getByPlaceholder("https://example.com/devteam").fill("https://hooks.example/new");
    await page.getByLabel("Webhook event").selectOption("task.completed");
    await page.getByRole("button", { name: "Register Webhook" }).click();

    await expect(page.getByText("create-only-secret")).toBeVisible();
    await expect(page.getByText("https://hooks.example/new")).toBeVisible();
  });

  test("opens agent logs", async ({ page }) => {
    await page.getByRole("button", { name: /Agents \(1\)/ }).click();
    await expect(page.getByText("dev-0")).toBeVisible();
    await expect(page.getByText("4096 MB")).toBeVisible();
    await expect(page.getByText("75%")).toBeVisible();
    await page.getByRole("button", { name: "Logs" }).click();
    await expect(page.getByRole("heading", { name: "Agent Logs" })).toBeVisible();
    await expect(page.getByText("agent started")).toBeVisible();
  });

  test("opens agent config", async ({ page }) => {
    await page.getByRole("button", { name: /Agents \(1\)/ }).click();
    await page.getByRole("button", { name: "Config" }).click();
    await expect(page.getByRole("heading", { name: "Agent Config" })).toBeVisible();
    await expect(page.getByText("qwen3:8b")).toBeVisible();
    const dialog = page.locator(".devteam-modal").filter({ has: page.getByRole("heading", { name: "Agent Config" }) });
    await expect(dialog.getByText("4096 MB")).toBeVisible();
    await expect(dialog.getByText("75%")).toBeVisible();
  });

  test("surfaces QA approval action", async ({ page }) => {
    await page.getByText("Run final QA").click();
    page.on("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Approve Deploy" }).click();
  });
});
