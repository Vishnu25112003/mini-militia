import { describe, expect, it } from 'vitest';
import { DUAL_GUNS, DUAL_PAIRS } from '../config/dualPairs';
import { GUN_IDS, type GunId, type Slot, type SlotSpec } from '../types';
import { canPair, isDualCapable, isValidLoadout, isValidPair, slotGuns, validateSlots } from '../logic/slots';

const single = (gun: GunId): SlotSpec => ({ kind: 'single', gun });
const pair = (a: 'tec9' | 'uzi' | 'desert_eagle', b: 'tec9' | 'uzi' | 'desert_eagle'): SlotSpec => ({
  kind: 'pair',
  guns: [a, b],
});

describe('dual pairs (Game Flow, Section 7)', () => {
  it('there are exactly 6 pairs: TEC9+TEC9, Uzi+Uzi, Deagle+Deagle, TEC9+Uzi, Deagle+TEC9, Deagle+Uzi', () => {
    expect(DUAL_PAIRS).toHaveLength(6);
    const names = DUAL_PAIRS.map(([a, b]) => [a, b].sort().join('+')).sort();
    expect(names).toEqual(
      [
        'desert_eagle+desert_eagle',
        'desert_eagle+tec9',
        'desert_eagle+uzi',
        'tec9+tec9',
        'tec9+uzi',
        'uzi+uzi',
      ].sort(),
    );
  });

  it('only TEC9, Uzi and Desert Eagle can be dual-wielded', () => {
    expect([...DUAL_GUNS].sort()).toEqual(['desert_eagle', 'tec9', 'uzi']);
    for (const g of GUN_IDS) expect(isDualCapable(g), g).toBe(DUAL_GUNS.includes(g as never));
  });

  it('isValidPair accepts the 6 pairs in either order and rejects everything else', () => {
    for (const [a, b] of DUAL_PAIRS) {
      expect(isValidPair(a, b)).toBe(true);
      expect(isValidPair(b, a)).toBe(true);
    }
    // every other combination of the 15 guns is not a pair
    let valid = 0;
    for (const a of GUN_IDS) for (const b of GUN_IDS) if (isValidPair(a, b)) valid++;
    expect(valid).toBe(9); // 3 same-gun + 3 mixed pairs, counted in both orders (3 + 6)
    expect(isValidPair('ak47', 'ak47')).toBe(false);
    expect(isValidPair('uzi', 'ak47')).toBe(false);
    expect(isValidPair('mp5', 'mp5')).toBe(false);
  });

  it('canPair: Uzi + Uzi / TEC9 can pair, Uzi + AK47 cannot', () => {
    expect(canPair('uzi', 'uzi')).toBe(true);
    expect(canPair('uzi', 'tec9')).toBe(true);
    expect(canPair('desert_eagle', 'uzi')).toBe(true);
    expect(canPair('uzi', 'ak47')).toBe(false);
    expect(canPair('ak47', 'ak47')).toBe(false);
  });
});

describe('slot rules (Game Flow, Section 7)', () => {
  it('two different single guns are valid', () => {
    expect(isValidLoadout([single('ak47'), single('m14')])).toBe(true);
  });

  it('the same gun in both slots is NOT allowed (AK47 + AK47)', () => {
    expect(validateSlots([single('ak47'), single('ak47')])).toContain('same_gun_in_both_slots');
  });

  it('a dual pair counts as ONE slot; the other slot holds a different gun', () => {
    expect(isValidLoadout([pair('uzi', 'uzi'), single('m14')])).toBe(true);
    expect(isValidLoadout([single('m14'), pair('tec9', 'desert_eagle')])).toBe(true);
  });

  it('a gun inside a pair may not also be in the other slot (Uzi+Uzi and Uzi)', () => {
    expect(validateSlots([pair('uzi', 'uzi'), single('uzi')])).toContain('same_gun_in_both_slots');
    expect(validateSlots([pair('uzi', 'tec9'), single('tec9')])).toContain('same_gun_in_both_slots');
    expect(isValidLoadout([pair('uzi', 'tec9'), single('desert_eagle')])).toBe(true);
  });

  it('a "pair" of non-dual guns is rejected', () => {
    const bad = { kind: 'pair', guns: ['ak47', 'uzi'] } as unknown as SlotSpec;
    expect(validateSlots([bad, single('m14')])).toContain('invalid_pair');
  });

  it('a slot can never be empty', () => {
    expect(validateSlots([single('ak47'), undefined as unknown as SlotSpec])).toEqual(['missing_slot']);
    expect(validateSlots([undefined as unknown as SlotSpec, single('ak47')])).toEqual(['missing_slot']);
  });

  it('slotGuns lists one gun for a single and two for a pair; works for slots with ammo too', () => {
    expect(slotGuns(single('mp5'))).toEqual(['mp5']);
    expect(slotGuns(pair('uzi', 'tec9'))).toEqual(['uzi', 'tec9']);
    const withAmmo: Slot = { kind: 'single', gun: 'ak47', ammo: { magazine: 30, reserve: 90 } };
    expect(slotGuns(withAmmo)).toEqual(['ak47']);
  });
});
