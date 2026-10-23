import { createServer } from 'node:http';
import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { GAME_NAME } from '@game/shared';
import { HelloRoom } from './rooms/HelloRoom';

// Settings come from the environment so the same build runs locally and on the VPS (Phase 00).
const PORT = Number(process.env.PORT ?? 2567);
const HOST = process.env.HOST ?? '0.0.0.0';
const startedAt = Date.now();

const httpServer = createServer();

const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
  greet: false,
  express: (app) => {
    // Plain HTTP health check for monitoring, nginx and deploy scripts.
    app.get('/health', (_req, res) => {
      res.set('Access-Control-Allow-Origin', '*');
      res.json({ status: 'ok', game: GAME_NAME, uptimeSeconds: Math.round((Date.now() - startedAt) / 1000) });
    });
  },
});

gameServer.define('hello_room', HelloRoom);

await gameServer.listen(PORT, HOST);
console.log(`[server] ${GAME_NAME} listening on ${HOST}:${PORT}  (health: /health)`);
