import { describe, expect, it } from 'vitest';
import { canPair, isValidDefaultLoadout, isValidLoadout } from './slots.js';
import type { Slot } from '../types/player.js';
import type { LoadoutSlotSelection } from '../types/host.js';
import type { WeaponId } from '../config/weapons.js';

describe('canPair', () => {
  it('allows exactly the 6 published pairs', () => {
    expect(canPair('TEC9', 'TEC9')).toBe(true);
    expect(canPair('Uzi', 'Uzi')).toBe(true);
    expect(canPair('DesertEagle', 'DesertEagle')).toBe(true);
    expect(canPair('TEC9', 'Uzi')).toBe(true);
    expect(canPair('DesertEagle', 'TEC9')).toBe(true);
    expect(canPair('DesertEagle', 'Uzi')).toBe(true);
    // Order shouldn't matter.
    expect(canPair('Uzi', 'TEC9')).toBe(true);
  });

  it('rejects anything else', () => {
    expect(canPair('AK47', 'AK47')).toBe(false);
    expect(canPair('Uzi', 'AK47')).toBe(false);
    expect(canPair('MP5', 'MP5')).toBe(false);
  });
});

function singleSlot(weapon: WeaponId, ammoInMagazine: number, ammoReserve: number): Slot {
  return { kind: 'single', weapon, ammoInMagazine, ammoReserve, cooldownRemainingSeconds: 0, reloadRemainingSeconds: 0 };
}

function dualSlot(
  weapons: readonly [WeaponId, WeaponId],
  ammoInMagazine: readonly [number, number],
  ammoReserve: readonly [number, number],
): Slot {
  return {
    kind: 'dual',
    weapons,
    ammoInMagazine,
    ammoReserve,
    cooldownRemainingSeconds: 0,
    reloadRemainingSeconds: 0,
  };
}

describe('isValidLoadout', () => {
  it('rejects the same single gun in both slots', () => {
    const slot1 = singleSlot('AK47', 30, 90);
    const slot2 = singleSlot('AK47', 30, 90);
    expect(isValidLoadout(slot1, slot2)).toBe(false);
  });

  it('allows two different single guns', () => {
    const slot1 = singleSlot('AK47', 30, 90);
    const slot2 = singleSlot('M14', 15, 45);
    expect(isValidLoadout(slot1, slot2)).toBe(true);
  });

  it('allows a dual pair alongside an unrelated single gun', () => {
    const dual = dualSlot(['Uzi', 'Uzi'], [30, 30], [90, 90]);
    const single = singleSlot('M14', 15, 45);
    expect(isValidLoadout(dual, single)).toBe(true);
  });

  it('rejects a dual pair sharing a gun with the other slot', () => {
    const dual = dualSlot(['TEC9', 'Uzi'], [20, 30], [80, 90]);
    const single = singleSlot('Uzi', 30, 90);
    expect(isValidLoadout(dual, single)).toBe(false);
  });
});

describe('isValidDefaultLoadout', () => {
  it('allows two different single guns', () => {
    const slot1: LoadoutSlotSelection = { kind: 'single', weapon: 'AK47' };
    const slot2: LoadoutSlotSelection = { kind: 'single', weapon: 'M14' };
    expect(isValidDefaultLoadout(slot1, slot2)).toBe(true);
  });

  it('rejects the same single gun in both slots', () => {
    const slot1: LoadoutSlotSelection = { kind: 'single', weapon: 'AK47' };
    const slot2: LoadoutSlotSelection = { kind: 'single', weapon: 'AK47' };
    expect(isValidDefaultLoadout(slot1, slot2)).toBe(false);
  });

  it('allows a published dual pair alongside an unrelated single gun', () => {
    const dual: LoadoutSlotSelection = { kind: 'dual', weapons: ['TEC9', 'Uzi'] };
    const single: LoadoutSlotSelection = { kind: 'single', weapon: 'M14' };
    expect(isValidDefaultLoadout(dual, single)).toBe(true);
  });

  it('rejects a dual slot that is not one of the 6 published pairs', () => {
    const dual: LoadoutSlotSelection = { kind: 'dual', weapons: ['AK47', 'M14'] };
    const single: LoadoutSlotSelection = { kind: 'single', weapon: 'Shotgun' };
    expect(isValidDefaultLoadout(dual, single)).toBe(false);
  });

  it('rejects a dual pair sharing a gun with the other slot', () => {
    const dual: LoadoutSlotSelection = { kind: 'dual', weapons: ['TEC9', 'Uzi'] };
    const single: LoadoutSlotSelection = { kind: 'single', weapon: 'Uzi' };
    expect(isValidDefaultLoadout(dual, single)).toBe(false);
  });
});
