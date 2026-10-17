import { describe, expect, it } from 'vitest';
import type { PlayerState, Slot } from '../types/player.js';
import {
  applyBoostTank,
  applyGunPickup,
  applyMedkit,
  decideGunPickup,
  pickUpGrenadePair,
} from './pickups.js';

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

function dualSlot(overrides: Partial<Slot> = {}): Slot {
  return {
    kind: 'dual',
    weapons: ['TEC9', 'Uzi'],
    ammoInMagazine: [20, 30],
    ammoReserve: [80, 90],
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
    ...overrides,
  };
}

describe('decideGunPickup', () => {
  it('Uzi+Uzi active, pick up AK47 → replace (breaking the pair, both drop)', () => {
    const slot = dualSlot({ weapons: ['Uzi', 'Uzi'], ammoInMagazine: [30, 30], ammoReserve: [90, 90] });
    expect(decideGunPickup(slot, 'AK47')).toEqual({ kind: 'replace' });
  });

  it('single AK47 active, pick up M14 (not pairable) → replace', () => {
    expect(decideGunPickup(singleSlot({ weapon: 'AK47' }), 'M14')).toEqual({ kind: 'replace' });
  });

  it('single TEC9 active, pick up Uzi (pairable) → pair', () => {
    expect(decideGunPickup(singleSlot({ weapon: 'TEC9' }), 'Uzi')).toEqual({ kind: 'pair' });
  });

  it('single TEC9 active, pick up another TEC9 (already own, dual-capable) → pair', () => {
    expect(decideGunPickup(singleSlot({ weapon: 'TEC9' }), 'TEC9')).toEqual({ kind: 'pair' });
  });

  it('single AK47 active, pick up another AK47 (already own, non-dual) → none', () => {
    expect(decideGunPickup(singleSlot({ weapon: 'AK47' }), 'AK47')).toEqual({ kind: 'none' });
  });

  it('dual pair active, pick up a dual-capable gun → chooseReplace', () => {
    const slot = dualSlot({ weapons: ['TEC9', 'Uzi'] });
    expect(decideGunPickup(slot, 'DesertEagle')).toEqual({ kind: 'chooseReplace' });
  });
});

describe('applyGunPickup', () => {
  it('replace: drops the old gun, new gun has full ammo', () => {
    const player = makePlayer({ slots: [singleSlot({ weapon: 'AK47', ammoInMagazine: 5 }), singleSlot({ weapon: 'M14' })] });
    const result = applyGunPickup(player, 'Shotgun');
    expect(result.dropped).toEqual(['AK47']);
    const slot = result.state.slots[0];
    expect(slot.kind === 'single' && slot.weapon).toBe('Shotgun');
    expect(slot.kind === 'single' && slot.ammoInMagazine).toBe(6); // Shotgun's full magazine
  });

  it('pair: forms a dual slot, keeps the existing gun\'s ammo, new gun full', () => {
    const player = makePlayer({ slots: [singleSlot({ weapon: 'TEC9', ammoInMagazine: 3, ammoReserve: 10 }), singleSlot()] });
    const result = applyGunPickup(player, 'Uzi');
    expect(result.dropped).toEqual([]);
    const slot = result.state.slots[0];
    expect(slot.kind).toBe('dual');
    if (slot.kind === 'dual') {
      expect(slot.weapons).toEqual(['TEC9', 'Uzi']);
      expect(slot.ammoInMagazine[0]).toBe(3); // kept
      expect(slot.ammoInMagazine[1]).toBe(30); // Uzi's full magazine
    }
  });

  it('chooseReplace slot 0: swaps the first gun, keeps the second gun\'s ammo', () => {
    const player = makePlayer({
      slots: [dualSlot({ weapons: ['TEC9', 'Uzi'], ammoInMagazine: [20, 15], ammoReserve: [80, 50] }), singleSlot()],
    });
    const result = applyGunPickup(player, 'DesertEagle', 0);
    expect(result.dropped).toEqual(['TEC9']);
    const slot = result.state.slots[0];
    if (slot.kind === 'dual') {
      expect(slot.weapons).toEqual(['DesertEagle', 'Uzi']);
      expect(slot.ammoInMagazine[1]).toBe(15); // Uzi's ammo kept
      expect(slot.ammoInMagazine[0]).toBe(7); // Desert Eagle's full magazine
    }
  });

  it('chooseReplace slot 1: swaps the second gun, keeps the first', () => {
    const player = makePlayer({
      slots: [dualSlot({ weapons: ['TEC9', 'Uzi'], ammoInMagazine: [20, 15], ammoReserve: [80, 50] }), singleSlot()],
    });
    const result = applyGunPickup(player, 'DesertEagle', 1);
    expect(result.dropped).toEqual(['Uzi']);
    const slot = result.state.slots[0];
    if (slot.kind === 'dual') {
      expect(slot.weapons).toEqual(['TEC9', 'DesertEagle']);
      expect(slot.ammoInMagazine[0]).toBe(20); // TEC9's ammo kept
    }
  });

  it('none: no change, nothing dropped', () => {
    const player = makePlayer({ slots: [singleSlot({ weapon: 'AK47' }), singleSlot()] });
    const result = applyGunPickup(player, 'AK47');
    expect(result.dropped).toEqual([]);
    expect(result.state).toBe(player);
  });
});

describe('pickUpGrenadePair', () => {
  it('takes both when there is room for 2', () => {
    const result = pickUpGrenadePair({ Fragnade: 1, Gasnade: 0, Proxynade: 0 }, 'Gasnade');
    expect(result.taken).toBe(2);
    expect(result.grenades.Gasnade).toBe(2);
  });

  it('at 4 total, takes 1 and leaves 1', () => {
    const result = pickUpGrenadePair({ Fragnade: 2, Gasnade: 2, Proxynade: 0 }, 'Proxynade');
    expect(result.taken).toBe(1);
    expect(result.grenades.Proxynade).toBe(1);
  });

  it('at 5 total, takes 0 — stays on the map', () => {
    const inventory = { Fragnade: 3, Gasnade: 2, Proxynade: 0 };
    const result = pickUpGrenadePair(inventory, 'Proxynade');
    expect(result.taken).toBe(0);
    expect(result.grenades).toBe(inventory);
  });
});

describe('applyMedkit / applyBoostTank', () => {
  it('medkit heals to full', () => {
    const player = makePlayer({ health: 40 });
    expect(applyMedkit(player)?.health).toBe(100);
  });

  it('medkit is a no-op at full health', () => {
    expect(applyMedkit(makePlayer({ health: 100 }))).toBeNull();
  });

  it('boost tank refills to full', () => {
    const player = makePlayer({ fuel: 10 });
    expect(applyBoostTank(player, 100)?.fuel).toBe(100);
  });

  it('boost tank is a no-op at full fuel', () => {
    expect(applyBoostTank(makePlayer({ fuel: 100 }), 100)).toBeNull();
  });
});
