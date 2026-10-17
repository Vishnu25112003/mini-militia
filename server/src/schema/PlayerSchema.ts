import { schema, t } from '@colyseus/schema';
import { SlotSchema } from './SlotSchema.js';

/**
 * Broadcast state for one player — the movement fields are flat (required
 * for `predict.reconciler`'s rollback, which mirrors scalar schema fields).
 * Combat/inventory fields (Phase 07) are synced for HUD/rendering but never
 * predicted client-side — the server is the sole authority on combat.
 */
export const PlayerSchema = schema(
  {
    x: t.number().default(0),
    y: t.number().default(0),
    vx: t.number().default(0),
    vy: t.number().default(0),
    facing: t.string().default('right'),
    /** For the aim-line visual on every player, not just the locally controlled one. */
    aimAngle: t.angle(),
    crouching: t.boolean().default(false),
    onGround: t.boolean().default(false),
    fuel: t.number().default(100),
    color: t.string().default('#4363d8'),
    name: t.string().default('Player'),
    /** Lobby-only: has this player pressed Start? Unused once the match is playing. */
    ready: t.boolean().default(false),
    /** False while this seat is held open for a disconnected player to reconnect — their character disappears from the map. */
    connected: t.boolean().default(true),

    health: t.number().default(100),
    alive: t.boolean().default(true),
    /** Seconds of spawn shield remaining; 0 once it's expired. */
    shieldSecondsRemaining: t.number().default(0),
    /** Seconds left in the 5s respawn wait; 0 while alive. */
    respawnRemainingSeconds: t.number().default(0),
    activeSlotIndex: t.number().default(0),
    slot1: SlotSchema,
    slot2: SlotSchema,
    kills: t.number().default(0),
    deaths: t.number().default(0),
    points: t.number().default(0),

    fragnades: t.number().default(0),
    gasnades: t.number().default(0),
    proxynades: t.number().default(0),
    selectedGrenade: t.string().default('Fragnade'),

    /** The nearest ground gun's item id within pickup range, or '' — drives the client's button. */
    nearbyGunItemId: t.string().default(''),
    /** 'pair' | 'replace' | 'chooseReplace' | 'none' | '' (nothing nearby) — see `@game/shared`'s `GunPickupAction`. */
    nearbyGunAction: t.string().default(''),
  },
  'PlayerSchema',
);

export type PlayerSchema = InstanceType<typeof PlayerSchema>;
