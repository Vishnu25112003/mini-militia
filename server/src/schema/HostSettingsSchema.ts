import { schema, t } from '@colyseus/schema';
import { HOST_SETTING_RANGES, DEFAULT_LOADOUT_ENABLED_DEFAULT } from '@game/shared';

/**
 * One of the Default Loadout's two slots. `kind: 'single'` only uses
 * `weapon1`; `kind: 'dual'` uses both (one of the 6 published dual pairs).
 */
export const LoadoutSlotSchema = schema(
  {
    kind: t.string().default('single'),
    weapon1: t.string().default(''),
    weapon2: t.string().default(''),
  },
  'LoadoutSlotSchema',
);

export type LoadoutSlotSchema = InstanceType<typeof LoadoutSlotSchema>;

/** Mirrors `@game/shared`'s `HostSettings` — the room's current, live match settings. */
export const HostSettingsSchema = schema(
  {
    playerCount: t.number().default(HOST_SETTING_RANGES.playerCount.default),
    gameTimeSeconds: t.number().default(HOST_SETTING_RANGES.gameTimeSeconds.default),
    mapDropsCountdownSeconds: t.number().default(HOST_SETTING_RANGES.mapDropsCountdownSeconds.default),
    gravity: t.number().default(HOST_SETTING_RANGES.gravity.default),
    boost: t.number().default(HOST_SETTING_RANGES.boost.default),
    defaultLoadoutEnabled: t.boolean().default(DEFAULT_LOADOUT_ENABLED_DEFAULT),
    defaultLoadoutSlot1: LoadoutSlotSchema,
    defaultLoadoutSlot2: LoadoutSlotSchema,
  },
  'HostSettingsSchema',
);

export type HostSettingsSchema = InstanceType<typeof HostSettingsSchema>;
