import { Client } from '@colyseus/sdk';
import { SERVER_URL } from './serverUrl';

export interface WelcomeMessage {
  message: string;
  sessionId: string;
  serverTime: number;
}

/** Phase 00 connectivity test: join `hello_room`, resolve with the server's welcome message. */
export async function joinHelloRoom(): Promise<{ welcome: WelcomeMessage; leave: () => void }> {
  const client = new Client(SERVER_URL);
  const room = await client.joinOrCreate('hello_room');
  const welcome = await new Promise<WelcomeMessage>((resolve) => {
    room.onMessage('welcome', (msg: WelcomeMessage) => resolve(msg));
  });
  return { welcome, leave: () => void room.leave() };
}
