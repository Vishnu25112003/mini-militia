import Phaser from 'phaser';
import { ResizeHandle } from './ResizeHandle';
import type { ControlLayout } from './touchLayout';
import { drawIcon, type IconId } from './uiIcons';

/**
 * A round touch button with its own label. Tracks `justPressed` for one
 * frame (edge-triggered actions like melee/reload) and `isDown` for the
 * duration of the press. In edit mode (Phase 13), it becomes draggable and
 * grows a resize handle instead of responding to presses.
 */
export class TouchButton {
  private scene: Phaser.Scene;
  private circle: Phaser.GameObjects.Arc;
  private label: Phaser.GameObjects.Text;
  private iconGraphics?: Phaser.GameObjects.Graphics;
  private resizeHandle: ResizeHandle;
  private baseRadius: number;
  private down = false;
  private pressedThisFrame = false;
  private editable = false;

  constructor(scene: Phaser.Scene, x: number, y: number, text: string, radius = 30, icon?: IconId) {
    this.scene = scene;
    this.baseRadius = radius;
    this.circle = scene.add
      .circle(x, y, radius, 0xffffff, 0.15)
      .setScrollFactor(0)
      .setDepth(1000)
      .setInteractive({ useHandCursor: true, draggable: true });
    scene.input.setDraggable(this.circle, false);
    this.label = scene.add
      .text(x, y, icon ? '' : text, { fontFamily: 'sans-serif', fontSize: '11px', color: '#ffffff' })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1001);

    if (icon) {
      this.iconGraphics = scene.add.graphics().setScrollFactor(0).setDepth(1001);
      drawIcon(this.iconGraphics, icon, radius);
      this.iconGraphics.setPosition(x, y);
    }

    this.circle.on('pointerdown', () => {
      if (this.editable) return;
      this.down = true;
      this.pressedThisFrame = true;
    });
    this.circle.on('pointerup', () => {
      this.down = false;
    });
    this.circle.on('pointerout', () => {
      this.down = false;
    });
    this.circle.on('drag', (_pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
      if (!this.editable) return;
      this.setPosition(dragX, dragY);
    });

    this.resizeHandle = new ResizeHandle(
      scene,
      () => ({ x: this.circle.x, y: this.circle.y }),
      this.baseRadius,
      (scale) => this.applyScale(scale),
    );
    this.resizeHandle.reposition(this.circle.scale);
  }

  private setPosition(x: number, y: number) {
    this.circle.setPosition(x, y);
    this.label.setPosition(x, y);
    this.iconGraphics?.setPosition(x, y);
    this.resizeHandle.reposition(this.circle.scale);
  }

  private applyScale(scale: number) {
    this.circle.setScale(scale);
    this.label.setScale(scale);
    this.iconGraphics?.setScale(scale);
    this.resizeHandle.reposition(scale);
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

  setEditable(editable: boolean) {
    this.editable = editable;
    this.down = false;
    this.scene.input.setDraggable(this.circle, editable);
    this.resizeHandle.setVisible(editable);
  }

  getLayout(): ControlLayout {
    return { x: this.circle.x, y: this.circle.y, scale: this.circle.scale };
  }

  setLayout(layout: ControlLayout) {
    this.setPosition(layout.x, layout.y);
    this.applyScale(layout.scale);
  }

  destroy() {
    this.circle.destroy();
    this.label.destroy();
    this.iconGraphics?.destroy();
    this.resizeHandle.destroy();
  }
}
