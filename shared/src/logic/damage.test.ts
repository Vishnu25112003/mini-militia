import { describe, expect, it } from 'vitest';
import { WEAPONS } from '../config/weapons.js';
import { GRENADES } from '../config/grenades.js';
import type { PlayerState } from '../types/player.js';
import { applyDamage, isFrontHit } from './damage.js';

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
    kills: 0,
    deaths: 0,
    points: 0,
    gotKillThisLife: false,
    shieldSecondsRemaining: 0,
    alive: true,
    ...overrides,
  };
}

describe('applyDamage — SMAW', () => {
  const smaw = WEAPONS.SMAW;

  it('direct hit: 100 normally, 70 to a crouching front hit', () => {
    const standing = applyDamage(makePlayer(), {
      amount: smaw.directHitDamage!,
      crouchAmount: smaw.crouchDirectHitDamage,
      hitDirection: 'front',
    });
    expect(standing.health).toBe(0);

    const crouchingFront = applyDamage(makePlayer({ crouching: true }), {
      amount: smaw.directHitDamage!,
      crouchAmount: smaw.crouchDirectHitDamage,
      hitDirection: 'front',
    });
    expect(crouchingFront.health).toBe(30);
  });

  it('splash: 50 normally, 40 to a crouching front hit', () => {
    const standing = applyDamage(makePlayer(), {
      amount: smaw.splashDamage!,
      crouchAmount: smaw.crouchSplashDamage,
      hitDirection: 'front',
    });
    expect(standing.health).toBe(50);

    const crouchingFront = applyDamage(makePlayer({ crouching: true }), {
      amount: smaw.splashDamage!,
      crouchAmount: smaw.crouchSplashDamage,
      hitDirection: 'front',
    });
    expect(crouchingFront.health).toBe(60);
  });

  it('a hit on the back always takes full damage, crouching or not', () => {
    const result = applyDamage(makePlayer({ crouching: true }), {
      amount: smaw.directHitDamage!,
      crouchAmount: smaw.crouchDirectHitDamage,
      hitDirection: 'back',
    });
    expect(result.health).toBe(0);
  });
});

describe('applyDamage — grenades', () => {
  it("Gasnade's crouch value is the flow's literal 6/sec, not a recomputed 8×0.8", () => {
    const gasnade = GRENADES.Gasnade;
    const result = applyDamage(makePlayer({ crouching: true, health: 100 }), {
      amount: gasnade.damage,
      crouchAmount: gasnade.crouchDamage,
      hitDirection: 'front',
    });
    expect(result.health).toBe(94);
  });
});

describe('isFrontHit', () => {
  it('a player facing right is hit on the front by an attacker to their right', () => {
    expect(isFrontHit('right', 10, 0)).toBe('front');
    expect(isFrontHit('right', -10, 0)).toBe('back');
  });

  it('a player facing left is hit on the front by an attacker to their left', () => {
    expect(isFrontHit('left', -10, 0)).toBe('front');
    expect(isFrontHit('left', 10, 0)).toBe('back');
  });
});
