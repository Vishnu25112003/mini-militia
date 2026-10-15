# Mini Militia — WAN Friends Play (v1)

Own 2D jetpack shooter in the browser, playing like Mini Militia Classic, for up to 8 friends over the internet. See `MM Docs/00 Index.md` for the full plan.

## Monorepo layout

```
client/   React (menus) + Phaser (match) — Vite + TypeScript
server/   Colyseus game server — Node.js + TypeScript
shared/   Movement/collision rules, stats, map JSON — used by both client and server
```

## Prerequisites

- Node.js LTS (18+)
- npm 10+

## Install

From the repo root:

```bash
npm install
```

This installs all three workspaces (`client`, `server`, `shared`) in one pass.

## Run locally

Build the shared package first (client and server both depend on its compiled output):

```bash
npm run build:shared
```

Then start both the server and the client in watch mode:

```bash
npm run dev
```

- Server runs on `ws://localhost:2567` (health check at `http://localhost:2567/health`)
- Client runs on `http://localhost:5173` (Vite's default port)

Open the client URL in a browser — it connects to the local server, joins `hello_room`, and shows a "welcome" message from the server to prove the full pipeline works.

If you change `shared/src`, re-run `npm run build:shared` (or `npm run dev --workspace=shared` in a separate terminal to rebuild on save) so the compiled `dist/` output client and server import stays current.

## Environment variables

| App | File | Variable | Purpose |
|---|---|---|---|
| client | `client/.env` (copy from `client/.env.example`) | `VITE_SERVER_URL` | WebSocket URL of the Colyseus server. Defaults to `ws://localhost:2567` if unset. |
| server | `server/.env` (copy from `server/.env.example`) | `PORT` | Port the Colyseus/Express server listens on. Defaults to `2567`. |

## Deployment (Phase 00 target)

- **Client → Vercel:** set project root to `client/`, set `VITE_SERVER_URL` to the server's `wss://` address.
- **Server → VPS:** clone repo, `npm install`, `npm run build`, run `server/dist/index.js` with `pm2`, behind an `nginx` reverse proxy with WebSocket upgrade headers, with a Let's Encrypt SSL certificate so the server is reachable over `wss://`.
- Vercel **cannot** run the always-on Colyseus WebSocket server — it only hosts the static client.

## Linting / formatting

```bash
npm run lint
npm run format
```

## Build for production

```bash
npm run build
```

Builds `shared`, then `server`, then `client`, in that order.
