# Contributing to Clawds

Thanks for your interest! Clawds is an early prototype, so small, focused changes are the easiest to review and merge. Issues, ideas and pull requests are all welcome.

## Run it locally

You need Windows, [Node.js 20+](https://nodejs.org), git and (for real bots) [Claude Code](https://docs.claude.com/en/docs/claude-code).

```bash
git clone https://github.com/ClawdsAgent/Clawds.git
cd Clawds
cd server && npm install && cd ..
cd app && npm install && cd ..
start.cmd        # server on :8787 (hot reload), interface on :5173
```

You do not need a Claude account to work on most things. Start the server with the scripted fake `claude` instead:

```bash
cd server
node start-fake.mjs
```

The fake supports `FAKE_SAY=<text>` inside a message (replies with that text), `FAKE_SCRIPT=<file.json>` (scripted replies per bot), `FAKE_STREAM=1` (streams the reply in chunks) and `FAKE_QUOTA` / `FAKE_MS` for quota and timing. Tests and screenshots use a second server on another port with its own data folder (`CLAWDS_PORT=8788 CLAWDS_HOME=<tmp folder>`), so your real session is never touched.

## Project layout

```
app/      React 19 + TypeScript + Vite client (zustand store, no UI framework)
server/   Node server: core.mjs (state, bots, routing), index.mjs (HTTP + WebSocket),
          lib/ (runner, prompts, git, providers, locale), mcp.mjs (tools bots call)
scripts/  release build (npm run release)
docs/     images used by the README
```

## Conventions

- **Languages.** UI strings are Russian keys wrapped in `t('...')` (client, [`app/src/i18n.ts`](app/src/i18n.ts)) or `tr('...')` (server, [`server/lib/locale.mjs`](server/lib/locale.mjs)). Add the English text to [`app/src/locales/en.ts`](app/src/locales/en.ts) or the `EN` map in `locale.mjs`. A string without a translation just shows in Russian.
- **Comments** in the code are in Russian; English comments in new code are fine too.
- **No new dependencies** unless they clearly pay for themselves. The server has a single runtime dependency (`ws`) on purpose, and the release stays tiny.
- **Bot prompts** live in `server/lib/prompts.mjs` and reload without restarting the server.
- **Safety first.** Bots can run code on the user's machine. Anything that widens what the server accepts (origins, file paths, network exposure) needs extra care and a note in the pull request.

## Before you open a pull request

- `cd app && npm run build` must pass (it type-checks).
- Try your change against the fake `claude`, and against a real one if it touches how bots run.
- Keep the change focused and describe what it does and why. Screenshots help for UI changes.
- Do not commit anything from `server-data/`, `workspace/`, `.clawds/` or `server/claude-config/` (they are git-ignored for a reason: chats, keys and sign-in data).

## Good places to start

Look for issues labelled [`good first issue`](https://github.com/ClawdsAgent/Clawds/labels/good%20first%20issue). Testing on Linux or macOS and reporting what breaks is also very valuable.

## Reporting security problems

Please do not open a public issue; see [SECURITY.md](SECURITY.md).
