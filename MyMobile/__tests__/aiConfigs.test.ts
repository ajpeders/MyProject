/**
 * Wire-shape tests for the mobile AI-configs client. These don't talk to the
 * network — they intercept fetch + assert the request body matches what the
 * backend's pydantic models in MyAgent/src/services/ai_configs/models.py
 * accept. If you change either side, this test catches the mismatch.
 */
jest.mock("expo-constants", () => ({ expoConfig: { extra: { apiBaseUrl: "https://api.test" } } }));
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => "fake-jwt"),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

import {
  createAIConfig,
  deleteAIConfig,
  listAIConfigs,
  listOllamaModels,
  updateAIConfig,
} from "../src/api/aiConfigs";

const fetchMock = jest.fn();
(global as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;

function ok(json: unknown): Response {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    text: async () => JSON.stringify(json),
    json: async () => json,
  } as Response;
}

beforeEach(() => fetchMock.mockReset());

describe("aiConfigs client", () => {
  it("listAIConfigs sends GET to /api/ai-configs with bearer token", async () => {
    fetchMock.mockResolvedValueOnce(ok([]));
    await listAIConfigs();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.test/api/ai-configs",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer fake-jwt" }),
      }),
    );
  });

  it("listOllamaModels sends the optional host query", async () => {
    fetchMock.mockResolvedValueOnce(ok({ models: ["qwen3:8b"] }));
    const result = await listOllamaModels("http://192.168.1.40:11434");
    expect(result.models).toEqual(["qwen3:8b"]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.test/api/ai-configs/models/ollama?host=http%3A%2F%2F192.168.1.40%3A11434",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer fake-jwt" }),
      }),
    );
  });

  it("createAIConfig POSTs the expected JSON body", async () => {
    fetchMock.mockResolvedValueOnce(ok({ id: "x" }));
    await createAIConfig({
      name: "Local Ollama",
      provider: "ollama",
      host: "http://192.168.1.40:11434",
      model: "qwen3:8b",
    });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      name: "Local Ollama",
      provider: "ollama",
      host: "http://192.168.1.40:11434",
      model: "qwen3:8b",
    });
  });

  it("updateAIConfig omits api_key when not provided", async () => {
    fetchMock.mockResolvedValueOnce(ok({ id: "x" }));
    await updateAIConfig("cfg-1", { name: "renamed", model: "qwen3:14b" });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ name: "renamed", model: "qwen3:14b" });
  });

  it("deleteAIConfig hits the id path with DELETE", async () => {
    fetchMock.mockResolvedValueOnce(ok({}));
    await deleteAIConfig("cfg-1");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.test/api/ai-configs/cfg-1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});
