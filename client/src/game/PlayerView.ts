import Phaser from 'phaser';
import type { Facing } from '@game/shared';

const WIDTH = 24;
const HEIGHT = 48;
const AIM_LINE_LENGTH = 44;
const HEALTH_BAR_WIDTH = 32;
const HEALTH_BAR_HEIGHT = 4;
const MAX_HEALTH = 100;

/**
 * Placeholder art: a tinted rectangle, a name tag, a small triangle marking
 * which side the crouch shield would be on, a line along the exact aim
 * angle (coarser than `facing`, which is just left/right), and a small
 * health bar. A gold outline marks the 3-second spawn shield.
 */
export class PlayerView {
  private body: Phaser.GameObjects.Rectangle;
  private facingMarker: Phaser.GameObjects.Triangle;
  private aimLine: Phaser.GameObjects.Line;
  private nameTag: Phaser.GameObjects.Text;
  private healthBarBg: Phaser.GameObjects.Rectangle;
  private healthBarFill: Phaser.GameObjects.Rectangle;

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
    this.healthBarBg = scene.add
      .rectangle(0, 0, HEALTH_BAR_WIDTH, HEALTH_BAR_HEIGHT, 0x000000, 0.6)
      .setOrigin(0.5, 0.5);
    this.healthBarFill = scene.add
      .rectangle(0, 0, HEALTH_BAR_WIDTH, HEALTH_BAR_HEIGHT, 0x3cb44b)
      .setOrigin(0, 0.5);
  }

  /**
   * One resolved, ready-to-draw snapshot — no interpolation math here. The
   * offline sandbox lerps its own prev/curr physics states before calling
   * this; networked play reads an already-smoothed value from `Predict`.
   */
  render(
    x: number,
    y: number,
    facing: Facing,
    crouching: boolean,
    aimAngle: number,
    alive = true,
    health = MAX_HEALTH,
    shieldSecondsRemaining = 0,
  ) {
    this.setVisible(alive);
    if (!alive) return;

    const displayHeight = crouching ? HEIGHT * 0.6 : HEIGHT;

    this.body.setPosition(x, y);
    this.body.setSize(WIDTH, displayHeight);
    this.body.setStrokeStyle(shieldSecondsRemaining > 0 ? 3 : 0, 0xffd700, 0.9);
    this.nameTag.setPosition(x, y - HEIGHT / 2 - 14);

    const dir = facing === 'right' ? 1 : -1;
    this.facingMarker.setPosition(x + dir * (WIDTH / 2 + 6), y);
    this.facingMarker.setScale(dir, 1);

    this.aimLine.setPosition(x, y);
    this.aimLine.setRotation(aimAngle);

    const healthBarY = y - HEIGHT / 2 - 6;
    this.healthBarBg.setPosition(x, healthBarY);
    this.healthBarFill.setPosition(x - HEALTH_BAR_WIDTH / 2, healthBarY);
    const ratio = Math.max(0, Math.min(1, health / MAX_HEALTH));
    this.healthBarFill.setSize(HEALTH_BAR_WIDTH * ratio, HEALTH_BAR_HEIGHT);
    this.healthBarFill.setFillStyle(ratio > 0.5 ? 0x3cb44b : ratio > 0.25 ? 0xf58231 : 0xe6194b);
  }

  private setVisible(visible: boolean) {
    this.body.setVisible(visible);
    this.facingMarker.setVisible(visible);
    this.aimLine.setVisible(visible);
    this.nameTag.setVisible(visible);
    this.healthBarBg.setVisible(visible);
    this.healthBarFill.setVisible(visible);
  }

  destroy() {
    this.body.destroy();
    this.facingMarker.destroy();
    this.aimLine.destroy();
    this.nameTag.destroy();
    this.healthBarBg.destroy();
    this.healthBarFill.destroy();
  }
}
