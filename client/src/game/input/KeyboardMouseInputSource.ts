import Phaser from 'phaser';
import type { Vector2 } from '@game/shared';
import { logUnwiredAction, type InputSource, type RawInput } from './InputSource';

/** PC default key mapping, from the flow's control table. */
export class KeyboardMouseInputSource implements InputSource {
  private scene: Phaser.Scene;
  private getPlayerWorldPosition: () => Vector2;
  private keys: Record<string, Phaser.Input.Keyboard.Key>;

  constructor(scene: Phaser.Scene, getPlayerWorldPosition: () => Vector2) {
    this.scene = scene;
    this.getPlayerWorldPosition = getPlayerWorldPosition;
    const kb = scene.input.keyboard!;
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = {
      left: kb.addKey(K.A),
      right: kb.addKey(K.D),
      flyW: kb.addKey(K.W),
      flySpace: kb.addKey(K.SPACE),
      crouch: kb.addKey(K.S),
      melee: kb.addKey(K.V),
      grenade: kb.addKey(K.G),
      switchGrenade: kb.addKey(K.Q),
      swap1: kb.addKey(K.ONE),
      swap2: kb.addKey(K.TWO),
      reload: kb.addKey(K.R),
      pickup: kb.addKey(K.E),
      chat: kb.addKey(K.ENTER),
    };

    scene.input.on('wheel', () => logUnwiredAction('weapon swap (mouse wheel)'));
  }

  sample(): RawInput {
    const k = this.keys;
    const moveX: RawInput['moveX'] =
      k.left!.isDown && !k.right!.isDown ? -1 : k.right!.isDown && !k.left!.isDown ? 1 : 0;
    const fly = k.flyW!.isDown || k.flySpace!.isDown;
    const crouch = k.crouch!.isDown;

    const pointer = this.scene.input.activePointer;
    const playerPos = this.getPlayerWorldPosition();
    const aimAngle = Phaser.Math.Angle.Between(
      playerPos.x,
      playerPos.y,
      pointer.worldX,
      pointer.worldY,
    );
    const fire = pointer.leftButtonDown();

    const melee = Phaser.Input.Keyboard.JustDown(k.melee!);
    const throwGrenade = Phaser.Input.Keyboard.JustDown(k.grenade!);
    const reload = Phaser.Input.Keyboard.JustDown(k.reload!);
    const swapSlot =
      Phaser.Input.Keyboard.JustDown(k.swap1!) || Phaser.Input.Keyboard.JustDown(k.swap2!);
    const pickupOrPair = Phaser.Input.Keyboard.JustDown(k.pickup!);

    if (melee) logUnwiredAction('melee');
    if (throwGrenade) logUnwiredAction('throw grenade');
    if (reload) logUnwiredAction('reload');
    if (swapSlot) logUnwiredAction('weapon swap');
    if (pickupOrPair) logUnwiredAction('pickup/pair');
    if (Phaser.Input.Keyboard.JustDown(k.switchGrenade!)) logUnwiredAction('switch grenade type');
    if (Phaser.Input.Keyboard.JustDown(k.chat!)) logUnwiredAction('open chat');

    return {
      moveX,
      fly,
      crouch,
      aimAngle,
      fire,
      melee,
      throwGrenade,
      reload,
      swapSlot,
      pickupOrPair,
    };
  }

  destroy() {
    // Keys are owned by the scene's keyboard plugin and are cleaned up with it.
  }
}
