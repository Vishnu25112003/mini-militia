import 'dotenv/config';
import { createServer } from 'node:http';
import cors from 'cors';
import { Server } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { GAME_NAME } from '@game/shared';
import { HelloRoom } from './rooms/HelloRoom.js';
import { loadCatacombsMap } from './map.js';

const port = Number(process.env.PORT ?? 2567);
const httpServer = createServer();

const catacombs = loadCatacombsMap();

const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
  express: (app) => {
    app.use(cors());
    app.get('/health', (_req, res) => {
      res.status(200).json({ status: 'ok', game: GAME_NAME });
    });
    app.get('/map-info', (_req, res) => {
      const { collisionMap, spawnPoints, pickupSpots } = catacombs;
      res.status(200).json({
        widthInTiles: collisionMap.widthInTiles,
        heightInTiles: collisionMap.heightInTiles,
        tileSize: collisionMap.tileSize,
        spawnPointCount: spawnPoints.length,
        pickupSpotCount: pickupSpots.length,
        // The map's (0,0) corner tile and a tile near its center, to prove the
        // server can actually answer "is this tile solid?" from the loaded file.
        cornerTileIsSolid: collisionMap.isSolidTile(0, 0),
        centerTileIsSolid: collisionMap.isSolidTile(
          Math.floor(collisionMap.widthInTiles / 2),
          Math.floor(collisionMap.heightInTiles / 2),
        ),
      });
    });
  },
});

gameServer.define('hello_room', HelloRoom);

await gameServer.listen(port);
console.log(`${GAME_NAME} server listening on port ${port}`);
