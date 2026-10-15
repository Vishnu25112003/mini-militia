import Phaser from 'phaser';
import { logUnwiredAction, type InputSource, type RawInput } from './InputSource';
import { VirtualJoystick } from './VirtualJoystick';
import { TouchButton } from './TouchButton';

const DEADZONE = 0.35;

/** Touch default layout, from the flow's control table. */
export class TouchInputSource implements InputSource {
  private moveJoystick: VirtualJoystick;
  private aimJoystick: VirtualJoystick;
  private meleeButton: TouchButton;
  private grenadeButton: TouchButton;
  private reloadButton: TouchButton;
  private pickupButton: TouchButton;
  private lastAimAngle = 0;

  constructor(scene: Phaser.Scene) {
    const { width, height } = scene.scale;

    this.moveJoystick = new VirtualJoystick(scene, 90, height - 90, 55);
    this.grenadeButton = new TouchButton(scene, 175, height - 160, 'nade');
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
    const reload = this.reloadButton.consumePress();
    const pickupOrPair = this.pickupButton.consumePress();

    if (melee) logUnwiredAction('melee');
    if (throwGrenade) logUnwiredAction('throw grenade');
    if (reload) logUnwiredAction('reload');
    if (pickupOrPair) logUnwiredAction('pickup/pair');

    return {
      moveX,
      fly,
      crouch,
      aimAngle: this.lastAimAngle,
      fire,
      melee,
      throwGrenade,
      reload,
      swapSlot: false,
      pickupOrPair,
    };
  }

  destroy() {
    this.moveJoystick.destroy();
    this.aimJoystick.destroy();
    this.meleeButton.destroy();
    this.grenadeButton.destroy();
    this.reloadButton.destroy();
    this.pickupButton.destroy();
  }
}
