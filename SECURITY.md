# Security policy

## Reporting a vulnerability

Please report security problems privately through GitHub: **Security → Report a vulnerability** on this repository. Do not open a public issue for them. You can expect a first reply within a few days.

## What matters most here

Clawds runs AI agents that can execute code on the user's computer, so the important boundaries are:

- **Who can talk to the server.** It binds to `127.0.0.1` and accepts WebSocket connections only from pages on `127.0.0.1` / `localhost` (the interface port and the server port). Bypasses of this check, for example from a web page or another machine, are in scope.
- **Files bots can attach and the server serves.** Only paths inside the project folders, bot folders and uploads are allowed; `.git`, `state.json`, sign-in data and keys are refused. Path traversal or symlink escapes are in scope.
- **Secrets.** API keys of custom endpoints live only on the server (`server-data/providers.json`) and must never reach the browser. Sign-in data is in `server/claude-config`.
- **Agent permissions.** Bots run with full permissions by default (`bypassPermissions`); this is documented and can be turned off in Settings. It is not a vulnerability by itself.

## Supported versions

Only the latest release and `main`. This is an early prototype.
