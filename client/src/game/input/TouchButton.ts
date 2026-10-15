import Phaser from 'phaser';

/**
 * A round touch button with its own label. Tracks `justPressed` for one
 * frame (edge-triggered actions like melee/reload) and `isDown` for the
 * duration of the press.
 */
export class TouchButton {
  private circle: Phaser.GameObjects.Arc;
  private label: Phaser.GameObjects.Text;
  private down = false;
  private pressedThisFrame = false;

  constructor(scene: Phaser.Scene, x: number, y: number, text: string, radius = 30) {
    this.circle = scene.add
      .circle(x, y, radius, 0xffffff, 0.15)
      .setScrollFactor(0)
      .setDepth(1000)
      .setInteractive();
    this.label = scene.add
      .text(x, y, text, { fontFamily: 'sans-serif', fontSize: '11px', color: '#ffffff' })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1001);

    this.circle.on('pointerdown', () => {
      this.down = true;
      this.pressedThisFrame = true;
    });
    this.circle.on('pointerup', () => {
      this.down = false;
    });
    this.circle.on('pointerout', () => {
      this.down = false;
    });
  }

  /** True for exactly one `consumePress()` call after the button goes down. */
  consumePress(): boolean {
    const pressed = this.pressedThisFrame;
    this.pressedThisFrame = false;
    return pressed;
  }

  isDown(): boolean {
    return this.down;
  }

  destroy() {
    this.circle.destroy();
    this.label.destroy();
  }
}
