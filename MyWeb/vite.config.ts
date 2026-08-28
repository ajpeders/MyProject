import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function readBackendApiKey(): string {
  const backendEnv = resolve(process.cwd(), "../MyAgent/.env");
  if (!existsSync(backendEnv)) return "";
  const match = readFileSync(backendEnv, "utf8").match(/^MYDEVTEAM_API_KEY=(.*)$/m);
  return match?.[1]?.trim().replace(/^['"]|['"]$/g, "") ?? "";
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiKey = env.VITE_API_KEY || env.MYDEVTEAM_API_KEY || readBackendApiKey();

  return {
    plugins: [react()],
    server: {
      proxy: {
        "/api/admin": {
          target: env.VITE_DEV_API_PROXY_TARGET || "http://localhost:8000",
          changeOrigin: true,
        },
        "/api": {
          target: env.VITE_DEV_API_PROXY_TARGET || "http://localhost:8000",
          changeOrigin: true,
          headers: apiKey ? { "X-API-Key": apiKey } : undefined,
        },
      },
    },
    test: {
      environment: "jsdom",
      setupFiles: ["./src/test/setup.ts"],
      globals: true,
      include: ["src/**/*.{test,spec}.{ts,tsx}"],
      exclude: ["node_modules/**", "tests/**"],
    },
  };
});
