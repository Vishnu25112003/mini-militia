import type { GrenadeId } from '../types';

// Grenade stats. Source of truth: Game Flow, Section 7 "Grenade stats".

/** Radius words from the flow in pixels. PLACEHOLDER — tune during build (Phase 09 / 16). */
export const RADIUS_PX = { small: 80, medium: 128 } as const;

export interface GrenadeConfig {
  id: GrenadeId;
  name: string;
  effect: 'explosion' | 'poison_cloud' | 'mine';
  /**
   * Explosions: damage at the centre. Gas: damage per second.
   * (Explosion damage is lower toward the edge — see `edgeDamageFactor`.)
   */
  damage: number;
  /** Same, for a crouching player hit on the front. */
  crouchDamage: number;
  radiusPx: number;
  /** Seconds from throw to explosion (frag), 0 otherwise. */
  fuseSec: number;
  /** Gas: how long the cloud lasts. */
  durationSec: number;
  /** Proxy: seconds after landing before it arms. */
  armSec: number;
  trigger: 'fuse' | 'on_landing' | 'proximity';
}

export const GRENADES: Record<GrenadeId, GrenadeConfig> = {
  frag: {
    id: 'frag',
    name: 'Fragnade',
    effect: 'explosion',
    damage: 90,
    crouchDamage: 72,
    radiusPx: RADIUS_PX.medium,
    fuseSec: 3,
    durationSec: 0,
    armSec: 0,
    trigger: 'fuse',
  },
  gas: {
    id: 'gas',
    name: 'Gasnade',
    effect: 'poison_cloud',
    damage: 8,
    crouchDamage: 6,
    radiusPx: RADIUS_PX.medium,
    fuseSec: 0,
    durationSec: 5,
    armSec: 0,
    trigger: 'on_landing',
  },
  proxy: {
    id: 'proxy',
    name: 'Proxynade',
    effect: 'mine',
    damage: 90,
    crouchDamage: 72,
    radiusPx: RADIUS_PX.small,
    fuseSec: 0,
    durationSec: 0,
    armSec: 1,
    trigger: 'proximity',
  },
};

/**
 * "90 at center, less toward the edge": explosion damage falls off linearly from 100% at the centre to
 * this fraction at the blast radius. PLACEHOLDER — the flow gives no number; Dev4 to confirm in Phase 09.
 */
export const EDGE_DAMAGE_FACTOR = 0.4;
