import { describe, expect, it } from 'vitest';
import type { PlayerState } from '../types/player.js';
import { canMelee, isWithinMeleeRange, performMeleeSwing, resolveMeleeClash, tickMeleeCooldown } from './melee.js';

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

describe('canMelee / performMeleeSwing / tickMeleeCooldown', () => {
  it('can melee when alive and off cooldown', () => {
    expect(canMelee(makePlayer())).toBe(true);
  });

  it('cannot melee while dead', () => {
    expect(canMelee(makePlayer({ alive: false }))).toBe(false);
  });

  it('cannot melee again until the cooldown elapses', () => {
    const swung = performMeleeSwing(makePlayer());
    expect(canMelee(swung)).toBe(false);
    expect(swung.meleeCooldownRemainingSeconds).toBeGreaterThan(0);
  });

  it('cooldown ticks down and clamps at 0', () => {
    const swung = performMeleeSwing(makePlayer());
    const after = tickMeleeCooldown(swung, 10);
    expect(after.meleeCooldownRemainingSeconds).toBe(0);
    expect(canMelee(after)).toBe(true);
  });
});

describe('isWithinMeleeRange', () => {
  it('is true just inside range and false just outside it', () => {
    expect(isWithinMeleeRange(0, 0, 60, 0)).toBe(true);
    expect(isWithinMeleeRange(0, 0, 70, 0)).toBe(false);
  });
});

describe('resolveMeleeClash', () => {
  it('A (100 hp) hits first: A gets the kill and drops to 50 hp, survives', () => {
    const result = resolveMeleeClash(100);
    expect(result.firstHitterHealthAfter).toBe(50);
    expect(result.firstHitterDies).toBe(false);
  });

  it('B (30 hp) hits first: B gets the kill, but also dies', () => {
    const result = resolveMeleeClash(30);
    expect(result.firstHitterHealthAfter).toBe(0);
    expect(result.firstHitterDies).toBe(true);
  });

  it('exactly 50 hp counts as "50 or less": the first hitter also dies', () => {
    const result = resolveMeleeClash(50);
    expect(result.firstHitterHealthAfter).toBe(0);
    expect(result.firstHitterDies).toBe(true);
  });

  it('51 hp survives', () => {
    const result = resolveMeleeClash(51);
    expect(result.firstHitterHealthAfter).toBe(1);
    expect(result.firstHitterDies).toBe(false);
  });
});
