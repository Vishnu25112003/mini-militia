# Mini Militia WAN

A Mini Militia-style 2D jetpack shooter that friends play **over the internet, in the browser**.
Up to 8 players per room, one Catacombs-style map, authoritative server.

The plan lives in [`Mini-Militia-WAN-Plan/`](Mini-Militia-WAN-Plan/00%20Index.md): the **Game Flow** is the source of
truth for every rule, and each phase file tracks its own status (`not-started` → `in-progress` → `done`).

## Layout

```
client/   React (menus) + Phaser (match screen), Vite, Tailwind
server/   Colyseus game server (Node.js, TypeScript)
shared/   rules, config, physics, map — used by both client and server
deploy/   nginx / pm2 / deploy-script templates for the VPS
legacy/   the earlier solo + LAN prototype, kept intact (see legacy/README.md)
Mini-Militia-WAN-Plan/   the plan (Obsidian notes)
```

## Run locally

Requires Node.js 22+ (LTS).

```bash
npm install
npm run dev          # starts the server (:2567) and the client (:5173) together
```

Open http://localhost:5173 — you should see the title and the server's welcome message.
Check the server directly at http://localhost:2567/health.

| Command                | What it does                                  |
| ---------------------- | --------------------------------------------- |
| `npm run dev`          | server + client together                      |
| `npm run dev:server`   | server only                                   |
| `npm run dev:client`   | client only                                   |
| `npm run typecheck`    | TypeScript check in all three packages        |
| `npm test`             | unit tests (Vitest)                           |
| `npm run lint`         | ESLint                                        |
| `npm run format`       | Prettier                                      |
| `npm run build`        | typecheck + production build of every package |
| `npm run start:server` | run the server for production (behind nginx)  |

### Settings (environment variables)

| Where  | Variable          | Default               | Meaning                                          |
| ------ | ----------------- | --------------------- | ------------------------------------------------ |
| server | `PORT`            | `2567`                | port to listen on                                |
| server | `HOST`            | `0.0.0.0`             | interface (use `127.0.0.1` behind nginx)         |
| client | `VITE_SERVER_URL` | `ws://localhost:2567` | game server address (`wss://…` on Vercel / prod) |

Copy `client/.env.example` to `client/.env` to change the client's value.

## Deploy (testing setup)

The website goes to **Vercel**; the game server must run on a **VPS** (Vercel cannot hold always-on WebSockets).

1. **Server on the VPS**
   - Install Node.js LTS, `git`, `nginx`, `pm2` (`npm i -g pm2`), `certbot`.
   - `git clone` the repo, `npm ci`, then `pm2 start deploy/ecosystem.config.cjs && pm2 save && pm2 startup`.
   - Put `deploy/nginx.conf.example` in nginx (edit `server_name`), then `sudo certbot --nginx -d <your-domain>` for
     HTTPS/WSS. A Vercel (HTTPS) page cannot talk to plain `ws://`, so SSL is mandatory.
   - Updates afterwards: `bash deploy/deploy-server.sh`.
2. **Client on Vercel**
   - Import the GitHub repo. `vercel.json` already sets the build command and output directory (`client/dist`).
   - Set the environment variable `VITE_SERVER_URL=wss://<your-domain>`.
3. Check `https://<your-domain>/health`, then open the Vercel link on a phone using mobile data.

## Legacy prototype

The first prototype (solo + LAN play, custom Canvas renderer, 60 Hz custom websocket server) is preserved in
`legacy/prototype/`, and a zip backup sits next to this folder (`../Catacombs-prototype-backup.zip`).
It is not part of the v1 plan (WAN multiplayer only) but nothing from it was deleted.
