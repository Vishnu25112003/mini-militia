import {
  MATCH_RULES,
  WEAPONS,
  type LoadoutSlotSelection,
  type PlayerState,
  type Slot,
  type Vector2,
} from '@game/shared';

function loadoutSlotToSlot(selection: LoadoutSlotSelection): Slot {
  if (selection.kind === 'single') {
    const weapon = WEAPONS[selection.weapon];
    return {
      kind: 'single',
      weapon: weapon.id,
      ammoInMagazine: weapon.magazine,
      ammoReserve: weapon.reserve ?? 0,
      cooldownRemainingSeconds: 0,
      reloadRemainingSeconds: 0,
    };
  }

  const [a, b] = selection.weapons;
  const weaponA = WEAPONS[a];
  const weaponB = WEAPONS[b];
  return {
    kind: 'dual',
    weapons: [weaponA.id, weaponB.id],
    ammoInMagazine: [weaponA.magazine, weaponB.magazine],
    ammoReserve: [weaponA.reserve ?? 0, weaponB.reserve ?? 0],
    cooldownRemainingSeconds: 0,
    reloadRemainingSeconds: 0,
  };
}

/**
 * Server-authoritative starting state for a newly joined/spawned player.
 * `loadout` is the two spawn slots — either 2 random single guns, or the
 * host's chosen Default Loadout (see `server/src/hostSettings.ts`).
 */
export function createServerPlayer(
  spawn: Vector2,
  name: string,
  color: string,
  loadout: readonly [LoadoutSlotSelection, LoadoutSlotSelection],
): PlayerState {
  return {
    ...baseSpawnState(spawn, name, color, loadout),
    kills: 0,
    deaths: 0,
    points: 0,
  };
}

/** Same fresh spawn state as `createServerPlayer`, but keeps the player's running kills/deaths/points across a respawn. */
export function respawnServerPlayer(
  previous: PlayerState,
  spawn: Vector2,
  loadout: readonly [LoadoutSlotSelection, LoadoutSlotSelection],
): PlayerState {
  return {
    ...baseSpawnState(spawn, previous.name, previous.color, loadout),
    kills: previous.kills,
    deaths: previous.deaths,
    points: previous.points,
  };
}

function baseSpawnState(
  spawn: Vector2,
  name: string,
  color: string,
  loadout: readonly [LoadoutSlotSelection, LoadoutSlotSelection],
): Omit<PlayerState, 'kills' | 'deaths' | 'points'> {
  return {
    id: name,
    name,
    color: color as PlayerState['color'],
    position: { ...spawn },
    velocity: { x: 0, y: 0 },
    facing: 'right',
    health: MATCH_RULES.maxHealth,
    fuel: 100,
    crouching: false,
    onGround: false,
    slots: [loadoutSlotToSlot(loadout[0]), loadoutSlotToSlot(loadout[1])],
    activeSlotIndex: 0,
    grenades: {
      Fragnade: MATCH_RULES.spawnFragnades,
      Gasnade: MATCH_RULES.spawnGasnades,
      Proxynade: 0,
    },
    selectedGrenade: 'Fragnade',
    grenadeThrowCooldownRemainingSeconds: 0,
    meleeCooldownRemainingSeconds: 0,
    gotKillThisLife: false,
    shieldSecondsRemaining: MATCH_RULES.spawnShieldSeconds,
    alive: true,
    respawnRemainingSeconds: 0,
  };
}
