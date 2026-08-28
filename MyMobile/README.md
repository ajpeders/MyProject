# MyMobile

React Native / Expo app for MyAgent — v1 scope is mail triage from your phone.

## Stack

- Expo SDK 54, React Native 0.81, React 19, TypeScript ~5.9
- `expo-router` for file-system based navigation (`app/` directory)
- `expo-secure-store` for the JWT + session ID (Keychain on iOS, EncryptedSharedPreferences on Android)
- Talks to the same `/api/account/*`, `/api/mail/*` endpoints the web app uses — backend lives in `../MyAgent/`

## What it does today

- Login + register against `/api/account/{login,register}`
- Mail list pulled from `/api/mail` (incremental sync via `/api/mail/fetch` + `incremental: true`)
- Per-row **Apply** button: runs the AI's recommended action — `delete` → Trash, `archive` → recommended folder
- Bulk **Apply all**: same rules, batched over every actionable row, with a confirm dialog showing the count
- **Delete is locked to Trash.** Same invariant as the web app, enforced by tests in `__tests__/applyRecommendation.test.ts`
- **Settings**: tap the gear in the Mail toolbar. Two tabs:
  - **AI** — list / add / edit / delete named AI configs (Ollama, OpenAI, Anthropic, OpenAI-compatible). API keys are encrypted at rest by MyAgent and never echoed back.
  - **Mail** — pick which AI config Mail analysis uses, plus IMAP accounts CRUD.

## Run

```sh
# One-time
npm install                # or: pnpm install / yarn

# Start the Metro bundler — opens a QR code in your terminal
npm start

# Then either:
#   - scan the QR with the Expo Go app on your phone (iOS or Android)
#   - press `i` for iOS simulator (requires Xcode on macOS)
#   - press `a` for Android emulator
```

Your phone must be on the same LAN/VPN as the gateway because the prod backend at `https://myproject.example.com` is gated by `local-only@file` middleware in Traefik (see `services/traefik/dynamic.yml` in the homelab repo). WireGuard on `10.9.0.0/24` covers the away-from-home case.

The base URL is read from `app.json` → `expo.extra.apiBaseUrl`. To point at a different gateway (dev box, alternate host), edit that value or set `EXPO_PUBLIC_API_BASE_URL` before `npm start`.

## Layout

```
app/
  _layout.tsx     # expo-router root (Stack navigator + status bar)
  index.tsx       # auth gate → /login or /mail
  login.tsx       # login + register tabs
  mail.tsx        # inbox list + Sync + Apply / Apply all + gear → /settings
  settings.tsx    # AI configs CRUD + IMAP accounts + AI-config-for-Mail picker
src/
  api/
    client.ts        # apiFetch + ApiError, reads JWT from SecureStore
    auth.ts          # login / register / logout
    mail.ts          # getMailPage, fetchMail, moveMail
    aiConfigs.ts     # list / create / update / delete AI configs
    imap.ts          # list / add / delete IMAP accounts
    mailConfig.ts    # getMailConfig + setMailAIConfig
  lib/
    applyRecommendation.ts   # shared apply rules (mirrored from MyWeb)
__tests__/
  applyRecommendation.test.ts
```

## Tests

```sh
npm test
```

These pin the "delete = Trash, never expunge" invariant and the recommendation routing logic. They DO NOT (yet) cover the actual React Native screens — those need a React Native Testing Library setup. Add as needed.

## Roadmap

See the project root `ROADMAP.md` for the cross-project plan. Mobile-specific follow-ups (not yet captured upstream):

- Push notifications via `expo-notifications` + ntfy bridge so digest summaries land on the lock screen
- Voice capture screen against `/api/whisper/agent` once we want feature parity with the iPhone Shortcut path
- iPhone on-device LLM support: detect and offer local iOS model runtimes as an AI-config provider for private/offline mail analysis where device capability allows
- React Native screen tests once we add `@testing-library/react-native` (today only the apply-rules library is covered)
