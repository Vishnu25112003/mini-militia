import { MATCH_RULES, WEAPONS, type PlayerState, type Vector2 } from '@game/shared';

/**
 * Server-authoritative starting state for a newly joined/spawned player.
 * Same placeholder loadout as the Phase 03 sandbox — real spawn rules
 * (random guns, host loadout settings) are Phase 06/10's job.
 */
export function createServerPlayer(spawn: Vector2, name: string, color: string): PlayerState {
  const ak47 = WEAPONS.AK47;
  const m14 = WEAPONS.M14;

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
    slots: [
      {
        kind: 'single',
        weapon: ak47.id,
        ammoInMagazine: ak47.magazine,
        ammoReserve: ak47.reserve ?? 0,
      },
      {
        kind: 'single',
        weapon: m14.id,
        ammoInMagazine: m14.magazine,
        ammoReserve: m14.reserve ?? 0,
      },
    ],
    activeSlotIndex: 0,
    grenades: {
      Fragnade: MATCH_RULES.spawnFragnades,
      Gasnade: MATCH_RULES.spawnGasnades,
      Proxynade: 0,
    },
    kills: 0,
    deaths: 0,
    points: 0,
    gotKillThisLife: false,
    shieldSecondsRemaining: MATCH_RULES.spawnShieldSeconds,
    alive: true,
  };
}
