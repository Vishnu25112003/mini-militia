import Phaser from 'phaser';
import type { InputSource, RawInput } from './InputSource';
import { VirtualJoystick } from './VirtualJoystick';
import { TouchButton } from './TouchButton';
import { loadTouchLayout } from './touchLayout';
import { registerControl, unregisterControl } from './touchControlRegistry';

const DEADZONE = 0.35;

/** Touch default layout, from the flow's control table — positions/scale are overridden by any saved layout (Phase 13). */
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
    const layout = loadTouchLayout(width, height);

    this.moveJoystick = new VirtualJoystick(scene, layout.moveJoystick.x, layout.moveJoystick.y, 55);
    this.moveJoystick.setLayout(layout.moveJoystick);
    this.grenadeButton = new TouchButton(scene, layout.grenadeButton.x, layout.grenadeButton.y, 'nade');
    this.grenadeButton.setLayout(layout.grenadeButton);
    this.switchGrenadeButton = new TouchButton(
      scene,
      layout.switchGrenadeButton.x,
      layout.switchGrenadeButton.y,
      'switch',
      22,
    );
    this.switchGrenadeButton.setLayout(layout.switchGrenadeButton);
    this.aimJoystick = new VirtualJoystick(scene, layout.aimJoystick.x, layout.aimJoystick.y, 55);
    this.aimJoystick.setLayout(layout.aimJoystick);
    this.meleeButton = new TouchButton(scene, layout.meleeButton.x, layout.meleeButton.y, 'melee');
    this.meleeButton.setLayout(layout.meleeButton);
    this.reloadButton = new TouchButton(scene, layout.reloadButton.x, layout.reloadButton.y, 'reload');
    this.reloadButton.setLayout(layout.reloadButton);
    this.pickupButton = new TouchButton(scene, layout.pickupButton.x, layout.pickupButton.y, 'pickup');
    this.pickupButton.setLayout(layout.pickupButton);

    registerControl('moveJoystick', this.moveJoystick, width, height);
    registerControl('aimJoystick', this.aimJoystick, width, height);
    registerControl('grenadeButton', this.grenadeButton, width, height);
    registerControl('switchGrenadeButton', this.switchGrenadeButton, width, height);
    registerControl('meleeButton', this.meleeButton, width, height);
    registerControl('reloadButton', this.reloadButton, width, height);
    registerControl('pickupButton', this.pickupButton, width, height);
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

  /** Touch has no keyboard — chat is opened by tapping the separate chat button MatchScene owns. */
  consumeChatToggle(): boolean {
    return false;
  }

  destroy() {
    this.moveJoystick.destroy();
    this.aimJoystick.destroy();
    this.meleeButton.destroy();
    this.grenadeButton.destroy();
    this.switchGrenadeButton.destroy();
    this.reloadButton.destroy();
    this.pickupButton.destroy();

    unregisterControl('moveJoystick');
    unregisterControl('aimJoystick');
    unregisterControl('grenadeButton');
    unregisterControl('switchGrenadeButton');
    unregisterControl('meleeButton');
    unregisterControl('reloadButton');
    unregisterControl('pickupButton');
  }
}
