# How-To

Step-by-step guides for common MyWeb tasks. All commands assume cwd is
`MyWeb/`.

## Run Locally

```bash
npm install
npm run dev
```

Vite serves on `http://localhost:5173`. Start MyAgent on `:8000` first (the
dev server proxies `/api/*` there — see `vite.config.ts` lines 20-26).

DevTeam features assume the DevTeam daemon on `:4223`
(`VITE_DEVTEAM_API_URL`).

## Run Unit Tests (Vitest)

```bash
npm test -- --run
```

`npm test` is wired to `vitest run`. `--run` ensures a one-shot run even from
contexts that might enable watch mode. For watch mode use:

```bash
npm run test:watch
```

To run a single file:

```bash
npm test -- --run src/tools/mail/MailPage.test.tsx
```

## Run E2E Tests (Playwright)

```bash
npx playwright test
```

Or via the npm script:

```bash
npm run e2e
```

Test directory is `tests/e2e/` (per `playwright.config.ts` line 4 —
**not** `src/e2e/`, despite earlier docs). Current specs:

- `tests/e2e/devteam.spec.ts`
- `tests/e2e/myagent.spec.ts`

Playwright auto-starts the dev server on `127.0.0.1:5173`
(`playwright.config.ts` `webServer` block).

## Add a New Tool

1. Create the page component at `src/tools/<name>/<Name>Page.tsx`.
2. Import and register a route in `src/App.tsx` inside the `RequireAuth`
   block. Follow the existing pattern (e.g. line 39 `<Route path="/mail"
   element={<MailPage />} />`).
3. Add a `ToolEntry` to `src/tools/registry.ts` so the new tool shows up on
   the home-page grid. Required fields: `name`, `path`, `description`.
4. If the page needs backend data, add an `src/api/<name>.ts` client that uses
   `apiFetch` from `src/api/client.ts` (MyAgent) or follows the
   `devteamFetch<T>` pattern in `src/api/devteam.ts` (DevTeam).
5. Co-locate tests as `*.test.ts(x)` next to source.

## Debug a Failing Test

```bash
npm test -- --run --reporter=verbose <path>
```

For a specific test name, append `-t "<name fragment>"`:

```bash
npm test -- --run --reporter=verbose -t "opens email" src/tools/mail/MailPage.test.tsx
```

Useful sanity checks:

- `console.log` inside the test prints to the Vitest output.
- `screen.debug()` from `@testing-library/react` prints rendered DOM.

## Mock the Backend in Tests

Existing tests mock API modules with `vi.spyOn`. Pattern (see
`src/tools/mail/MailPage.test.tsx`):

```ts
import * as mail from "../../api/mail";
vi.spyOn(mail, "fetchMail").mockResolvedValue({ /* ... */ });
```

For `apiFetch` itself, mock at the module boundary
(`vi.spyOn(client, "apiFetch")`), but prefer mocking the higher-level
`src/api/*` helper so tests stay decoupled from header logic.

## Run a Production Build

```bash
npm run build
```

Runs `tsc -b` then `vite build`. Output is `dist/`. Use `npm run preview` to
serve the build locally.
