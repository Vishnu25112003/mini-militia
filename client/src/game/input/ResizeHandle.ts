import Phaser from 'phaser';

const MIN_SCALE = 0.6;
const MAX_SCALE = 1.8;

/**
 * A small handle shown only in edit mode, sitting at a control's top-right
 * edge — dragging it toward/away from the control's center rescales it.
 * Shared by `TouchButton` and `VirtualJoystick` so resize behaves identically
 * everywhere ("drag to move and resize every control", per the flow).
 */
export class ResizeHandle {
  private dot: Phaser.GameObjects.Arc;
  private scene: Phaser.Scene;
  private getCenter: () => { x: number; y: number };
  private baseRadius: number;
  private onResize: (scale: number) => void;

  constructor(
    scene: Phaser.Scene,
    getCenter: () => { x: number; y: number },
    baseRadius: number,
    onResize: (scale: number) => void,
  ) {
    this.scene = scene;
    this.getCenter = getCenter;
    this.baseRadius = baseRadius;
    this.onResize = onResize;
    this.dot = scene.add
      .circle(0, 0, 8, 0xffcc00, 0.9)
      .setScrollFactor(0)
      .setDepth(1002)
      .setVisible(false);
    this.dot.setInteractive({ useHandCursor: true, draggable: true });
    this.scene.input.setDraggable(this.dot, false);

    this.dot.on('drag', (_pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
      const center = this.getCenter();
      const distance = Math.hypot(dragX - center.x, dragY - center.y);
      const scale = Phaser.Math.Clamp(distance / this.baseRadius, MIN_SCALE, MAX_SCALE);
      this.onResize(scale);
    });
  }

  setVisible(visible: boolean) {
    this.dot.setVisible(visible);
    this.scene.input.setDraggable(this.dot, visible);
  }

  /** Call after any move/resize so the handle stays anchored to the control's current edge. */
  reposition(scale: number) {
    const center = this.getCenter();
    const angle = -Math.PI / 4; // top-right
    this.dot.setPosition(
      center.x + Math.cos(angle) * this.baseRadius * scale,
      center.y + Math.sin(angle) * this.baseRadius * scale,
    );
  }

  destroy() {
    this.dot.destroy();
  }
}
