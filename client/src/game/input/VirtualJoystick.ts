import Phaser from 'phaser';
import { ResizeHandle } from './ResizeHandle';
import type { ControlLayout } from './touchLayout';

/**
 * A simple hand-rolled touch joystick: a fixed base circle and a thumb that
 * follows the finger, clamped to `radius`. Tracks one pointer by id so it
 * doesn't steal input meant for another joystick or button on screen at the
 * same time. In edit mode (Phase 13), dragging the base moves it and a
 * resize handle scales it instead of it tracking a finger normally.
 */
export class VirtualJoystick {
  private scene: Phaser.Scene;
  private centerX: number;
  private centerY: number;
  private baseRadius: number;
  private scaleFactor = 1;
  private base: Phaser.GameObjects.Arc;
  private thumb: Phaser.GameObjects.Arc;
  private resizeHandle: ResizeHandle;
  private pointerId: number | null = null;
  private vector = { x: 0, y: 0 };
  private editable = false;

  constructor(scene: Phaser.Scene, centerX: number, centerY: number, radius = 55) {
    this.scene = scene;
    this.centerX = centerX;
    this.centerY = centerY;
    this.baseRadius = radius;
    this.base = scene.add
      .circle(centerX, centerY, radius, 0xffffff, 0.12)
      .setScrollFactor(0)
      .setDepth(1000)
      .setInteractive({ draggable: true });
    scene.input.setDraggable(this.base, false);
    this.thumb = scene.add
      .circle(centerX, centerY, radius * 0.5, 0xffffff, 0.3)
      .setScrollFactor(0)
      .setDepth(1001);

    scene.input.on('pointerdown', this.onPointerDown, this);
    scene.input.on('pointermove', this.onPointerMove, this);
    scene.input.on('pointerup', this.onPointerUp, this);
    this.base.on('drag', (_pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
      if (!this.editable) return;
      this.setCenter(dragX, dragY);
    });

    this.resizeHandle = new ResizeHandle(
      scene,
      () => ({ x: this.centerX, y: this.centerY }),
      this.baseRadius,
      (scale) => this.applyScale(scale),
    );
    this.resizeHandle.reposition(this.scaleFactor);
  }

  /** The joystick's effective radius right now (base radius × current scale). */
  private get radius(): number {
    return this.baseRadius * this.scaleFactor;
  }

  private grabRadius(): number {
    return this.radius * 1.6;
  }

  private setCenter(x: number, y: number) {
    this.centerX = x;
    this.centerY = y;
    this.base.setPosition(x, y);
    this.thumb.setPosition(x, y);
    this.resizeHandle.reposition(this.scaleFactor);
  }

  private applyScale(scale: number) {
    this.scaleFactor = scale;
    this.base.setScale(scale);
    this.thumb.setScale(scale);
    this.resizeHandle.reposition(scale);
  }

  private onPointerDown = (pointer: Phaser.Input.Pointer) => {
    if (this.editable || this.pointerId !== null) return;
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

  setEditable(editable: boolean) {
    this.editable = editable;
    if (editable) {
      this.pointerId = null;
      this.vector = { x: 0, y: 0 };
      this.thumb.setPosition(this.centerX, this.centerY);
    }
    this.scene.input.setDraggable(this.base, editable);
    this.resizeHandle.setVisible(editable);
  }

  getLayout(): ControlLayout {
    return { x: this.centerX, y: this.centerY, scale: this.scaleFactor };
  }

  setLayout(layout: ControlLayout) {
    this.setCenter(layout.x, layout.y);
    this.applyScale(layout.scale);
  }

  destroy() {
    this.scene.input.off('pointerdown', this.onPointerDown, this);
    this.scene.input.off('pointermove', this.onPointerMove, this);
    this.scene.input.off('pointerup', this.onPointerUp, this);
    this.base.destroy();
    this.thumb.destroy();
    this.resizeHandle.destroy();
  }
}
