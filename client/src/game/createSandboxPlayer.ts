import { MATCH_RULES, WEAPONS, type PlayerState, type Vector2 } from '@game/shared';

/**
 * A representative starting loadout for the movement sandbox. Real spawn
 * rules (random guns, host loadout settings, etc.) are Phase 06/10's job —
 * this is just enough state for physics and rendering to work with.
 */
export function createSandboxPlayer(spawn: Vector2): PlayerState {
  const ak47 = WEAPONS.AK47;
  const m14 = WEAPONS.M14;

  return {
    id: 'sandbox-player',
    name: 'You',
    color: '#4363d8',
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
        cooldownRemainingSeconds: 0,
        reloadRemainingSeconds: 0,
      },
      {
        kind: 'single',
        weapon: m14.id,
        ammoInMagazine: m14.magazine,
        ammoReserve: m14.reserve ?? 0,
        cooldownRemainingSeconds: 0,
        reloadRemainingSeconds: 0,
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
