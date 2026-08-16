import "@testing-library/jest-dom";

// MailPage gates dev-only UI on `import.meta.env.DEV && VITE_DEV_MODE === "true"`.
// Vitest sets DEV=true; force VITE_DEV_MODE so the gated branches render in tests.
import.meta.env.VITE_DEV_MODE = "true";

// Use a Map to back localStorage so tests can actually read what they write
const storage = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => { storage.set(key, value); },
    removeItem: (key: string) => { storage.delete(key); },
    clear: () => { storage.clear(); },
  },
  writable: true,
});

// Mock WebSocket
class MockWebSocket {
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  close() {}
  send() {}
}
Object.defineProperty(globalThis, "WebSocket", {
  value: MockWebSocket,
  writable: true,
});