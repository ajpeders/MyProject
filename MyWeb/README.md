# MyWeb

React + TypeScript tool suite shell for MyAgent. Browser-only SPA that surfaces
mail, news, search, chat, memory, calendar, admin, settings, devteam, whisper,
and a local-LLM agent page under a single authenticated layout.

## Stack

- React 19 (`package.json` `react ^19.2.4`)
- TypeScript `~5.4.0` (`package.json` `devDependencies.typescript`)
- Vite 8 (`package.json` `devDependencies.vite ^8.0.4`)
- React Router 7 (`react-router-dom ^7.14.1`)
- `terminal.css` + `src/styles/app.css`
- Vitest 4 + Playwright 1.59 for tests

## Quick Start

```bash
npm install
npm run dev            # Vite dev server on port 5173
```

The dev server proxies `/api/*` to MyAgent on port `8000`
(`vite.config.ts` lines 20-26). Start MyAgent first:

```bash
cd ../MyAgent && ./start.sh
```

Endpoint settings live in `.env` (see `.env.example`).

## Common Commands

```bash
npm run dev       # start Vite (port 5173)
npm test          # run Vitest once
npm run e2e       # run Playwright (testDir: tests/e2e)
npm run build     # tsc + Vite production build
npm run lint      # ESLint
```

## Further Docs

See `ARCHITECTURE.md`, `ROADMAP.md`, `HOWTO.md`, `docs/MAIL_ROADMAP.md`, and
`docs/MAIL_BUGS.md` for design, status, step-by-step guides, and the live mail
bug list.
