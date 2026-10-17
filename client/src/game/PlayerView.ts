import Phaser from 'phaser';
import { WEAPONS, type Facing, type WeaponId } from '@game/shared';
import { drawWeaponSilhouette } from './WeaponSilhouette';

const WIDTH = 24;
const HEIGHT = 48;
const HEALTH_BAR_WIDTH = 32;
const HEALTH_BAR_HEIGHT = 4;
const MAX_HEALTH = 100;
const MELEE_SWING_MS = 180;
const DEATH_ANIM_MS = 300;
const WALK_SPEED_THRESHOLD = 10;

/**
 * Original doodle-style rig (Phase 15), replacing the Phase-07 placeholder
 * rectangle. Drawn with a single redrawn `Graphics` body each frame (head,
 * torso, legs, crouch-shield wedge) — cheap for simple shapes at 8 players —
 * plus a separate `weaponGraphics` object that's only redrawn when the held
 * gun actually changes, since its own local-space art doesn't change frame
 * to frame, only its position/rotation does. The overall silhouette still
 * fits the same WIDTH x HEIGHT envelope as the old rectangle, so it reads at
 * the same size as the real (server-side) hitbox always has.
 */
export class PlayerView {
  private scene: Phaser.Scene;
  private color: number;
  private body: Phaser.GameObjects.Graphics;
  private weaponGraphics: Phaser.GameObjects.Graphics;
  private currentWeapon: WeaponId | null = null;
  private nameTag: Phaser.GameObjects.Text;
  private healthBarBg: Phaser.GameObjects.Rectangle;
  private healthBarFill: Phaser.GameObjects.Rectangle;

  private walkPhase = 0;
  private meleeSwingUntil = 0;
  private wasAlive = true;
  private deathUntil = 0;
  private deathX = 0;
  private deathY = 0;

  constructor(scene: Phaser.Scene, colorHex: string, name: string) {
    this.scene = scene;
    this.color = Phaser.Display.Color.HexStringToColor(colorHex).color;

    this.body = scene.add.graphics();
    this.weaponGraphics = scene.add.graphics();
    this.nameTag = scene.add
      .text(0, 0, name, { fontFamily: 'sans-serif', fontSize: '12px', color: colorHex })
      .setOrigin(0.5, 1);
    this.healthBarBg = scene.add
      .rectangle(0, 0, HEALTH_BAR_WIDTH, HEALTH_BAR_HEIGHT, 0x000000, 0.6)
      .setOrigin(0.5, 0.5);
    this.healthBarFill = scene.add
      .rectangle(0, 0, HEALTH_BAR_WIDTH, HEALTH_BAR_HEIGHT, 0x3cb44b)
      .setOrigin(0, 0.5);
  }

  /** Triggers a short forward arm swing — called from `MatchScene`'s 'melee' room message. */
  playMeleeSwing() {
    this.meleeSwingUntil = this.scene.time.now + MELEE_SWING_MS;
  }

  /**
   * One resolved, ready-to-draw snapshot — no interpolation math here. The
   * offline sandbox lerps its own prev/curr physics states before calling
   * this; networked play reads an already-smoothed value from `Predict`.
   */
  render(
    x: number,
    y: number,
    facing: Facing,
    crouching: boolean,
    aimAngle: number,
    alive = true,
    health = MAX_HEALTH,
    shieldSecondsRemaining = 0,
    onGround = true,
    vx = 0,
    weaponId: WeaponId | null = null,
  ) {
    const now = this.scene.time.now;

    if (this.wasAlive && !alive) {
      this.deathX = x;
      this.deathY = y;
      this.deathUntil = now + DEATH_ANIM_MS;
    }
    this.wasAlive = alive;

    const showingDeathBurst = !alive && now < this.deathUntil;
    this.nameTag.setVisible(alive);
    this.healthBarBg.setVisible(alive);
    this.healthBarFill.setVisible(alive);
    this.weaponGraphics.setVisible(alive);

    this.body.clear();
    if (!alive) {
      if (showingDeathBurst) this.drawDeathBurst(now);
      return;
    }

    const displayHeight = crouching ? HEIGHT * 0.6 : HEIGHT;
    const walking = onGround && Math.abs(vx) > WALK_SPEED_THRESHOLD;
    const flying = !onGround;
    if (walking) this.walkPhase += 0.25;

    this.drawRig(x, y, displayHeight, crouching, flying, walking, facing, shieldSecondsRemaining > 0);
    this.updateWeapon(x, y, aimAngle, now, weaponId);

    this.nameTag.setPosition(x, y - HEIGHT / 2 - 14);

    const healthBarY = y - HEIGHT / 2 - 6;
    this.healthBarBg.setPosition(x, healthBarY);
    this.healthBarFill.setPosition(x - HEALTH_BAR_WIDTH / 2, healthBarY);
    const ratio = Math.max(0, Math.min(1, health / MAX_HEALTH));
    this.healthBarFill.setSize(HEALTH_BAR_WIDTH * ratio, HEALTH_BAR_HEIGHT);
    this.healthBarFill.setFillStyle(ratio > 0.5 ? 0x3cb44b : ratio > 0.25 ? 0xf58231 : 0xe6194b);
  }

  private drawRig(
    x: number,
    y: number,
    displayHeight: number,
    crouching: boolean,
    flying: boolean,
    walking: boolean,
    facing: Facing,
    spawnShielded: boolean,
  ) {
    const g = this.body;
    const top = y - displayHeight / 2;
    const headR = 6;
    const headY = top + headR;
    const torsoTop = headY + headR - 2;
    const torsoBottom = y + displayHeight / 2 - 6;
    const torsoW = WIDTH * 0.6;

    // Jetpack flame while airborne — drawn first so the rig sits on top of it.
    if (flying) {
      g.fillStyle(0xffaa33, 0.85);
      g.fillTriangle(x - 4, torsoBottom + 2, x + 4, torsoBottom + 2, x, torsoBottom + 10);
    }

    // Legs: scissor while walking, tucked while flying, bent while crouching.
    g.lineStyle(4, this.color, 1);
    const legLen = crouching ? 6 : flying ? 4 : 10;
    const swing = walking ? Math.sin(this.walkPhase) * 6 : 0;
    g.lineBetween(x - 3, torsoBottom, x - 3 + swing, torsoBottom + legLen);
    g.lineBetween(x + 3, torsoBottom, x + 3 - swing, torsoBottom + legLen);

    // Torso.
    g.fillStyle(this.color, 1);
    g.fillRoundedRect(x - torsoW / 2, torsoTop, torsoW, torsoBottom - torsoTop, 4);

    // Head.
    g.fillCircle(x, headY, headR);

    // Crouch shield — a translucent wedge on the facing side; the mechanic only
    // ever blocks front hits while crouching, so it's shown whenever crouching
    // is true rather than tied to any timer (unlike the spawn shield below).
    if (crouching) {
      const shieldDir = facing === 'right' ? 1 : -1;
      g.fillStyle(0xffd700, 0.35);
      g.fillTriangle(
        x + shieldDir * (torsoW / 2),
        torsoTop,
        x + shieldDir * (torsoW / 2 + 10),
        (torsoTop + torsoBottom) / 2,
        x + shieldDir * (torsoW / 2),
        torsoBottom,
      );
    }

    // Spawn shield — a gold ring around the whole body for its 3-second duration.
    if (spawnShielded) {
      g.lineStyle(2, 0xffd700, 0.9);
      g.strokeCircle(x, (torsoTop + torsoBottom) / 2, Math.max(torsoW, torsoBottom - torsoTop) / 2 + 5);
    }
  }

  private updateWeapon(x: number, y: number, aimAngle: number, now: number, weaponId: WeaponId | null) {
    if (weaponId !== this.currentWeapon) {
      this.currentWeapon = weaponId;
      if (weaponId) drawWeaponSilhouette(this.weaponGraphics, weaponId, WEAPONS[weaponId].group);
      else this.weaponGraphics.clear();
    }
    if (!weaponId) return;

    const swinging = now < this.meleeSwingUntil;
    const handDistance = 10 + (swinging ? 6 : 0);
    const handX = x + Math.cos(aimAngle) * handDistance;
    const handY = y + Math.sin(aimAngle) * handDistance;
    this.weaponGraphics.setPosition(handX, handY).setRotation(aimAngle);
  }

  private drawDeathBurst(now: number) {
    const progress = 1 - Math.max(0, this.deathUntil - now) / DEATH_ANIM_MS;
    const radius = 4 + progress * 14;
    this.body.fillStyle(this.color, Math.max(0, 1 - progress));
    this.body.fillCircle(this.deathX, this.deathY, radius);
  }

  destroy() {
    this.body.destroy();
    this.weaponGraphics.destroy();
    this.nameTag.destroy();
    this.healthBarBg.destroy();
    this.healthBarFill.destroy();
  }
}
