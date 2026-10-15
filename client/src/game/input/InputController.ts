import type Phaser from 'phaser';
import type { PlayerInput, Vector2 } from '@game/shared';
import type { InputSource } from './InputSource';
import { KeyboardMouseInputSource } from './KeyboardMouseInputSource';
import { TouchInputSource } from './TouchInputSource';

/** One `PlayerInput` producer, whichever device this turns out to be. */
export class InputController {
  private source: InputSource;
  private sequence = 0;

  constructor(scene: Phaser.Scene, isTouch: boolean, getPlayerWorldPosition: () => Vector2) {
    this.source = isTouch
      ? new TouchInputSource(scene)
      : new KeyboardMouseInputSource(scene, getPlayerWorldPosition);
  }

  sample(): PlayerInput {
    return { ...this.source.sample(), sequence: this.sequence++ };
  }

  destroy() {
    this.source.destroy();
  }
}
