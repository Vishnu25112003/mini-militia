export type GrenadeId = 'Fragnade' | 'Gasnade' | 'Proxynade';

export type GrenadeRadius = 'small' | 'medium';

export type GrenadeTrigger =
  | { kind: 'fuse'; fuseSeconds: number }
  | { kind: 'on-landing' }
  | { kind: 'arm-and-proximity'; armSeconds: number };

export interface GrenadeStats {
  id: GrenadeId;
  name: string;
  /** Damage at the center of the effect (or per second, for Gasnade). */
  damage: number;
  /** Damage to a crouching player hit on the front side. */
  crouchDamage: number;
  radius: GrenadeRadius;
  trigger: GrenadeTrigger;
  /** Seconds the effect lasts, for damage-over-time grenades (Gasnade). */
  durationSeconds?: number;
  /** Only available from map pickups, never at spawn. */
  mapPickupOnly: boolean;
}

export const GRENADES: Record<GrenadeId, GrenadeStats> = {
  Fragnade: {
    id: 'Fragnade',
    name: 'Fragnade',
    damage: 90,
    crouchDamage: 72,
    radius: 'medium',
    trigger: { kind: 'fuse', fuseSeconds: 3 },
    mapPickupOnly: false,
  },
  Gasnade: {
    id: 'Gasnade',
    name: 'Gasnade',
    damage: 8,
    crouchDamage: 6,
    radius: 'medium',
    trigger: { kind: 'on-landing' },
    durationSeconds: 5,
    mapPickupOnly: false,
  },
  Proxynade: {
    id: 'Proxynade',
    name: 'Proxynade',
    damage: 90,
    crouchDamage: 72,
    radius: 'small',
    trigger: { kind: 'arm-and-proximity', armSeconds: 1 },
    mapPickupOnly: true,
  },
};

export const GRENADE_IDS = Object.keys(GRENADES) as GrenadeId[];
