import Phaser from 'phaser';
import type { InputSource, RawInput } from './InputSource';
import { VirtualJoystick } from './VirtualJoystick';
import { TouchButton } from './TouchButton';

const DEADZONE = 0.35;

/** Touch default layout, from the flow's control table. */
export class TouchInputSource implements InputSource {
  private moveJoystick: VirtualJoystick;
  private aimJoystick: VirtualJoystick;
  private meleeButton: TouchButton;
  private grenadeButton: TouchButton;
  private switchGrenadeButton: TouchButton;
  private reloadButton: TouchButton;
  private pickupButton: TouchButton;
  private lastAimAngle = 0;

  constructor(scene: Phaser.Scene) {
    const { width, height } = scene.scale;

    this.moveJoystick = new VirtualJoystick(scene, 90, height - 90, 55);
    this.grenadeButton = new TouchButton(scene, 175, height - 160, 'nade');
    this.switchGrenadeButton = new TouchButton(scene, 175, height - 230, 'switch', 22);
    this.aimJoystick = new VirtualJoystick(scene, width - 90, height - 90, 55);
    this.meleeButton = new TouchButton(scene, width - 175, height - 90, 'melee');
    this.reloadButton = new TouchButton(scene, width - 90, height - 160, 'reload');
    this.pickupButton = new TouchButton(scene, width - 165, height - 160, 'pickup');
  }

  sample(): RawInput {
    const move = this.moveJoystick.getVector();
    const aim = this.aimJoystick.getVector();

    const moveX: RawInput['moveX'] = move.x > DEADZONE ? 1 : move.x < -DEADZONE ? -1 : 0;
    // Push the joystick up (negative screen y) to fly, down to crouch.
    const fly = move.y < -DEADZONE;
    const crouch = move.y > DEADZONE;

    const aimActive = Math.hypot(aim.x, aim.y) > DEADZONE;
    if (aimActive) this.lastAimAngle = Math.atan2(aim.y, aim.x);
    const fire = this.aimJoystick.isActive() && aimActive;

    const melee = this.meleeButton.consumePress();
    const throwGrenade = this.grenadeButton.consumePress();
    const switchGrenade = this.switchGrenadeButton.consumePress();
    const reload = this.reloadButton.consumePress();
    const pickupOrPair = this.pickupButton.consumePress();

    return {
      moveX,
      fly,
      crouch,
      aimAngle: this.lastAimAngle,
      fire,
      melee,
      throwGrenade,
      switchGrenade,
      reload,
      swapSlot: false,
      pickupOrPair,
      // No touch affordance yet for choosing which of a dual pair's guns to swap (same gap as
      // desktop's Shift modifier) — always swaps the first. Tracked in the Phase 10 doc.
      replaceSlotChoice: 0,
    };
  }

  destroy() {
    this.moveJoystick.destroy();
    this.aimJoystick.destroy();
    this.meleeButton.destroy();
    this.grenadeButton.destroy();
    this.switchGrenadeButton.destroy();
    this.reloadButton.destroy();
    this.pickupButton.destroy();
  }
}
