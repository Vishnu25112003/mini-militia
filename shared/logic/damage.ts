import { EDGE_DAMAGE_FACTOR } from '../config/grenades';
import { MATCH_RULES } from '../config/matchRules';

// Damage rules. Source of truth: Game Flow, Sections 8 (Crouch Shield) and 9 (Melee).

export type DamageKind = 'bullet' | 'explosion' | 'gas' | 'flame' | 'melee';

export interface DamageSource {
  kind: DamageKind;
  /**
   * Damage to use when the target crouches and is hit on the FRONT (bullets: the gun's crouch value; SMAW
   * direct hit: 70; gas / flame ticks: the values from the flow's table). When omitted, explosions use
   * `amount x explosionCrouchMultiplier` (0.8).
   */
  crouchAmount?: number;
  /**
   * Horizontal direction the damage travels, as a signed number: positive = toward +x (it came from the
   * left), negative = toward -x. For explosions use `target.x - explosion.x`.
   */
  directionX: number;
}

export interface DamageTarget {
  health: number;
  alive: boolean;
  crouching: boolean;
  facing: 1 | -1;
}

export interface DamageResult {
  /** Health after the hit (never below 0). */
  health: number;
  /** Damage actually dealt. */
  dealt: number;
  died: boolean;
  /** The hit landed on the side the target faces. */
  frontHit: boolean;
  /** The crouch shield reduced the damage. */
  shielded: boolean;
}

/**
 * A hit is on the FRONT when the damage travels against the way the target faces
 * (target faces right -> something coming from the right travels toward -x).
 * A hit with no horizontal direction counts as a back hit (full damage).
 */
export function isFrontHit(targetFacing: 1 | -1, directionX: number): boolean {
  return directionX * targetFacing < 0;
}

/** Damage after the crouch shield: bullets use the per-gun value, explosions / gas / flame use x0.8, back = full. */
export function damageAfterCrouch(amount: number, target: DamageTarget, source: DamageSource): number {
  if (source.kind === 'melee') return amount; // melee ignores the crouch shield
  if (!target.crouching || !isFrontHit(target.facing, source.directionX)) return amount;
  if (source.crouchAmount !== undefined) return source.crouchAmount;
  if (source.kind === 'explosion' || source.kind === 'gas' || source.kind === 'flame') {
    return amount * MATCH_RULES.explosionCrouchMultiplier;
  }
  return amount;
}

/**
 * Apply one hit to a target (pure: returns the outcome, changes nothing).
 * Melee always kills, whatever the health or crouch shield. Spawn-shield handling lives with the combat code (Phase 07).
 */
export function applyDamage(target: DamageTarget, amount: number, source: DamageSource): DamageResult {
  const frontHit = isFrontHit(target.facing, source.directionX);
  if (!target.alive) return { health: target.health, dealt: 0, died: false, frontHit, shielded: false };

  if (source.kind === 'melee') {
    return { health: 0, dealt: target.health, died: true, frontHit, shielded: false };
  }

  const dealt = Math.max(0, damageAfterCrouch(amount, target, source));
  const health = Math.max(0, target.health - dealt);
  return { health, dealt, died: health <= 0, frontHit, shielded: dealt < amount };
}

/**
 * Explosion damage at a distance from the centre: full at the centre, falling off linearly to
 * EDGE_DAMAGE_FACTOR of it at the blast radius, zero beyond. (Used by frag and proximity grenades.)
 */
export function explosionDamageAt(centerDamage: number, distance: number, radius: number): number {
  if (distance >= radius) return 0;
  const t = Math.max(0, distance) / radius;
  return centerDamage * (1 - t * (1 - EDGE_DAMAGE_FACTOR));
}
