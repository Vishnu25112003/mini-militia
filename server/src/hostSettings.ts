import {
  HOST_SETTING_RANGES,
  clampToRangeSetting,
  isValidDefaultLoadout,
  WEAPON_IDS,
  type LoadoutSlotSelection,
  type WeaponId,
} from '@game/shared';
import type { HostSettingsSchema, LoadoutSlotSchema } from './schema/HostSettingsSchema.js';

/** Partial update payload a host client can send via the 'updateHostSettings' message. */
export interface HostSettingsUpdate {
  playerCount?: number;
  gameTimeSeconds?: number;
  mapDropsCountdownSeconds?: number;
  gravity?: number;
  boost?: number;
  defaultLoadoutEnabled?: boolean;
  defaultLoadout?: readonly [LoadoutSlotSelection, LoadoutSlotSelection];
}

function writeLoadoutSlot(target: LoadoutSlotSchema, slot: LoadoutSlotSelection) {
  target.kind = slot.kind;
  if (slot.kind === 'single') {
    target.weapon1 = slot.weapon;
    target.weapon2 = '';
  } else {
    target.weapon1 = slot.weapons[0];
    target.weapon2 = slot.weapons[1];
  }
}

export function readLoadoutSlot(source: LoadoutSlotSchema): LoadoutSlotSelection {
  if (source.kind === 'dual') {
    return { kind: 'dual', weapons: [source.weapon1 as WeaponId, source.weapon2 as WeaponId] };
  }
  return { kind: 'single', weapon: source.weapon1 as WeaponId };
}

/**
 * Applies a host's settings update in place, clamping every numeric value to
 * its range/step and ignoring an invalid Default Loadout selection. Caller
 * is responsible for the host-only and lobby-only checks.
 */
export function applyHostSettingsUpdate(
  settings: HostSettingsSchema,
  update: HostSettingsUpdate,
  playersJoined: number,
): void {
  if (update.playerCount !== undefined) {
    const clamped = clampToRangeSetting(update.playerCount, HOST_SETTING_RANGES.playerCount);
    settings.playerCount = Math.max(clamped, playersJoined, HOST_SETTING_RANGES.playerCount.min);
  }
  if (update.gameTimeSeconds !== undefined) {
    settings.gameTimeSeconds = clampToRangeSetting(
      update.gameTimeSeconds,
      HOST_SETTING_RANGES.gameTimeSeconds,
    );
  }
  if (update.mapDropsCountdownSeconds !== undefined) {
    settings.mapDropsCountdownSeconds = clampToRangeSetting(
      update.mapDropsCountdownSeconds,
      HOST_SETTING_RANGES.mapDropsCountdownSeconds,
    );
  }
  if (update.gravity !== undefined) {
    settings.gravity = clampToRangeSetting(update.gravity, HOST_SETTING_RANGES.gravity);
  }
  if (update.boost !== undefined) {
    settings.boost = clampToRangeSetting(update.boost, HOST_SETTING_RANGES.boost);
  }

  if (update.defaultLoadoutEnabled === false) {
    settings.defaultLoadoutEnabled = false;
  } else if (update.defaultLoadoutEnabled === true || update.defaultLoadout !== undefined) {
    const loadout =
      update.defaultLoadout ??
      ([readLoadoutSlot(settings.defaultLoadoutSlot1), readLoadoutSlot(settings.defaultLoadoutSlot2)] as const);
    if (!isValidDefaultLoadout(loadout[0], loadout[1])) return; // ignore an invalid selection, keep prior settings
    writeLoadoutSlot(settings.defaultLoadoutSlot1, loadout[0]);
    writeLoadoutSlot(settings.defaultLoadoutSlot2, loadout[1]);
    if (update.defaultLoadoutEnabled === true) settings.defaultLoadoutEnabled = true;
  }
}

/** 2 random, distinct single guns — the non-Default-Loadout spawn rule per the flow. */
export function randomSpawnLoadout(): readonly [LoadoutSlotSelection, LoadoutSlotSelection] {
  const first = WEAPON_IDS[Math.floor(Math.random() * WEAPON_IDS.length)]!;
  let second = first;
  while (second === first) {
    second = WEAPON_IDS[Math.floor(Math.random() * WEAPON_IDS.length)]!;
  }
  return [
    { kind: 'single', weapon: first },
    { kind: 'single', weapon: second },
  ];
}

/** The loadout to spawn/respawn a player with, per the host's current settings. */
export function spawnLoadoutFor(
  settings: HostSettingsSchema,
): readonly [LoadoutSlotSelection, LoadoutSlotSelection] {
  if (!settings.defaultLoadoutEnabled) return randomSpawnLoadout();
  return [readLoadoutSlot(settings.defaultLoadoutSlot1), readLoadoutSlot(settings.defaultLoadoutSlot2)];
}
