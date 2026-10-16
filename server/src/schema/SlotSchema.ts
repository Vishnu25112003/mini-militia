import { schema, t } from '@colyseus/schema';

/**
 * Broadcast state for one gun slot. `kind: 'single'` only uses `weapon1`/
 * `ammoInMagazine1`/`ammoReserve1`; `kind: 'dual'` uses both guns' fields.
 */
export const SlotSchema = schema(
  {
    kind: t.string().default('single'),
    weapon1: t.string().default(''),
    weapon2: t.string().default(''),
    ammoInMagazine1: t.number().default(0),
    ammoInMagazine2: t.number().default(0),
    ammoReserve1: t.number().default(0),
    ammoReserve2: t.number().default(0),
    cooldownRemainingSeconds: t.number().default(0),
    reloadRemainingSeconds: t.number().default(0),
  },
  'SlotSchema',
);

export type SlotSchema = InstanceType<typeof SlotSchema>;
