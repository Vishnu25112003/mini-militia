import { describe, expect, it } from 'vitest';
import type { PlayerState } from '../types/player.js';
import {
  canThrowGrenade,
  nextAvailableGrenade,
  switchGrenadeType,
  throwGrenade,
  tickGrenadeThrowCooldown,
} from './grenades.js';

function makePlayer(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    id: 'p1',
    name: 'Tester',
    color: '#e6194b',
    position: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
    facing: 'right',
    health: 100,
    fuel: 100,
    crouching: false,
    onGround: true,
    slots: [
      {
        kind: 'single',
        weapon: 'AK47',
        ammoInMagazine: 30,
        ammoReserve: 90,
        cooldownRemainingSeconds: 0,
        reloadRemainingSeconds: 0,
      },
      {
        kind: 'single',
        weapon: 'M14',
        ammoInMagazine: 15,
        ammoReserve: 45,
        cooldownRemainingSeconds: 0,
        reloadRemainingSeconds: 0,
      },
    ],
    activeSlotIndex: 0,
    grenades: { Fragnade: 2, Gasnade: 2, Proxynade: 0 },
    selectedGrenade: 'Fragnade',
    grenadeThrowCooldownRemainingSeconds: 0,
    meleeCooldownRemainingSeconds: 0,
    kills: 0,
    deaths: 0,
    points: 0,
    gotKillThisLife: false,
    shieldSecondsRemaining: 0,
    alive: true,
    respawnRemainingSeconds: 0,
    ...overrides,
  };
}

describe('nextAvailableGrenade', () => {
  it('cycles to the next non-zero type', () => {
    const grenades = { Fragnade: 2, Gasnade: 2, Proxynade: 0 };
    expect(nextAvailableGrenade(grenades, 'Fragnade')).toBe('Gasnade');
  });

  it('skips a zero-count type', () => {
    const grenades = { Fragnade: 2, Gasnade: 0, Proxynade: 1 };
    expect(nextAvailableGrenade(grenades, 'Fragnade')).toBe('Proxynade');
  });

  it('wraps around to the start', () => {
    const grenades = { Fragnade: 2, Gasnade: 0, Proxynade: 1 };
    expect(nextAvailableGrenade(grenades, 'Proxynade')).toBe('Fragnade');
  });

  it('stays put when nothing else is available', () => {
    const grenades = { Fragnade: 2, Gasnade: 0, Proxynade: 0 };
    expect(nextAvailableGrenade(grenades, 'Fragnade')).toBe('Fragnade');
  });
});

describe('switchGrenadeType', () => {
  it('moves the selection to the next available type', () => {
    const player = makePlayer();
    expect(switchGrenadeType(player).selectedGrenade).toBe('Gasnade');
  });

  it('does nothing while dead', () => {
    const player = makePlayer({ alive: false });
    expect(switchGrenadeType(player)).toEqual(player);
  });
});

describe('canThrowGrenade / throwGrenade', () => {
  it('can throw when the selected type has a count and cooldown is clear', () => {
    expect(canThrowGrenade(makePlayer())).toBe(true);
  });

  it('cannot throw with 0 of the selected type', () => {
    const player = makePlayer({ grenades: { Fragnade: 0, Gasnade: 2, Proxynade: 0 } });
    expect(canThrowGrenade(player)).toBe(false);
  });

  it('cannot throw while on cooldown', () => {
    const player = makePlayer({ grenadeThrowCooldownRemainingSeconds: 0.2 });
    expect(canThrowGrenade(player)).toBe(false);
  });

  it('decrements the thrown type and starts the cooldown', () => {
    const { state, thrown } = throwGrenade(makePlayer());
    expect(thrown).toBe('Fragnade');
    expect(state.grenades.Fragnade).toBe(1);
    expect(state.grenadeThrowCooldownRemainingSeconds).toBeGreaterThan(0);
    expect(state.selectedGrenade).toBe('Fragnade'); // still has 1 left
  });

  it('auto-switches to the next available type once the thrown type hits 0', () => {
    const player = makePlayer({ grenades: { Fragnade: 1, Gasnade: 2, Proxynade: 0 } });
    const { state } = throwGrenade(player);
    expect(state.grenades.Fragnade).toBe(0);
    expect(state.selectedGrenade).toBe('Gasnade');
  });
});

describe('tickGrenadeThrowCooldown', () => {
  it('counts down and clamps at 0', () => {
    const player = makePlayer({ grenadeThrowCooldownRemainingSeconds: 0.3 });
    expect(tickGrenadeThrowCooldown(player, 0.5).grenadeThrowCooldownRemainingSeconds).toBe(0);
  });
});
