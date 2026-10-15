import Phaser from 'phaser';
import { Client, type Room } from '@colyseus/sdk';
import { GAME_NAME } from '@game/shared';

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'ws://localhost:2567';

export class HelloScene extends Phaser.Scene {
  private statusText?: Phaser.GameObjects.Text;
  private room?: Room;

  constructor() {
    super('HelloScene');
  }

  create() {
    this.cameras.main.setBackgroundColor('#1d1f27');

    this.add
      .text(this.scale.width / 2, this.scale.height / 2 - 40, GAME_NAME, {
        fontFamily: 'sans-serif',
        fontSize: '32px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    this.statusText = this.add
      .text(this.scale.width / 2, this.scale.height / 2 + 10, 'connecting…', {
        fontFamily: 'sans-serif',
        fontSize: '18px',
        color: '#9aa0ac',
      })
      .setOrigin(0.5);

    void this.connect();
  }

  private async connect() {
    try {
      const client = new Client(SERVER_URL);
      this.room = await client.joinOrCreate('hello_room');

      this.room.onMessage('welcome', (payload: { message: string }) => {
        this.statusText?.setText(payload.message);
      });
    } catch (err) {
      this.statusText?.setText(`connection failed: ${(err as Error).message}`);
    }
  }

  shutdown() {
    this.room?.leave();
  }
}
