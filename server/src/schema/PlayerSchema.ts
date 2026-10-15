import { schema, t } from '@colyseus/schema';

/**
 * Broadcast state for one player — flat (required for `predict.reconciler`'s
 * rollback, which mirrors scalar schema fields). Movement-only for now;
 * combat/inventory fields arrive in later phases.
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
  },
  'PlayerSchema',
);

export type PlayerSchema = InstanceType<typeof PlayerSchema>;
