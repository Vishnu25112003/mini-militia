import 'dotenv/config';
import { createServer } from 'node:http';
import cors from 'cors';
import { Server } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { GAME_NAME } from '@game/shared';
import { HelloRoom } from './rooms/HelloRoom.js';

const port = Number(process.env.PORT ?? 2567);
const httpServer = createServer();

const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
  express: (app) => {
    app.use(cors());
    app.get('/health', (_req, res) => {
      res.status(200).json({ status: 'ok', game: GAME_NAME });
    });
  },
});

gameServer.define('hello_room', HelloRoom);

await gameServer.listen(port);
console.log(`${GAME_NAME} server listening on port ${port}`);
