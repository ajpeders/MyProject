import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  listTasks,
  getTask,
  cancelTask,
  deleteProject,
  createWebhook,
  listWebhooks,
  deleteWebhook,
  getCurrentUser,
  createTask,
  editTask,
  getNodeInfo,
  getAgentLogs,
  getAgentConfig,
  getDashboardStats,
  approveDeploy,
} from "./devteam";

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

function mockResponse(data: unknown, status = 200) {
  const body = status === 204 ? "" : JSON.stringify(data);
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(body),
  } as Response);
}

describe("devteam API", () => {
  beforeEach(() => mockFetch.mockReset());

  describe("listTasks", () => {
    it("calls POST /api/task/list", async () => {
      mockFetch.mockResolvedValue(mockResponse([]));
      await listTasks({});
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:4223/api/task/list",
        expect.objectContaining({ method: "POST" })
      );
    });

    it("throws on non-ok response", async () => {
      mockFetch.mockResolvedValue(mockResponse("error", 500));
      await expect(listTasks({})).rejects.toThrow('"error"');
    });

    it("passes type and status filters", async () => {
      mockFetch.mockResolvedValue(mockResponse([]));
      await listTasks({ type: "dev", status: "pending" });
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:4223/api/task/list",
        expect.objectContaining({
          body: JSON.stringify({ type: "dev", status: "pending" }),
        })
      );
    });

    it("passes assigned_to filter", async () => {
      mockFetch.mockResolvedValue(mockResponse([]));
      await listTasks({ assigned_to: "dev-0" });
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:4223/api/task/list",
        expect.objectContaining({
          body: JSON.stringify({ assigned_to: "dev-0" }),
        })
      );
    });
  });

  describe("getTask", () => {
    it("calls POST /api/task/get with task_id", async () => {
      mockFetch.mockResolvedValue(mockResponse({ id: "123" }));
      const result = await getTask("123");
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:4223/api/task/get",
        expect.objectContaining({
          body: JSON.stringify({ task_id: "123" }),
        })
      );
      expect(result.id).toBe("123");
    });
  });

  describe("user APIs", () => {
    it("gets current user from POST /api/user/me", async () => {
      mockFetch.mockResolvedValue(mockResponse({ id: "user-1", name: "admin", is_admin: true }));
      const result = await getCurrentUser();
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:4223/api/user/me",
        expect.objectContaining({ body: JSON.stringify({}) })
      );
      expect(result.is_admin).toBe(true);
    });

  });

  describe("createTask", () => {
    it("passes required project_id", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({ task_id: "task-1" }));
      mockFetch.mockResolvedValueOnce(mockResponse({ task: { id: "task-1" } }));
      await createTask("Build it", {}, "project-1");
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:4223/api/task/create",
        expect.objectContaining({
          body: JSON.stringify({ project_id: "project-1", description: "Build it", type: "dev", params: {} }),
        })
      );
    });

    it("passes type for orchestrator tasks", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({ task: { id: "task-1" } }));
      await createTask("Decompose this", {}, "project-1", "orchestrator");
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:4223/api/task/create",
        expect.objectContaining({
          body: JSON.stringify({ project_id: "project-1", description: "Decompose this", type: "orchestrator", params: {} }),
        })
      );
    });
  });

  describe("cancelTask", () => {
    it("calls POST /api/task/cancel", async () => {
      mockFetch.mockResolvedValue(mockResponse(undefined, 204));
      await cancelTask("task-1");
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:4223/api/task/cancel",
        expect.objectContaining({
          body: JSON.stringify({ task_id: "task-1" }),
        })
      );
    });
  });

  describe("editTask", () => {
    const taskFixture = {
      id: "task-1",
      project_id: "proj-1",
      description: "Original description",
      status: "in_progress",
      priority: 3,
      type: "dev",
      parent_id: "",
      revision: 1,
      created_at: "2026-04-25T00:00:00Z",
      updated_at: "2026-04-25T00:00:00Z",
    };

    it("calls PATCH /api/task/edit with description and revision", async () => {
      mockFetch.mockResolvedValue(mockResponse({ task: { ...taskFixture, revision: 2 } }));
      const result = await editTask("task-1", { description: "Updated description" }, 1);
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:4223/api/task/edit",
        expect.objectContaining({
          body: JSON.stringify({ task_id: "task-1", description: "Updated description", revision: 1 }),
        })
      );
      expect(result.revision).toBe(2);
    });

    it("calls PATCH /api/task/edit with priority", async () => {
      mockFetch.mockResolvedValue(mockResponse({ task: { ...taskFixture, priority: 5 } }));
      const result = await editTask("task-1", { priority: 5 }, 1);
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:4223/api/task/edit",
        expect.objectContaining({
          body: JSON.stringify({ task_id: "task-1", priority: 5, revision: 1 }),
        })
      );
      expect(result.priority).toBe(5);
    });

    it("throws on 409 conflict", async () => {
      mockFetch.mockResolvedValue(mockResponse({ detail: "revision mismatch" }, 409));
      await expect(editTask("task-1", { description: "Updated" }, 1)).rejects.toThrow("revision mismatch");
    });

    it("throws on network error", async () => {
      mockFetch.mockResolvedValue(mockResponse("error", 500));
      await expect(editTask("task-1", { description: "Updated" }, 1)).rejects.toThrow('"error"');
    });
  });

  describe("deleteProject", () => {
    it("calls POST /api/project/delete", async () => {
      mockFetch.mockResolvedValue(mockResponse({ ok: true }));
      await deleteProject("project-1");
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:4223/api/project/delete",
        expect.objectContaining({
          body: JSON.stringify({ project_id: "project-1" }),
        })
      );
    });
  });

  describe("webhooks", () => {
    it("creates project webhooks", async () => {
      mockFetch.mockResolvedValue(mockResponse({ id: "webhook-1", url: "https://example.com" }));
      const result = await createWebhook("project-1", "https://example.com", ["task.completed"]);
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:4223/api/webhook/create",
        expect.objectContaining({
          body: JSON.stringify({
            project_id: "project-1",
            url: "https://example.com",
            events: ["task.completed"],
            active: true,
          }),
        })
      );
      expect(result.id).toBe("webhook-1");
    });

    it("lists project webhooks", async () => {
      mockFetch.mockResolvedValue(mockResponse({ webhooks: [{ id: "webhook-1" }] }));
      const result = await listWebhooks("project-1");
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:4223/api/webhook/list",
        expect.objectContaining({
          body: JSON.stringify({ project_id: "project-1" }),
        })
      );
      expect(result[0].id).toBe("webhook-1");
    });

    it("deletes webhooks", async () => {
      mockFetch.mockResolvedValue(mockResponse({ ok: true }));
      await deleteWebhook("webhook-1");
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:4223/api/webhook/delete",
        expect.objectContaining({
          body: JSON.stringify({ webhook_id: "webhook-1" }),
        })
      );
    });
  });

  describe("getDashboardStats", () => {
    it("calls POST /api/dashboard/stats", async () => {
      mockFetch.mockResolvedValue(mockResponse({ total: 2, pending: 1 }));
      const result = await getDashboardStats();
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:4223/api/dashboard/stats",
        expect.objectContaining({ body: JSON.stringify({}) })
      );
      expect(result.total).toBe(2);
      expect(result.pending).toBe(1);
    });
  });

  describe("getNodeInfo", () => {
    it("calls POST /api/node/info", async () => {
      mockFetch.mockResolvedValue(mockResponse({ node_id: "local", status: "running" }));
      const result = await getNodeInfo();
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:4223/api/node/info",
        expect.objectContaining({ body: JSON.stringify({}) })
      );
      expect(result.node_id).toBe("local");
    });
  });

  describe("getAgentLogs", () => {
    it("calls POST /api/agent/logs with agent_id", async () => {
      mockFetch.mockResolvedValue(mockResponse({ log: "started" }));
      const result = await getAgentLogs("dev-0");
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:4223/api/agent/logs",
        expect.objectContaining({
          body: JSON.stringify({ agent_id: "dev-0", tail_lines: 100 }),
        })
      );
      expect(result).toEqual(["started"]);
    });
  });

  describe("getAgentConfig", () => {
    it("calls POST /api/agent/config with type", async () => {
      mockFetch.mockResolvedValue(mockResponse({ type: "dev", llm_model: "qwen3:8b", max_memory_mb: 4096, max_cpu_percent: 75 }));
      const result = await getAgentConfig("dev");
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:4223/api/agent/config",
        expect.objectContaining({
          body: JSON.stringify({ type: "dev" }),
        })
      );
      expect(result).toEqual({
        type: "dev",
        llm_model: "qwen3:8b",
        max_memory_mb: 4096,
        max_cpu_percent: 75,
      });
    });
  });

  describe("approveDeploy", () => {
    it("calls POST /api/deploy/approve", async () => {
      mockFetch.mockResolvedValue(mockResponse({ deploy_task_id: "deploy-1" }));
      const result = await approveDeploy("qa-1");
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:4223/api/deploy/approve",
        expect.objectContaining({
          body: JSON.stringify({ task_id: "qa-1" }),
        })
      );
      expect(result).toBe("deploy-1");
    });
  });
});
