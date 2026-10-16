import type { WeaponId } from './weapons.js';

/** Config for the two projectile weapons — SMAW (rocket) and RG6 (grenade launcher). Both explode on first impact, no bounce/fuse (Dev4-confirmed). */
export interface ProjectileConfig {
  /** Travel speed in px/sec — straight line, no arc (an arc trajectory is a later-phase refinement). */
  speedPxPerSec: number;
  /** Splash radius in px — "medium" per Dev4: SMAW ~3 tiles, RG6 ~2 tiles (32px tiles). */
  splashRadiusPx: number;
}

export const PROJECTILE_WEAPONS: Partial<Record<WeaponId, ProjectileConfig>> = {
  SMAW: { speedPxPerSec: 900, splashRadiusPx: 96 },
  RG6: { speedPxPerSec: 700, splashRadiusPx: 64 },
};
