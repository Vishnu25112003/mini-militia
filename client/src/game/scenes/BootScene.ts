import Phaser from 'phaser';
import { GAME_NAME } from '@game/shared';

/** Phase 00 scene: plain background, the shared constant, and the server's "welcome" text. */
export class BootScene extends Phaser.Scene {
  private title!: Phaser.GameObjects.Text;
  private status!: Phaser.GameObjects.Text;

  constructor() {
    super('boot');
  }

  create() {
    this.cameras.main.setBackgroundColor('#1b1424');
    const { width, height } = this.scale;

    this.title = this.add
      .text(width / 2, height / 2 - 30, GAME_NAME, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '44px',
        color: '#fbbf24',
      })
      .setOrigin(0.5);
    this.status = this.add
      .text(width / 2, height / 2 + 30, 'Connecting to the server…', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '24px',
        color: '#e7e5e4',
      })
      .setOrigin(0.5);

    // React owns the network connection and hands text over through the game registry
    this.registry.events.on('changedata-status', (_p: unknown, value: string) => this.status.setText(value));
    const current = this.registry.get('status') as string | undefined;
    if (current) this.status.setText(current);

    this.scale.on('resize', (size: Phaser.Structs.Size) => {
      this.title.setPosition(size.width / 2, size.height / 2 - 30);
      this.status.setPosition(size.width / 2, size.height / 2 + 30);
    });
  }
}
