import Phaser from 'phaser';

/**
 * A simple hand-rolled touch joystick: a fixed base circle and a thumb that
 * follows the finger, clamped to `radius`. Tracks one pointer by id so it
 * doesn't steal input meant for another joystick or button on screen at the
 * same time.
 */
export class VirtualJoystick {
  private scene: Phaser.Scene;
  private centerX: number;
  private centerY: number;
  private radius: number;
  private base: Phaser.GameObjects.Arc;
  private thumb: Phaser.GameObjects.Arc;
  private pointerId: number | null = null;
  private vector = { x: 0, y: 0 };

  constructor(scene: Phaser.Scene, centerX: number, centerY: number, radius = 55) {
    this.scene = scene;
    this.centerX = centerX;
    this.centerY = centerY;
    this.radius = radius;
    this.base = scene.add
      .circle(centerX, centerY, radius, 0xffffff, 0.12)
      .setScrollFactor(0)
      .setDepth(1000);
    this.thumb = scene.add
      .circle(centerX, centerY, radius * 0.5, 0xffffff, 0.3)
      .setScrollFactor(0)
      .setDepth(1001);

    scene.input.on('pointerdown', this.onPointerDown, this);
    scene.input.on('pointermove', this.onPointerMove, this);
    scene.input.on('pointerup', this.onPointerUp, this);
  }

  private grabRadius(): number {
    return this.radius * 1.6;
  }

  private onPointerDown = (pointer: Phaser.Input.Pointer) => {
    if (this.pointerId !== null) return;
    const dist = Phaser.Math.Distance.Between(pointer.x, pointer.y, this.centerX, this.centerY);
    if (dist > this.grabRadius()) return;
    this.pointerId = pointer.id;
    this.updateFromPointer(pointer);
  };

  private onPointerMove = (pointer: Phaser.Input.Pointer) => {
    if (pointer.id !== this.pointerId) return;
    this.updateFromPointer(pointer);
  };

  private onPointerUp = (pointer: Phaser.Input.Pointer) => {
    if (pointer.id !== this.pointerId) return;
    this.pointerId = null;
    this.vector = { x: 0, y: 0 };
    this.thumb.setPosition(this.centerX, this.centerY);
  };

  private updateFromPointer(pointer: Phaser.Input.Pointer) {
    const dx = pointer.x - this.centerX;
    const dy = pointer.y - this.centerY;
    const dist = Math.min(Math.hypot(dx, dy), this.radius);
    const angle = Math.atan2(dy, dx);
    const clampedX = Math.cos(angle) * dist;
    const clampedY = Math.sin(angle) * dist;
    this.thumb.setPosition(this.centerX + clampedX, this.centerY + clampedY);
    this.vector = { x: clampedX / this.radius, y: clampedY / this.radius };
  }

  /** Both axes in [-1, 1]; y is positive downward (screen space). */
  getVector(): { x: number; y: number } {
    return this.vector;
  }

  isActive(): boolean {
    return this.pointerId !== null;
  }

  destroy() {
    this.scene.input.off('pointerdown', this.onPointerDown, this);
    this.scene.input.off('pointermove', this.onPointerMove, this);
    this.scene.input.off('pointerup', this.onPointerUp, this);
    this.base.destroy();
    this.thumb.destroy();
  }
}
