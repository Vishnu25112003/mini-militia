import { schema, t } from '@colyseus/schema';

/**
 * Anything sitting on the map that can be picked up — a fixed pickup-spot
 * item or a dropped/scattered one. `kind` is `'gun' | 'medkit' | 'grenadePair' | 'boostTank'`.
 */
export const GroundItemSchema = schema(
  {
    kind: t.string().default(''),
    x: t.number().default(0),
    y: t.number().default(0),
    /** Set when kind === 'gun'. */
    weapon: t.string().default(''),
    /** Set when kind === 'grenadePair'. */
    grenadeType: t.string().default(''),
    grenadeCount: t.number().default(0),
  },
  'GroundItemSchema',
);

export type GroundItemSchema = InstanceType<typeof GroundItemSchema>;
