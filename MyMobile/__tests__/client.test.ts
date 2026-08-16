jest.mock("expo-constants", () => ({ expoConfig: { extra: { apiBaseUrl: "https://api.test" } } }));
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async (key: string) => key),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

import * as SecureStore from "expo-secure-store";
import { ApiError, STORAGE, apiFetch } from "../src/api/client";

const fetchMock = jest.fn();
(global as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;

function response(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 401 ? "Unauthorized" : "Error",
    text: async () => JSON.stringify(body),
    json: async () => body,
  } as Response;
}

beforeEach(() => {
  fetchMock.mockReset();
  jest.mocked(SecureStore.deleteItemAsync).mockClear();
});

describe("apiFetch", () => {
  it("clears stored auth before throwing on 401", async () => {
    fetchMock.mockResolvedValueOnce(response(401, { detail: "Session expired" }));

    await expect(apiFetch("/api/private")).rejects.toThrow(ApiError);

    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(STORAGE.token);
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(STORAGE.sessionId);
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(STORAGE.account);
  });
});
