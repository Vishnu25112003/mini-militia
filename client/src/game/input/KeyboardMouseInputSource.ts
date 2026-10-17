import Phaser from 'phaser';
import type { Vector2 } from '@game/shared';
import type { InputSource, RawInput } from './InputSource';
import { getKeyBindings, onKeyBindingsChanged, type ActionId, type KeyBindings } from './keyBindings';

/** PC default key mapping, from the flow's control table — rebindable per Phase 13 (`keyBindings.ts`). */
export class KeyboardMouseInputSource implements InputSource {
  private scene: Phaser.Scene;
  private getPlayerWorldPosition: () => Vector2;
  private keys: Record<ActionId, Phaser.Input.Keyboard.Key> = {} as Record<ActionId, Phaser.Input.Keyboard.Key>;
  private pickupChoiceModifier: Phaser.Input.Keyboard.Key;
  private chatKey!: Phaser.Input.Keyboard.Key;
  private chatRequested = false;
  private unsubscribeBindings: () => void;

  constructor(scene: Phaser.Scene, getPlayerWorldPosition: () => Vector2) {
    this.scene = scene;
    this.getPlayerWorldPosition = getPlayerWorldPosition;
    this.pickupChoiceModifier = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);

    this.rebuildKeys(getKeyBindings());
    this.unsubscribeBindings = onKeyBindingsChanged((bindings) => this.rebuildKeys(bindings));
  }

  private rebuildKeys(bindings: KeyBindings) {
    const kb = this.scene.input.keyboard!;
    for (const key of Object.values(this.keys)) kb.removeKey(key, true);

    this.keys = {
      moveLeft: kb.addKey(bindings.moveLeft),
      moveRight: kb.addKey(bindings.moveRight),
      fly: kb.addKey(bindings.fly),
      crouch: kb.addKey(bindings.crouch),
      melee: kb.addKey(bindings.melee),
      throwGrenade: kb.addKey(bindings.throwGrenade),
      switchGrenade: kb.addKey(bindings.switchGrenade),
      swapSlot: kb.addKey(bindings.swapSlot),
      reload: kb.addKey(bindings.reload),
      pickupOrPair: kb.addKey(bindings.pickupOrPair),
      chat: kb.addKey(bindings.chat),
    };
    // Chat is edge-detected separately (consumeChatToggle), on its own rebindable key.
    this.chatKey = this.keys.chat;
  }

  sample(): RawInput {
    const k = this.keys;
    const moveX: RawInput['moveX'] =
      k.moveLeft.isDown && !k.moveRight.isDown ? -1 : k.moveRight.isDown && !k.moveLeft.isDown ? 1 : 0;
    const fly = k.fly.isDown;
    const crouch = k.crouch.isDown;

    const pointer = this.scene.input.activePointer;
    const playerPos = this.getPlayerWorldPosition();
    const aimAngle = Phaser.Math.Angle.Between(
      playerPos.x,
      playerPos.y,
      pointer.worldX,
      pointer.worldY,
    );
    const fire = pointer.leftButtonDown();

    const melee = Phaser.Input.Keyboard.JustDown(k.melee);
    const throwGrenade = Phaser.Input.Keyboard.JustDown(k.throwGrenade);
    const switchGrenade = Phaser.Input.Keyboard.JustDown(k.switchGrenade);
    const reload = Phaser.Input.Keyboard.JustDown(k.reload);
    const swapSlot = Phaser.Input.Keyboard.JustDown(k.swapSlot);
    const pickupOrPair = Phaser.Input.Keyboard.JustDown(k.pickupOrPair);
    if (Phaser.Input.Keyboard.JustDown(this.chatKey)) this.chatRequested = true;

    // Holding Shift while picking up a dual-capable gun chooses the pair's 2nd gun to swap
    // instead of the 1st — a minimal affordance for the ambiguous "chooseReplace" case until
    // there's a real 2-button picker UI (Phase 10 tracks that gap).
    const replaceSlotChoice: RawInput['replaceSlotChoice'] = this.pickupChoiceModifier.isDown ? 1 : 0;

    return {
      moveX,
      fly,
      crouch,
      aimAngle,
      fire,
      melee,
      throwGrenade,
      switchGrenade,
      reload,
      swapSlot,
      pickupOrPair,
      replaceSlotChoice,
    };
  }

  consumeChatToggle(): boolean {
    const requested = this.chatRequested;
    this.chatRequested = false;
    return requested;
  }

  destroy() {
    this.unsubscribeBindings();
    if (this.scene.input.keyboard) {
      for (const key of Object.values(this.keys)) this.scene.input.keyboard.removeKey(key, true);
      this.scene.input.keyboard.removeKey(this.pickupChoiceModifier, true);
    }
  }
}
