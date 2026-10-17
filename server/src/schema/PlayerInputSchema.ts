import { schema, t } from '@colyseus/schema';

/**
 * The wire shape of one client input tick — a flat schema (required by
 * `Room.defineInput`). Mirrors `@game/shared`'s `PlayerInput` minus
 * `sequence`: sent over a RELIABLE channel, which already guarantees
 * in-order, exactly-once delivery, so there's no need for an app-level
 * sequence field for dedup (that's for unreliable channels). The
 * Reconciler's own ack tracking (`input.lastProcessed`/`sentCount`) uses the
 * input handle's internal wire sequence regardless of this schema.
 */
export const PlayerInputSchema = schema(
  {
    moveX: t.int8().default(0),
    fly: t.boolean().default(false),
    crouch: t.boolean().default(false),
    aimAngle: t.angle(),
    fire: t.boolean().default(false),
    melee: t.boolean().default(false),
    throwGrenade: t.boolean().default(false),
    switchGrenade: t.boolean().default(false),
    reload: t.boolean().default(false),
    swapSlot: t.boolean().default(false),
    pickupOrPair: t.boolean().default(false),
  },
  'PlayerInputSchema',
);

export type PlayerInputSchema = InstanceType<typeof PlayerInputSchema>;
