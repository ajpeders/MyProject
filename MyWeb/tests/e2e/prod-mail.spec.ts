/**
 * End-to-end smoke test against the live prod deployment.
 *
 * Runs only when E2E_PROD_BASE_URL is set (skipped otherwise so it never
 * runs in normal CI against the dev server). Exercises:
 *   - Register a fresh randomized account on /login
 *   - Land on Home with the trimmed-down sidebar (Home + Mail + Settings)
 *   - Open /mail and verify the page renders (setup banner is fine — no IMAP)
 *
 * Run: E2E_PROD_BASE_URL=https://myproject.example.com npx playwright test prod-mail
 */
import { expect, test } from "@playwright/test";

const PROD_BASE_URL = process.env.E2E_PROD_BASE_URL;

test.describe("prod smoke (mail surface only)", () => {
  test.skip(!PROD_BASE_URL, "set E2E_PROD_BASE_URL to run prod smoke");

  test.use({
    baseURL: PROD_BASE_URL,
    ignoreHTTPSErrors: true,
  });

  test("register a fresh user, land on home, only Mail + Settings in sidebar, /mail loads", async ({ page }) => {
    const email = `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@e2e.local`;
    const password = "playwright-e2e-passphrase";

    await page.goto("/login");

    // Switch to Register tab and fill the form.
    await page.getByRole("button", { name: "Register" }).click();
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByLabel("Confirm Password").fill(password);

    await page.getByRole("button", { name: /create account/i }).click();

    // Successful register triggers a full-page reload to "/" — wait for Home heading.
    await expect(page.getByRole("heading", { name: "MyAgent Tools" })).toBeVisible({ timeout: 15_000 });

    // Sidebar should expose only Home + Mail + Settings.
    await expect(page.getByRole("link", { name: "Home" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Mail" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Settings" })).toBeVisible();
    await expect(page.getByRole("link", { name: "News" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Chat" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "DevTeam" })).toHaveCount(0);

    // Visit /mail. No IMAP configured for the fresh account, so the setup
    // banner is the expected state — confirms the route is wired up and the
    // Mail page renders without crashing.
    await page.getByRole("link", { name: "Mail" }).click();
    await expect(page).toHaveURL(/\/mail$/);
    await expect(page.getByText(/No IMAP accounts are configured/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("link", { name: /Set up IMAP/i })).toBeVisible();
  });
});
