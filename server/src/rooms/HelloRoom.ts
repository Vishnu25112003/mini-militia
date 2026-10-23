import { Room, type Client } from '@colyseus/core';
import { GAME_NAME } from '@game/shared';

/** Phase 00 connectivity test: replies "welcome" to every client that joins. */
export class HelloRoom extends Room {
  maxClients = 8;

  onJoin(client: Client) {
    client.send('welcome', {
      message: `Welcome to ${GAME_NAME}`,
      sessionId: client.sessionId,
      serverTime: Date.now(),
    });
  }
}
