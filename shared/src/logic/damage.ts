import type { Facing, PlayerState } from '../types/player.js';

export type HitDirection = 'front' | 'back';

export interface DamageParams {
  /** Normal (back-side, or non-crouching) damage. */
  amount: number;
  /**
   * The front-crouch-shielded damage, straight from config (weapons.ts
   * crouchDamage/crouchDirectHitDamage/crouchSplashDamage, or grenades.ts
   * crouchDamage — every one of them is already a literal number from the
   * flow's own tables, not always an exact ×0.8 of `amount`, e.g. Gasnade is
   * 8/sec normally but a flat 6/sec crouching). Omit only for a source with
   * no published crouch value at all.
   */
  crouchAmount?: number;
  hitDirection: HitDirection;
}

/**
 * The shield a crouching player gets only protects their front side, and
 * only from bullets, explosions, gas, and flame — never melee (see
 * logic/melee.ts, which always kills regardless of this function).
 */
export function applyDamage(target: PlayerState, params: DamageParams): PlayerState {
  const isShieldedHit = target.crouching && params.hitDirection === 'front';
  const effectiveAmount = isShieldedHit ? (params.crouchAmount ?? params.amount) : params.amount;

  const health = Math.max(0, target.health - effectiveAmount);
  return { ...target, health, alive: health > 0 };
}

/**
 * The crouch shield faces the direction the player is facing — a hit is
 * "front" when it arrives from that same side.
 */
export function isFrontHit(targetFacing: Facing, attackerX: number, targetX: number): HitDirection {
  if (targetFacing === 'right') {
    return attackerX >= targetX ? 'front' : 'back';
  }
  return attackerX <= targetX ? 'front' : 'back';
}
