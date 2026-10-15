import { Room, Client } from 'colyseus';

export class HelloRoom extends Room {
  maxClients = 8;

  onJoin(client: Client) {
    client.send('welcome', { message: `welcome, ${client.sessionId}` });
  }

  onLeave(client: Client) {
    console.log(`${client.sessionId} left hello_room`);
  }
}
