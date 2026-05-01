import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const authResponse = {
  user_id: "user-e2e",
  session_id: "session-e2e",
  account: "e2e@example.com",
};

const mailResponse = {
  emails: [
    {
      index: 1,
      from: "ops@example.com",
      subject: "Production digest",
      date: "2026-04-20",
      recommendation: "archive",
      account: "config",
      read: false,
    },
    {
      index: 2,
      from: "alerts@example.com",
      subject: "Action needed",
      date: "2026-04-20",
      recommendation: "reply",
      account: "config",
      read: true,
    },
  ],
  page: 1,
  total_pages: 1,
  total_emails: 2,
  content: "Fetched 2 emails.",
};

async function signInBrowser(page: Page) {
  await page.addInitScript((auth) => {
    localStorage.setItem("myagent.user_id", auth.user_id);
    localStorage.setItem("myagent.session_id", auth.session_id);
    localStorage.setItem("myagent.account", auth.account);
    localStorage.setItem("myagent.email", auth.account);
  }, authResponse);
}

test.describe("MyAgent user flows", () => {
  test("registers without an API key field", async ({ page }) => {
    await page.route("**/api/account/register", async (route) => {
      expect(route.request().headers()["x-api-key"]).toBeUndefined();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(authResponse),
      });
    });

    await page.goto("/login");
    await page.getByRole("button", { name: "Register" }).click();

    await expect(page.getByLabel(/api key/i)).toHaveCount(0);

    await page.getByLabel("Email").fill(authResponse.account);
    await page.getByLabel("Password", { exact: true }).fill("Password123!");
    await page.getByLabel("Confirm Password").fill("Password123!");
    await page.getByRole("button", { name: "Create Account" }).click();

    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { name: "MyAgent Tools" })).toBeVisible();
  });

  test("loads mail, recommendations, and message content", async ({ page }) => {
    await signInBrowser(page);
    await page.route("**/api/imap", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
    });
    await page.route("**/api/mail/fetch", async (route) => {
      expect(route.request().method()).toBe("POST");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mailResponse),
      });
    });
    await page.route("**/api/mail/1", async (route) => {
      expect(route.request().method()).toBe("GET");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          index: 1,
          from: "ops@example.com",
          subject: "Production digest",
          date: "2026-04-20",
          body: "Full production digest body.",
          account: "config",
          recommendation: "archive",
        }),
      });
    });

    await page.goto("/mail");

    await expect(page.getByRole("heading", { name: "Mail" })).toBeVisible();
    await expect(page.getByText("Production digest")).toBeVisible();
    await expect(page.getByText("rec: archive")).toBeVisible();
    await expect(page.getByRole("status")).toContainText("2 emails");

    await page.getByText("Production digest").click();

    await expect(page.getByRole("heading", { name: "Production digest" })).toBeVisible();
    await expect(page.getByText("Full production digest body.")).toBeVisible();
  });

  test("searches the web and browses a result", async ({ page }) => {
    await signInBrowser(page);
    await page.route("**/api/search", async (route) => {
      expect(route.request().method()).toBe("POST");
      expect(route.request().postDataJSON()).toEqual({ query: "backend search contract" });
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          answer: "Search returns a direct answer and web results.",
          results: [
            {
              title: "Search API",
              url: "https://example.com/search-api",
              snippet: "POST /api/search and browse URLs.",
            },
          ],
        }),
      });
    });
    await page.route("**/api/search/browse?url=*", async (route) => {
      expect(route.request().url()).toContain(encodeURIComponent("https://example.com/search-api"));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ summary: "This page documents the search endpoints." }),
      });
    });

    await page.goto("/search");
    await page.getByLabel("Question").fill("backend search contract");
    await page.getByRole("button", { name: "Search" }).click();

    await expect(page.getByText("Search returns a direct answer and web results.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Search API" })).toBeVisible();
    await expect(page.getByText("POST /api/search and browse URLs.")).toBeVisible();

    await page.getByRole("button", { name: "Search API" }).click();

    await expect(page.getByText("This page documents the search endpoints.")).toBeVisible();
  });

  test("shows normal search without the llm answer block", async ({ page }) => {
    await signInBrowser(page);
    await page.route("**/api/search", async (route) => {
      expect(route.request().method()).toBe("POST");
      expect(route.request().postDataJSON()).toEqual({ query: "backend search contract" });
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          answer: "Search returns a direct answer and web results.",
          results: [
            {
              title: "Search API",
              url: "https://example.com/search-api",
              snippet: "POST /api/search and browse URLs.",
            },
          ],
        }),
      });
    });

    await page.goto("/search");
    await page.getByRole("tab", { name: "Normal Search" }).click();
    await page.getByLabel("Query").fill("backend search contract");
    await page.getByRole("button", { name: "Search" }).click();

    await expect(page.getByRole("button", { name: "Search API" })).toBeVisible();
    await expect(page.getByText("POST /api/search and browse URLs.")).toBeVisible();
    await expect(page.getByText("Search returns a direct answer and web results.")).toHaveCount(0);
  });

  test("shows search answers inline on chat page", async ({ page }) => {
    await signInBrowser(page);
    await page.route("**/api/search", async (route) => {
      expect(route.request().method()).toBe("POST");
      expect(route.request().postDataJSON()).toEqual({ query: "duckduckgo ollama design" });
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          answer: "DuckDuckGo finds results and Ollama writes the answer.",
          results: [],
        }),
      });
    });

    await page.goto("/chat");
    await page.getByLabel("Message").fill("duckduckgo ollama design");
    await page.getByRole("button", { name: "Send" }).click();

    await expect(page.getByText("DuckDuckGo finds results and Ollama writes the answer.")).toBeVisible();
  });

  test("adds, searches, and deletes memories", async ({ page }) => {
    await signInBrowser(page);
    const memories = [
      {
        memory_id: "mem-1",
        content: "Prefers DuckDuckGo for search.",
        created_at: 1_776_672_000,
      },
    ];
    await page.route((url) => {
      const parsed = new URL(url);
      return parsed.pathname === "/api/memory" || parsed.pathname.startsWith("/api/memory/");
    }, async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const pathname = url.pathname;
      if (request.method() === "POST") {
        expect(request.postDataJSON()).toEqual({ content: "Remember to prefer local Ollama." });
        memories.push({
          memory_id: "mem-2",
          content: "Remember to prefer local Ollama.",
          created_at: 1_776_672_300,
        });
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(memories[memories.length - 1]),
        });
        return;
      }

      if (request.method() === "DELETE" && pathname.endsWith("/mem-2")) {
        const index = memories.findIndex((memory) => memory.memory_id === "mem-2");
        if (index >= 0) memories.splice(index, 1);
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
        return;
      }

      const query = url.searchParams.get("q") ?? "";
      if (query) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(
            memories
              .filter((memory) => memory.content.toLowerCase().includes(query.toLowerCase()))
              .map((memory) => ({ ...memory, score: 0.991 })),
          ),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(memories),
      });
    });

    await page.goto("/memory");
    await expect(page.getByRole("heading", { name: "Memory" })).toBeVisible();

    await page.getByLabel("Add Memory").fill("Remember to prefer local Ollama.");
    await page.getByRole("button", { name: "Save Memory" }).click();
    await expect(page.getByText("Memory saved.")).toBeVisible();

    await page.getByLabel("Search Memories").fill("local ollama");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page.getByText('Showing matches for "local ollama".')).toBeVisible();
    await expect(page.getByText("Remember to prefer local Ollama.")).toBeVisible();

    await page
      .getByRole("listitem")
      .filter({ hasText: "Remember to prefer local Ollama." })
      .getByRole("button", { name: "Delete" })
      .click();
    await expect(page.getByText("Memory deleted.")).toBeVisible();
  });

  test("admin page loads dashboard for authenticated admin users", async ({ page }) => {
    await page.route("**/api/admin/stats", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ user_count: 1, session_count: 1, db_size_bytes: 2048 }),
      });
    });
    await page.route("**/api/admin/users", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{ user_id: "user-e2e", email: "admin-target@example.com" }]),
      });
    });
    await page.route("**/api/admin/sessions", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{ session_id: "session-e2e", user_id: "user-e2e", has_mail: true }]),
      });
    });

    // Simulate an authenticated admin session
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.setItem("myagent.session_id", "test-session");
      localStorage.setItem("myagent.user_id", "test-user");
      localStorage.setItem("myagent.account", "admin");
    });

    await page.goto("/admin");

    await expect(page.getByRole("button", { name: "refresh" })).toBeVisible();
    await expect(page.getByText("admin-target@example.com")).toBeVisible();
    await expect(page.getByText("session-e2e")).toBeVisible();
  });
});
