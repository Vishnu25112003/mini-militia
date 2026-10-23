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
- [ ] Install Node.js (LTS) and Git on the dev machine
- [ ] Create a Git repository (GitHub) for the project
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
- [x] Add the Colyseus JS client library
- [x] Server URL from an environment variable (`VITE_SERVER_URL`), so local and VPS URLs can switch without code changes

### 4. Server
- [x] Colyseus server in `server/` (TypeScript)
- [x] One test room (`hello_room`) that replies "welcome" to a joining client
- [x] A simple HTTP health route (`/health`) returning OK
- [x] Port and settings from environment variables

### 5. Local end-to-end test
- [x] Run client and server locally
- [x] Browser joins `hello_room`, receives "welcome", shows it on screen

### 6. Deployment (testing setup)
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
- [x] `npm install` + one command starts client and server locally
- [ ] Phone on **mobile data (4G)** opens the Vercel link and sees "welcome" from the VPS
- [ ] Laptop browser does the same
- [ ] Server survives a restart (pm2 brings it back)
- [x] Shared constant visible in both client and server

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
- VPS location: _(fill in — no VPS has been set up yet)_
- **Local part: done and verified** (2026-10-23). `npm run dev` starts server (:2567) + client (:5173); Chrome loaded the page from :5173, joined `hello_room` on :2567 (cross-origin) and showed "Welcome to Mini Militia WAN"; `/health` returns OK; typecheck, ESLint and Prettier pass.
- **Versions chosen ("latest stable")**: Phaser 4.2.1, Colyseus server 0.18 (`@colyseus/core` 0.18.23, ws-transport 0.18.4, schema 5) with the matching client SDK `@colyseus/sdk` 0.18.6 (the older `colyseus.js` 0.16 is for the 0.16 server and is not compatible), Vite 8, React 19, TypeScript 6, Vitest 5, Tailwind 4.
- **Prototype preserved, nothing deleted:** the earlier solo + LAN prototype moved to `legacy/prototype/` (34 files) and a verified zip backup sits at `../Catacombs-prototype-backup.zip`.
- **Prepared but NOT executed (needs Dev4's accounts / server):** `deploy/nginx.conf.example`, `deploy/ecosystem.config.cjs` (pm2), `deploy/deploy-server.sh`, `vercel.json`, deploy steps in the root `README.md`.
- **Still open in this phase:** Git is not installed on this machine and there is no GitHub repo yet (tasks 1.1 and 1.2); everything in task 6 (VPS + pm2, nginx, SSL, Vercel); the 4G / laptop / reboot acceptance checks.
- Tailwind is included in the client for the React menus (requested earlier); Phaser stays in charge of the match screen only.

## Approval gate
- [ ] All acceptance criteria met
- [ ] **Dev4 approval to move to Phase 01**
