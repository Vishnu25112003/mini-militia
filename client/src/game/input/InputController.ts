import type Phaser from 'phaser';
import type { PlayerInput, Vector2 } from '@game/shared';
import type { InputSource } from './InputSource';
import { KeyboardMouseInputSource } from './KeyboardMouseInputSource';
import { TouchInputSource } from './TouchInputSource';

/** One `PlayerInput` producer, whichever device this turns out to be. */
export class InputController {
  private source: InputSource;
  private sequence = 0;
  private pendingSwap = false;
  private pendingSwitchGrenade = false;

  constructor(scene: Phaser.Scene, isTouch: boolean, getPlayerWorldPosition: () => Vector2) {
    this.source = isTouch
      ? new TouchInputSource(scene)
      : new KeyboardMouseInputSource(scene, getPlayerWorldPosition);

    // Mouse wheel swaps slots on desktop, same as tapping the gun box or pressing 1/2.
    if (!isTouch) scene.input.on('wheel', () => this.requestSwap());
  }

  /** One-shot weapon swap request — from a mouse wheel tick or tapping the gun box. */
  requestSwap() {
    this.pendingSwap = true;
  }

  /** One-shot grenade-type switch request — from tapping the grenade box (same as Q / the touch switch button). */
  requestSwitchGrenade() {
    this.pendingSwitchGrenade = true;
  }

  sample(): PlayerInput {
    const raw = this.source.sample();
    const swapSlot = raw.swapSlot || this.pendingSwap;
    const switchGrenade = raw.switchGrenade || this.pendingSwitchGrenade;
    this.pendingSwap = false;
    this.pendingSwitchGrenade = false;
    return { ...raw, swapSlot, switchGrenade, sequence: this.sequence++ };
  }

  destroy() {
    this.source.destroy();
  }
}
