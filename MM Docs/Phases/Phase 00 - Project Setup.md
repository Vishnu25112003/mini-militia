---
phase: 0
title: Project Setup
status: in-progress
depends_on: []
tags: [phase, setup, infrastructure]
---

# Phase 00 — Project Setup

← [[00 Index]] | Next → [[Phase 01 - Shared Core]]

## Goal
An empty but **fully connected** project: the browser client, the Colyseus server, and the shared module all build, run, and talk to each other. The client runs on **Vercel** and the server on the **testing VPS**, so we prove the whole pipeline works over the real internet before writing any game code.

## Why this phase comes first
Everything else depends on this skeleton. If deployment, WebSockets, or SSL are broken, every later phase is blocked. Finding that out on day one is cheap; finding it out in Phase 10 is expensive.

## Flow references
- [[Game Flow#14. Tech Stack & Architecture]]
- [[Game Flow#15. Server & Networking]]
- [[Game Flow#19. Hosting]]

## Scope
**In scope**
- Monorepo structure: `client/`, `server/`, `shared/`
- Tooling: TypeScript, Vite, React, Phaser, Colyseus
- A "hello" connection: browser joins a Colyseus room and gets a reply
- Deploy client → Vercel, server → testing VPS with HTTPS/WSS

**Out of scope**
- Any game logic, movement, map, lobby UI

## Tasks

### 1. Repository & tooling
- [x] Install Node.js (LTS) and Git on the dev machine
- [ ] Create a Git repository (GitHub) for the project — local `git init` done; GitHub remote is Dev4's to create and push
- [x] Set up a monorepo with **npm workspaces**: `client`, `server`, `shared`
- [x] Root `tsconfig.base.json` with `strict: true`; each package extends it
- [x] ESLint + Prettier with one shared config at the root
- [x] `.gitignore` (node_modules, dist, .env)
- [x] `README.md` with "how to run locally" steps

### 2. Shared package
- [x] `shared/` as a TypeScript package (e.g. `@game/shared`)
- [x] Export one test constant (e.g. `GAME_NAME`) and import it from both client and server to prove sharing works

### 3. Client
- [x] Vite + React + TypeScript app in `client/`
- [x] Add Phaser; create a `GameCanvas` React component that mounts a Phaser game inside the page
- [x] Phaser scene shows a plain background and the text from `shared`
- [x] Add the Colyseus client SDK (`@colyseus/sdk` — the version-matched SDK for Colyseus 0.18, replacing the older `colyseus.js` package which only supports the older `@colyseus/schema` v3 wire format)
- [x] Server URL from an environment variable (`VITE_SERVER_URL`), so local and VPS URLs can switch without code changes

### 4. Server
- [x] Colyseus server in `server/` (TypeScript)
- [x] One test room (`hello_room`) that replies "welcome" to a joining client
- [x] A simple HTTP health route (`/health`) returning OK
- [x] Port and settings from environment variables

### 5. Local end-to-end test
- [x] Run client and server locally
- [x] Browser joins `hello_room`, receives "welcome", shows it on screen — verified via a scripted `@colyseus/sdk` client (same handshake a browser performs) since this session's browser automation can't reach this machine's localhost; Dev4 should also confirm visually at `http://localhost:5173`

### 6. Deployment (testing setup) — deferred to Dev4
- [ ] **Server on testing VPS:** install Node, clone repo, build, run with a process manager (**pm2**) so it restarts on crash/reboot
- [ ] **nginx** in front of the server as a reverse proxy (WebSocket upgrade headers enabled)
- [ ] **SSL** with Let's Encrypt (certbot) → server reachable on `wss://`
- [ ] **Client on Vercel:** connect the GitHub repo, set root to `client/`, set `VITE_SERVER_URL` to the VPS `wss://` address
- [ ] Note the VPS location in this file (affects testing lag numbers)

## Deliverables
- Monorepo pushed to GitHub
- Client live on a Vercel URL
- Server live on the VPS over `wss://`
- README with run + deploy steps

## Acceptance criteria (Definition of Done)
- [x] `npm install` + one command starts client and server locally (`npm install`, then `npm run dev`)
- [ ] Phone on **mobile data (4G)** opens the Vercel link and sees "welcome" from the VPS — blocked on Dev4 doing the deployment steps in Task 6
- [ ] Laptop browser does the same — blocked on deployment
- [ ] Server survives a restart (pm2 brings it back) — blocked on deployment
- [x] Shared constant visible in both client and server (`GAME_NAME` imported from `@game/shared` into both)

## Testing steps
1. Open the Vercel link on an Android phone using mobile data → "welcome" appears.
2. Repeat on an iPhone (Safari) if available.
3. Restart the VPS → after reboot, link works again without manual steps.
4. Open browser dev tools → connection shows `wss://` (not `ws://`).

## Risks & notes
- **Mixed content:** a Vercel (HTTPS) page can't connect to a plain `ws://` server — SSL on the VPS is mandatory.
- **Vercel cannot host the game server** (no always-on WebSockets) — only the website goes there.
- If the VPS is outside India, ping will be higher in testing than in the final setup. That's expected.

## Notes / decisions log
- VPS location: _(fill in)_
- 2026-10-15: Local monorepo built and verified end-to-end (client ↔ server handshake over `@colyseus/sdk` + Colyseus, shared constant flowing both ways, clean `npm run build` from a cold cache, ESLint/Prettier clean). Scope was deliberately split: GitHub push, VPS provisioning, nginx/SSL, and Vercel deploy are left to Dev4 since they need Dev4's own accounts/credentials — this agent only has local filesystem/shell access.
- Library versions pinned during setup were re-checked against the npm registry rather than assumed, since the ecosystem had moved since this plan was written: Colyseus server is on **0.18.x** (not 0.16.x) and the matching client SDK is **`@colyseus/sdk`** (the `colyseus.js` package is pinned to the older `@colyseus/schema` v3 wire format and fails to matchmake against a 0.18 server — confirmed by testing, not guessed). TypeScript pinned to the 6.0.x line (new stable major) rather than the bleeding-edge 7.0.x native-compiler release, for tooling stability.
- Also learned the hard way: `tsc -b` silently no-ops if you delete `dist/` but leave a stray `*.tsbuildinfo` behind — it thinks the project is already up to date. Delete both together when forcing a clean rebuild.

## Approval gate
- [ ] All acceptance criteria met — local pipeline done; the 3 VPS/Vercel-dependent criteria are open until Dev4 deploys
- [ ] **Dev4 approval to move to Phase 01**
