import Phaser from 'phaser';
import type { PlayerState } from '@game/shared';

const WIDTH = 24;
const HEIGHT = 48;
const AIM_LINE_LENGTH = 44;

/**
 * Placeholder art: a tinted rectangle, a name tag, a small triangle marking
 * which side the crouch shield would be on, and a line along the exact aim
 * angle (coarser than `facing`, which is just left/right).
 */
export class PlayerView {
  private body: Phaser.GameObjects.Rectangle;
  private facingMarker: Phaser.GameObjects.Triangle;
  private aimLine: Phaser.GameObjects.Line;
  private nameTag: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, colorHex: string, name: string) {
    const color = Phaser.Display.Color.HexStringToColor(colorHex).color;

    this.body = scene.add.rectangle(0, 0, WIDTH, HEIGHT, color);
    this.facingMarker = scene.add.triangle(0, 0, 0, -6, 10, 0, 0, 6, 0xffffff, 0.9);
    this.aimLine = scene.add
      .line(0, 0, 0, 0, AIM_LINE_LENGTH, 0, 0xffffff, 0.5)
      .setOrigin(0, 0.5)
      .setLineWidth(2);
    this.nameTag = scene.add
      .text(0, 0, name, { fontFamily: 'sans-serif', fontSize: '12px', color: colorHex })
      .setOrigin(0.5, 1);
  }

  render(prev: PlayerState, curr: PlayerState, alpha: number, aimAngle: number) {
    const x = Phaser.Math.Linear(prev.position.x, curr.position.x, alpha);
    const y = Phaser.Math.Linear(prev.position.y, curr.position.y, alpha);
    const displayHeight = curr.crouching ? HEIGHT * 0.6 : HEIGHT;

    this.body.setPosition(x, y);
    this.body.setSize(WIDTH, displayHeight);
    this.nameTag.setPosition(x, y - HEIGHT / 2 - 6);

    const dir = curr.facing === 'right' ? 1 : -1;
    this.facingMarker.setPosition(x + dir * (WIDTH / 2 + 6), y);
    this.facingMarker.setScale(dir, 1);

    this.aimLine.setPosition(x, y);
    this.aimLine.setRotation(aimAngle);
  }

  destroy() {
    this.body.destroy();
    this.facingMarker.destroy();
    this.aimLine.destroy();
    this.nameTag.destroy();
  }
}
