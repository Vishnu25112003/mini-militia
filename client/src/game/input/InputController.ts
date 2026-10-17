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
  private suppressed = false;

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

  /**
   * While the chat popup is focused, every gameplay-affecting field is zeroed
   * before it's ever sent — the match keeps running (the player can still be
   * killed), but typing a message can't also fire a gun or swing melee. Aim
   * angle is kept as-is so the view doesn't snap when chat closes.
   */
  setSuppressed(suppressed: boolean) {
    this.suppressed = suppressed;
  }

  sample(): PlayerInput {
    const raw = this.source.sample();
    if (this.suppressed) {
      return {
        moveX: 0,
        fly: false,
        crouch: false,
        aimAngle: raw.aimAngle,
        fire: false,
        melee: false,
        throwGrenade: false,
        switchGrenade: false,
        reload: false,
        swapSlot: false,
        pickupOrPair: false,
        replaceSlotChoice: raw.replaceSlotChoice,
        sequence: this.sequence++,
      };
    }

    const swapSlot = raw.swapSlot || this.pendingSwap;
    const switchGrenade = raw.switchGrenade || this.pendingSwitchGrenade;
    this.pendingSwap = false;
    this.pendingSwitchGrenade = false;
    return { ...raw, swapSlot, switchGrenade, sequence: this.sequence++ };
  }

  /** True for exactly one call after the chat-open action fires (Enter on desktop). */
  consumeChatToggle(): boolean {
    return this.source.consumeChatToggle();
  }

  destroy() {
    this.source.destroy();
  }
}
