import { describe, expect, it } from 'vitest';
import { WEAPONS } from '../config/weapons.js';
import { WEAPON_RANGE_PX } from '../config/weaponRange.js';
import type { CollisionMap } from '../physics/map.js';
import type { PlayerState, Slot } from '../types/player.js';
import {
  canFireActiveSlot,
  damageParamsForShot,
  fireActiveSlot,
  fireKindForWeapon,
  hitscanRangeForWeapons,
  resolveHitscanShot,
  resolveSplashDamage,
  startReloadActiveSlot,
  swapActiveSlot,
  tickCombatTimers,
} from './combat.js';

const MAX_RANGE = 4000;

function singleSlot(overrides: Partial<Slot> = {}): Slot {
  return {
    kind: 'single',
    weapon: 'AK47',
    ammoInMagazine: 30,
    ammoReserve: 90,
    cooldownRemainingSeconds: 0,
    reloadRemainingSeconds: 0,
    ...overrides,
  } as Slot;
}

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
    slots: [singleSlot(), singleSlot({ weapon: 'M14', ammoInMagazine: 15, ammoReserve: 45 })],
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

function buildOpenMap(): CollisionMap {
  return {
    tileSize: 32,
    widthInTiles: 100,
    heightInTiles: 60,
    isSolidTile: () => false,
  };
}

describe('canFireActiveSlot / fireActiveSlot', () => {
  it('can fire a fresh magazine', () => {
    expect(canFireActiveSlot(makePlayer())).toBe(true);
  });

  it('cannot fire with an empty magazine', () => {
    const player = makePlayer({ slots: [singleSlot({ ammoInMagazine: 0 }), singleSlot()] });
    expect(canFireActiveSlot(player)).toBe(false);
  });

  it('cannot fire while dead', () => {
    expect(canFireActiveSlot(makePlayer({ alive: false }))).toBe(false);
  });

  it('decrements ammo and sets cooldown to 1/fireRate on fire', () => {
    const { state, weaponsFired, fireKind, rayAngles } = fireActiveSlot(makePlayer(), 0);
    const slot = state.slots[0];
    expect(slot.kind).toBe('single');
    if (slot.kind === 'single') {
      expect(slot.ammoInMagazine).toBe(29);
      expect(slot.cooldownRemainingSeconds).toBeCloseTo(1 / WEAPONS.AK47.fireRate);
    }
    expect(weaponsFired).toHaveLength(1);
    expect(weaponsFired[0]!.id).toBe('AK47');
    expect(fireKind).toBe('hitscan');
    expect(rayAngles).toEqual([0]);
  });

  it('cannot fire again until the cooldown elapses', () => {
    const { state } = fireActiveSlot(makePlayer(), 0);
    expect(canFireActiveSlot(state)).toBe(false);
  });

  it('a 3-round burst (M16) spends 3 ammo and resolves 3 rays', () => {
    const player = makePlayer({ slots: [singleSlot({ weapon: 'M16', ammoInMagazine: 30 }), singleSlot()] });
    const { state, rayAngles } = fireActiveSlot(player, 0);
    const slot = state.slots[0];
    expect(slot.kind === 'single' && slot.ammoInMagazine).toBe(27);
    expect(rayAngles).toHaveLength(3);
  });

  it('a partial burst only fires as many rays as rounds left in the magazine', () => {
    const player = makePlayer({ slots: [singleSlot({ weapon: 'M16', ammoInMagazine: 2 }), singleSlot()] });
    const { state, rayAngles } = fireActiveSlot(player, 0);
    const slot = state.slots[0];
    expect(slot.kind === 'single' && slot.ammoInMagazine).toBe(0);
    expect(rayAngles).toHaveLength(2);
  });

  it('the Shotgun spends 1 shell but resolves 8 pellet rays', () => {
    const player = makePlayer({
      slots: [singleSlot({ weapon: 'Shotgun', ammoInMagazine: 6 }), singleSlot()],
    });
    const { state, rayAngles } = fireActiveSlot(player, 0);
    const slot = state.slots[0];
    expect(slot.kind === 'single' && slot.ammoInMagazine).toBe(5);
    expect(rayAngles).toHaveLength(8);
  });

  it('SMAW and RG6 are projectile weapons with no rays to resolve', () => {
    for (const weapon of ['SMAW', 'RG6'] as const) {
      const player = makePlayer({ slots: [singleSlot({ weapon, ammoInMagazine: 4 }), singleSlot()] });
      const { fireKind, rayAngles } = fireActiveSlot(player, 0);
      expect(fireKind).toBe('projectile');
      expect(rayAngles).toHaveLength(0);
    }
  });
});

describe('fireKindForWeapon', () => {
  it('classifies the two explosive launchers as projectiles, everything else as hitscan', () => {
    expect(fireKindForWeapon(WEAPONS.SMAW)).toBe('projectile');
    expect(fireKindForWeapon(WEAPONS.RG6)).toBe('projectile');
    expect(fireKindForWeapon(WEAPONS.AK47)).toBe('hitscan');
    expect(fireKindForWeapon(WEAPONS.Flame)).toBe('hitscan');
    expect(fireKindForWeapon(WEAPONS.Phasr)).toBe('hitscan');
  });
});

describe('startReloadActiveSlot', () => {
  it('starts a reload when the magazine is short and reserve is available', () => {
    const player = makePlayer({ slots: [singleSlot({ ammoInMagazine: 10 }), singleSlot()] });
    const reloaded = startReloadActiveSlot(player);
    const slot = reloaded.slots[0];
    expect(slot.reloadRemainingSeconds).toBe(WEAPONS.AK47.reload);
  });

  it('does nothing with a full magazine', () => {
    const player = makePlayer();
    expect(startReloadActiveSlot(player)).toEqual(player);
  });

  it('does nothing with no reserve left', () => {
    const player = makePlayer({ slots: [singleSlot({ ammoInMagazine: 5, ammoReserve: 0 }), singleSlot()] });
    expect(startReloadActiveSlot(player)).toEqual(player);
  });
});

describe('swapActiveSlot', () => {
  it('toggles between slot 0 and 1', () => {
    const player = makePlayer();
    expect(swapActiveSlot(player).activeSlotIndex).toBe(1);
    expect(swapActiveSlot(swapActiveSlot(player)).activeSlotIndex).toBe(0);
  });
});

describe('tickCombatTimers', () => {
  it('counts down cooldown, reload, and spawn shield', () => {
    const player = makePlayer({
      slots: [
        singleSlot({ cooldownRemainingSeconds: 0.2, reloadRemainingSeconds: 1 }),
        singleSlot(),
      ],
      shieldSecondsRemaining: 2,
    });
    const next = tickCombatTimers(player, 0.5);
    expect(next.slots[0].cooldownRemainingSeconds).toBe(0);
    expect(next.slots[0].reloadRemainingSeconds).toBeCloseTo(0.5);
    expect(next.shieldSecondsRemaining).toBeCloseTo(1.5);
  });

  it('refills the magazine from reserve when a reload completes', () => {
    const player = makePlayer({
      slots: [singleSlot({ ammoInMagazine: 10, ammoReserve: 50, reloadRemainingSeconds: 0.1 }), singleSlot()],
    });
    const next = tickCombatTimers(player, 0.5);
    const slot = next.slots[0];
    expect(slot.reloadRemainingSeconds).toBe(0);
    if (slot.kind === 'single') {
      expect(slot.ammoInMagazine).toBe(30);
      expect(slot.ammoReserve).toBe(30);
    }
  });
});

describe('resolveHitscanShot', () => {
  it('hits the only target directly ahead', () => {
    const map = buildOpenMap();
    const result = resolveHitscanShot(map, 0, 0, 0, MAX_RANGE, [{ id: 'victim', x: 100, y: 0, facing: 'left' }]);
    expect(result?.targetId).toBe('victim');
  });

  it('misses a wall behind which the real target stands', () => {
    const map: CollisionMap = {
      tileSize: 32,
      widthInTiles: 10,
      heightInTiles: 10,
      isSolidTile: (x, y) => x === 3 && y === 0,
    };
    const result = resolveHitscanShot(map, 16, 16, 0, MAX_RANGE, [
      { id: 'victim', x: 300, y: 16, facing: 'left' },
    ]);
    expect(result).toBeNull();
  });

  it('returns the closest target when two are in line', () => {
    const map = buildOpenMap();
    const result = resolveHitscanShot(map, 0, 0, 0, MAX_RANGE, [
      { id: 'far', x: 300, y: 0, facing: 'left' },
      { id: 'near', x: 100, y: 0, facing: 'left' },
    ]);
    expect(result?.targetId).toBe('near');
  });

  it('misses a target beyond the weapon-specific maxDistance', () => {
    const map = buildOpenMap();
    const result = resolveHitscanShot(map, 0, 0, 0, 50, [{ id: 'victim', x: 500, y: 0, facing: 'left' }]);
    expect(result).toBeNull();
  });
});

describe('hitscanRangeForWeapons', () => {
  it('uses a single weapon\'s own range', () => {
    expect(hitscanRangeForWeapons([WEAPONS.M93BA])).toBe(WEAPON_RANGE_PX['very-long']);
  });

  it('uses the shorter range of a mixed dual pair', () => {
    // Desert Eagle (medium) + TEC9 (short) — shortest wins.
    expect(hitscanRangeForWeapons([WEAPONS.DesertEagle, WEAPONS.TEC9])).toBe(WEAPON_RANGE_PX.short);
  });
});

describe('resolveSplashDamage', () => {
  it('deals direct-hit damage to the struck player, splash to a nearby one, nothing beyond the radius', () => {
    const hits = resolveSplashDamage(WEAPONS.SMAW, 0, 0, 96, 'struck', [
      { id: 'struck', x: 0, y: 0, crouching: false, facing: 'left' },
      { id: 'nearby', x: 50, y: 0, crouching: false, facing: 'left' },
      { id: 'far', x: 500, y: 0, crouching: false, facing: 'left' },
    ]);
    expect(hits).toHaveLength(2);
    const struck = hits.find((h) => h.targetId === 'struck')!;
    expect(struck.isDirect).toBe(true);
    expect(struck.params.amount).toBe(WEAPONS.SMAW.directHitDamage);
    const nearby = hits.find((h) => h.targetId === 'nearby')!;
    expect(nearby.isDirect).toBe(false);
    expect(nearby.params.amount).toBe(WEAPONS.SMAW.splashDamage);
    expect(hits.find((h) => h.targetId === 'far')).toBeUndefined();
  });

  it('applies the shooter as a normal candidate target (self-damage)', () => {
    const hits = resolveSplashDamage(WEAPONS.RG6, 0, 0, 64, null, [
      { id: 'shooter', x: 10, y: 0, crouching: false, facing: 'left' },
    ]);
    expect(hits).toHaveLength(1);
    expect(hits[0]!.isDirect).toBe(false);
    expect(hits[0]!.params.amount).toBe(WEAPONS.RG6.splashDamage);
  });

  it('gives a crouching front hit the weapon\'s own reduced crouch numbers', () => {
    const hits = resolveSplashDamage(WEAPONS.SMAW, 0, 0, 96, 'struck', [
      { id: 'struck', x: 0, y: 0, crouching: true, facing: 'right' }, // impact is to the left → front
    ]);
    expect(hits[0]!.params.crouchAmount).toBe(WEAPONS.SMAW.crouchDirectHitDamage);
  });
});

describe('damageParamsForShot', () => {
  it('uses a single weapon\'s stats', () => {
    const params = damageParamsForShot([WEAPONS.AK47], 'back');
    expect(params.amount).toBe(WEAPONS.AK47.damage);
    expect(params.crouchAmount).toBe(WEAPONS.AK47.crouchDamage);
  });

  it('sums both guns of a dual pair', () => {
    const params = damageParamsForShot([WEAPONS.Uzi, WEAPONS.Uzi], 'front');
    expect(params.amount).toBe(WEAPONS.Uzi.damage * 2);
    expect(params.crouchAmount).toBe(WEAPONS.Uzi.crouchDamage * 2);
  });
});
